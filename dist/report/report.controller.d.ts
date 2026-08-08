import { ReportService } from './report.service';
export declare class ReportController {
    private readonly reportService;
    constructor(reportService: ReportService);
    getSales(startDate?: string, endDate?: string): Promise<{
        totalOrders: number;
        totalRevenue: number;
        sales: {
            date: string;
            sales: number;
            orders: number;
            posSales: number;
            wholesaleSales: number;
            tax: number;
            shipping: number;
        }[];
        dateRange: {
            startDate: string | undefined;
            endDate: string | undefined;
        };
    }>;
    getOutstanding(): Promise<{
        totalOutstanding: number;
        topDefaulters: {
            businessName: string;
            id: string;
            currentBalance: number | null;
        }[];
    }>;
    getAttendance(startDate?: string, endDate?: string): Promise<{
        summary: {
            PRESENT: number;
            ABSENT: number;
            HALF_DAY: number;
            LEAVE: number;
        };
        totalRecords: number;
    }>;
    getProductPerformance(startDate?: string, endDate?: string): Promise<{
        topPerforming: {
            id: string;
            name: string;
            sku: string;
            quantitySold: number;
            revenue: number;
            stock: number;
            price: number;
        }[];
        bottomPerforming: {
            id: string;
            name: string;
            sku: string;
            quantitySold: number;
            revenue: number;
            stock: number;
            price: number;
        }[];
        products: {
            id: string;
            name: string;
            sku: string;
            quantitySold: number;
            revenue: number;
            stock: number;
            price: number;
        }[];
        all: {
            id: string;
            name: string;
            sku: string;
            quantitySold: number;
            revenue: number;
            stock: number;
            price: number;
        }[];
    }>;
    getCustomersReport(startDate?: string, endDate?: string): Promise<{
        id: string;
        name: string;
        businessName: string;
        gstin: string;
        ordersCount: number;
        totalSpent: number;
        outstanding: number;
        currentBalance: number;
    }[]>;
    getOrdersReport(startDate?: string, endDate?: string): Promise<{
        totalOrders: number;
        statusBreakdown: Record<string, {
            count: number;
            value: number;
        }>;
    }>;
    getPackingReport(startDate?: string, endDate?: string): Promise<{
        totalSlips: number;
        statusBreakdown: Record<string, number>;
    }>;
    getSalaryReport(month?: string, year?: string): Promise<{
        totalPayout: number;
        totalStaffPaid: number;
        records: {
            staffName: string;
            employeeCode: string;
            month: number;
            year: number;
            payableSalary: number;
            status: string;
        }[];
    }>;
}
