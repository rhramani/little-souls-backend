import { PrismaService } from '../prisma/prisma.service';
export declare class NotificationService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getUserNotifications(userId: string, page?: number, limit?: number): Promise<{
        notifications: {
            id: string;
            createdAt: Date;
            message: string;
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
    markRead(notificationId: string, userId: string): Promise<{
        id: string;
        createdAt: Date;
        message: string;
        userId: string;
        title: string;
        notificationType: string;
        isRead: boolean;
        readAt: Date | null;
    }>;
    markAllRead(userId: string): Promise<{
        message: string;
    }>;
    createNotification(userId: string, title: string, message: string, type?: string): Promise<{
        id: string;
        createdAt: Date;
        message: string;
        userId: string;
        title: string;
        notificationType: string;
        isRead: boolean;
        readAt: Date | null;
    }>;
}
