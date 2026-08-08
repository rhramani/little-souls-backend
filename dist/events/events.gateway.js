"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventsGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const common_1 = require("@nestjs/common");
const socket_io_1 = require("socket.io");
const customer_activity_service_1 = require("./customer-activity.service");
let EventsGateway = class EventsGateway {
    activityService;
    server;
    logger = new common_1.Logger('EventsGateway');
    socketSessionMap = new Map();
    constructor(activityService) {
        this.activityService = activityService;
    }
    afterInit(server) {
        this.logger.log('WebSocket Gateway Initialized');
    }
    handleConnection(client, ...args) {
        this.logger.log(`Client connected: ${client.id}`);
        const role = client.handshake.query.role;
        const userId = client.handshake.query.userId;
        if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
            client.join('room:super_admin');
            this.logger.log(`Admin socket ${client.id} joined room:super_admin`);
        }
        if (userId) {
            client.join(`room:user_${userId}`);
        }
    }
    async handleDisconnect(client) {
        this.logger.log(`Client disconnected: ${client.id}`);
        const sessionKey = this.socketSessionMap.get(client.id);
        if (sessionKey) {
            this.socketSessionMap.delete(client.id);
            try {
                await this.activityService.endSession(sessionKey, this.server);
            }
            catch (err) {
                this.logger.error(`Error ending session on disconnect: ${err}`);
            }
        }
    }
    handleJoinRoom(client, data) {
        if (data.role === 'SUPER_ADMIN' || data.role === 'ADMIN') {
            client.join('room:super_admin');
            this.logger.log(`Socket ${client.id} explicitly joined room:super_admin`);
        }
        if (data.userId) {
            client.join(`room:user_${data.userId}`);
        }
        return { status: 'joined' };
    }
    handleSessionStart(client, data) {
        if (!data || !data.userId)
            return;
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
        this.logger.log(`Customer session started: ${data.customerName || data.userId} (socket ${client.id})`);
        return { status: 'started', sessionId: session.sessionId };
    }
    handleActivity(client, data) {
        const sessionKey = data.userId || this.socketSessionMap.get(client.id);
        if (!sessionKey)
            return;
        this.activityService.recordActivity(sessionKey, {
            action: data.action,
            section: data.section,
            path: data.path,
            details: data.details,
        });
        return { status: 'recorded' };
    }
    async handleLogout(client, data) {
        const sessionKey = data.userId || this.socketSessionMap.get(client.id);
        if (sessionKey) {
            this.socketSessionMap.delete(client.id);
            const summary = await this.activityService.endSession(sessionKey, this.server);
            return { status: 'logged_out', summary };
        }
        return { status: 'no_active_session' };
    }
    emitCustomerRegistered(customer) {
        this.server.emit('customer.registered', customer);
    }
    emitCustomerStatusChanged(customerId, status) {
        this.server.emit('customer.statusChanged', { customerId, status });
    }
};
exports.EventsGateway = EventsGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], EventsGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('join_room'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], EventsGateway.prototype, "handleJoinRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('customer:session_start'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], EventsGateway.prototype, "handleSessionStart", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('customer:activity'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], EventsGateway.prototype, "handleActivity", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('customer:logout'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], EventsGateway.prototype, "handleLogout", null);
exports.EventsGateway = EventsGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: '*',
        },
    }),
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)((0, common_1.forwardRef)(() => customer_activity_service_1.CustomerActivityService))),
    __metadata("design:paramtypes", [customer_activity_service_1.CustomerActivityService])
], EventsGateway);
//# sourceMappingURL=events.gateway.js.map