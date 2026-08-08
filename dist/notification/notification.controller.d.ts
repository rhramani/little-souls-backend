import { NotificationService } from './notification.service';
export declare class NotificationController {
    private readonly notificationService;
    constructor(notificationService: NotificationService);
    getMyNotifications(userId: string, page?: number, limit?: number): Promise<{
        notifications: {
            message: string;
            id: string;
            createdAt: Date;
            userId: string;
            title: string;
            notificationType: string;
            isRead: boolean;
            readAt: Date | null;
        }[];
        unreadCount: number;
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    markAllRead(userId: string): Promise<{
        message: string;
    }>;
    markRead(id: string, userId: string): Promise<{
        message: string;
        id: string;
        createdAt: Date;
        userId: string;
        title: string;
        notificationType: string;
        isRead: boolean;
        readAt: Date | null;
    }>;
}
