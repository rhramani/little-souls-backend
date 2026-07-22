import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, Injectable, Inject, forwardRef } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { CustomerActivityService } from './customer-activity.service';

@WebSocketGateway({
  cors: {
    origin: '*', // Allow any origin during dev
  },
})
@Injectable()
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('EventsGateway');
  private socketSessionMap = new Map<string, string>(); // socketId -> sessionKey

  constructor(
    @Inject(forwardRef(() => CustomerActivityService))
    private readonly activityService: CustomerActivityService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway Initialized');
  }

  handleConnection(client: Socket, ...args: any[]) {
    this.logger.log(`Client connected: ${client.id}`);
    const role = client.handshake.query.role as string;
    const userId = client.handshake.query.userId as string;

    if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
      client.join('room:super_admin');
      this.logger.log(`Admin socket ${client.id} joined room:super_admin`);
    }

    if (userId) {
      client.join(`room:user_${userId}`);
    }
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    const sessionKey = this.socketSessionMap.get(client.id);
    if (sessionKey) {
      this.socketSessionMap.delete(client.id);
      // Finalize customer activity session on disconnect if active
      try {
        await this.activityService.endSession(sessionKey, this.server);
      } catch (err) {
        this.logger.error(`Error ending session on disconnect: ${err}`);
      }
    }
  }

  @SubscribeMessage('join_room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { role?: string; userId?: string },
  ) {
    if (data.role === 'SUPER_ADMIN' || data.role === 'ADMIN') {
      client.join('room:super_admin');
      this.logger.log(`Socket ${client.id} explicitly joined room:super_admin`);
    }
    if (data.userId) {
      client.join(`room:user_${data.userId}`);
    }
    return { status: 'joined' };
  }

  @SubscribeMessage('customer:session_start')
  handleSessionStart(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      userId: string;
      customerId?: string;
      customerCode?: string;
      businessName?: string;
      customerName?: string;
      customerEmail?: string;
      customerMobile?: string;
    },
  ) {
    if (!data || !data.userId) return;
    const sessionKey = data.userId;
    this.socketSessionMap.set(client.id, sessionKey);

    const session = this.activityService.startSession({
      userId: data.userId,
      customerId: data.customerId || '',
      customerCode: data.customerCode,
      businessName: data.businessName,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerMobile: data.customerMobile,
    });

    this.logger.log(
      `Customer session started: ${data.customerName || data.userId} (socket ${client.id})`,
    );

    return { status: 'started', sessionId: session.sessionId };
  }

  @SubscribeMessage('customer:activity')
  handleActivity(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      userId?: string;
      action: string;
      section: string;
      path?: string;
      details?: string;
    },
  ) {
    const sessionKey = data.userId || this.socketSessionMap.get(client.id);
    if (!sessionKey) return;

    this.activityService.recordActivity(sessionKey, {
      action: data.action,
      section: data.section,
      path: data.path,
      details: data.details,
    });

    return { status: 'recorded' };
  }

  @SubscribeMessage('customer:logout')
  async handleLogout(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId?: string },
  ) {
    const sessionKey = data.userId || this.socketSessionMap.get(client.id);
    if (sessionKey) {
      this.socketSessionMap.delete(client.id);
      const summary = await this.activityService.endSession(sessionKey, this.server);
      return { status: 'logged_out', summary };
    }
    return { status: 'no_active_session' };
  }

  // Helper method to broadcast customer registration
  emitCustomerRegistered(customer: any) {
    this.server.emit('customer.registered', customer);
  }

  emitCustomerStatusChanged(customerId: string, status: string) {
    this.server.emit('customer.statusChanged', { customerId, status });
  }
}
