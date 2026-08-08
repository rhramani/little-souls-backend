import { OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { CustomerActivityService } from './customer-activity.service';
export declare class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    private readonly activityService;
    server: Server;
    private logger;
    private socketSessionMap;
    constructor(activityService: CustomerActivityService);
    afterInit(server: Server): void;
    handleConnection(client: Socket, ...args: any[]): void;
    handleDisconnect(client: Socket): Promise<void>;
    handleJoinRoom(client: Socket, data: {
        role?: string;
        userId?: string;
    }): {
        status: string;
    };
    handleSessionStart(client: Socket, data: {
        userId: string;
        customerId?: string;
        customerCode?: string;
        businessName?: string;
        customerName?: string;
        customerEmail?: string;
        customerMobile?: string;
    }): {
        status: string;
        sessionId: string;
    } | undefined;
    handleActivity(client: Socket, data: {
        userId?: string;
        action: string;
        section: string;
        path?: string;
        details?: string;
    }): {
        status: string;
    } | undefined;
    handleLogout(client: Socket, data: {
        userId?: string;
    }): Promise<{
        status: string;
        summary: {
            id: any;
            sessionId: string;
            userId: string;
            customerId: string;
            customer: {
                businessName: string | undefined;
                customerCode: string | undefined;
                name: string | undefined;
                email: string | undefined;
                mobile: string | undefined;
            };
            loginTime: string;
            logoutTime: string;
            totalDurationSeconds: number;
            formattedDuration: string;
            sectionDurations: Record<string, number>;
            formattedSections: string;
            keyHighlights: string;
            activities: import("./customer-activity.service").ActivityItem[];
            activitySummaryLines: string[];
            summaryMessage: string;
        } | null;
    } | {
        status: string;
        summary?: undefined;
    }>;
    emitCustomerRegistered(customer: any): void;
    emitCustomerStatusChanged(customerId: string, status: string): void;
}
