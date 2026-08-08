import { PrismaService } from '../prisma/prisma.service';
export declare class DashboardService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getSummary(): Promise<{
        totalCustomers: number;
        totalProducts: number;
        totalOrders: number;
        totalRevenue: number;
        thisMonthRevenue: number;
        todaysOrders: number;
        pendingCustomers: number;
        recentOrders: {
            id: string;
            orderNumber: string;
            amount: number;
            status: string;
            date: Date;
            customerName: string;
        }[];
        orderStatusBreakdown: {
            PENDING: number;
            PROCESSING: number;
            PACKED: number;
            SHIPPED: number;
            DELIVERED: number;
            CANCELLED: number;
            RETURNED: number;
        };
        salesData: {
            d: string;
            v: number;
        }[];
        topProducts: {
            name: string;
            v: number;
        }[];
    }>;
    getPublicStats(): Promise<{
        totalSkus: number;
        partnerStores: number;
        totalProcessed: string;
        onTimeDispatch: string;
    }>;
}
