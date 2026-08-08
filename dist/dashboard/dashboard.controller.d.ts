import { DashboardService } from './dashboard.service';
export declare class DashboardController {
    private readonly dashboardService;
    constructor(dashboardService: DashboardService);
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
