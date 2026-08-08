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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let ReportService = class ReportService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getSalesReport(startDate, endDate) {
        const where = {};
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate)
                where.createdAt.gte = new Date(startDate);
            if (endDate)
                where.createdAt.lte = new Date(endDate);
        }
        const orders = await this.prisma.order.findMany({
            where,
            select: {
                grandTotal: true,
                createdAt: true,
                orderStatus: true,
                orderSource: true,
                taxTotal: true,
                shippingCharge: true,
            },
        });
        const dailyData = {};
        orders.forEach((order) => {
            if (order.orderStatus === 'CANCELLED')
                return;
            const dateStr = order.createdAt.toISOString().split('T')[0];
            if (!dailyData[dateStr]) {
                dailyData[dateStr] = {
                    date: dateStr,
                    sales: 0,
                    orders: 0,
                    posSales: 0,
                    wholesaleSales: 0,
                    tax: 0,
                    shipping: 0,
                };
            }
            const item = dailyData[dateStr];
            const amt = Number(order.grandTotal) || 0;
            item.sales += amt;
            item.orders += 1;
            if (order.orderSource === 'POS') {
                item.posSales += amt;
            }
            else {
                item.wholesaleSales += amt;
            }
            item.tax += Number(order.taxTotal) || 0;
            item.shipping += Number(order.shippingCharge) || 0;
        });
        const sales = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));
        let totalRevenue = 0;
        let totalOrders = 0;
        sales.forEach((s) => {
            totalRevenue += s.sales;
            totalOrders += s.orders;
        });
        return {
            totalOrders,
            totalRevenue,
            sales,
            dateRange: { startDate, endDate },
        };
    }
    async getOutstandingBalances() {
        const customers = await this.prisma.customer.findMany({
            where: {
                currentBalance: { gt: 0 },
            },
            select: {
                id: true,
                businessName: true,
                currentBalance: true,
            },
            orderBy: { currentBalance: 'desc' },
            take: 50,
        });
        let totalOutstanding = 0;
        customers.forEach((c) => {
            totalOutstanding += Number(c.currentBalance);
        });
        return {
            totalOutstanding,
            topDefaulters: customers,
        };
    }
    async getAttendanceReport(startDate, endDate) {
        const where = {};
        if (startDate || endDate) {
            where.attendanceDate = {};
            if (startDate)
                where.attendanceDate.gte = new Date(startDate);
            if (endDate)
                where.attendanceDate.lte = new Date(endDate);
        }
        const records = await this.prisma.attendanceRecord.findMany({
            where,
            include: {
                staff: { select: { name: true, employeeCode: true } },
            },
        });
        const summary = {
            PRESENT: 0,
            ABSENT: 0,
            HALF_DAY: 0,
            LEAVE: 0,
        };
        records.forEach((r) => {
            if (summary[r.status] !== undefined) {
                summary[r.status]++;
            }
        });
        return {
            summary,
            totalRecords: records.length,
        };
    }
    async getProductPerformance(startDate, endDate) {
        const where = {};
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate)
                where.createdAt.gte = new Date(startDate);
            if (endDate)
                where.createdAt.lte = new Date(endDate);
        }
        const orderItems = await this.prisma.orderItem.findMany({
            where: { order: where },
            include: {
                product: {
                    select: {
                        name: true,
                        sku: true,
                        stockQuantity: true,
                        productPrice: true,
                    },
                },
            },
        });
        const productMap = new Map();
        orderItems.forEach((item) => {
            const pid = item.productId;
            if (!productMap.has(pid)) {
                productMap.set(pid, {
                    id: pid,
                    name: item.product?.name || 'Unknown',
                    sku: item.product?.sku || 'N/A',
                    quantitySold: 0,
                    revenue: 0,
                    stock: item.product?.stockQuantity || 0,
                    price: item.product?.productPrice || 0,
                });
            }
            const data = productMap.get(pid);
            data.quantitySold += item.quantity;
            data.revenue += Number(item.lineTotal);
        });
        const products = Array.from(productMap.values()).sort((a, b) => b.quantitySold - a.quantitySold);
        return {
            topPerforming: products.slice(0, 10),
            bottomPerforming: products.slice(-10).reverse(),
            products,
            all: products,
        };
    }
    async getCustomersReport(startDate, endDate) {
        const where = {};
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate)
                where.createdAt.gte = new Date(startDate);
            if (endDate)
                where.createdAt.lte = new Date(endDate);
        }
        const customers = await this.prisma.customer.findMany({
            where,
            include: {
                _count: { select: { orders: true } },
                orders: {
                    where: { orderStatus: { not: 'CANCELLED' } },
                    select: { grandTotal: true },
                },
                contacts: {
                    where: { isPrimary: true },
                    select: { name: true },
                },
            },
        });
        return customers
            .map((c) => {
            let totalSpent = 0;
            c.orders.forEach((o) => {
                totalSpent += Number(o.grandTotal) || 0;
            });
            return {
                id: c.id,
                name: c.contacts[0]?.name || c.businessName || 'Walk-In Customer',
                businessName: c.businessName || 'Direct B2C / Retail',
                gstin: c.gstin || 'N/A',
                ordersCount: c._count.orders,
                totalSpent,
                outstanding: Number(c.currentBalance) || 0,
                currentBalance: Number(c.currentBalance) || 0,
            };
        })
            .sort((a, b) => b.ordersCount - a.ordersCount);
    }
    async getOrdersReport(startDate, endDate) {
        const where = {};
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate)
                where.createdAt.gte = new Date(startDate);
            if (endDate)
                where.createdAt.lte = new Date(endDate);
        }
        const orders = await this.prisma.order.findMany({
            where,
            select: { orderStatus: true, grandTotal: true },
        });
        const statusBreakdown = {};
        orders.forEach((o) => {
            if (!statusBreakdown[o.orderStatus])
                statusBreakdown[o.orderStatus] = { count: 0, value: 0 };
            statusBreakdown[o.orderStatus].count++;
            statusBreakdown[o.orderStatus].value += Number(o.grandTotal);
        });
        return {
            totalOrders: orders.length,
            statusBreakdown,
        };
    }
    async getPackingReport(startDate, endDate) {
        const where = {};
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate)
                where.createdAt.gte = new Date(startDate);
            if (endDate)
                where.createdAt.lte = new Date(endDate);
        }
        const packingSlips = await this.prisma.packingSlip.findMany({
            where,
            select: { status: true },
        });
        const statusBreakdown = {};
        packingSlips.forEach((p) => {
            statusBreakdown[p.status] = (statusBreakdown[p.status] || 0) + 1;
        });
        return {
            totalSlips: packingSlips.length,
            statusBreakdown,
        };
    }
    async getSalaryReport(month, year) {
        const where = {};
        if (month)
            where.salaryMonth = month;
        if (year)
            where.salaryYear = year;
        const payrolls = await this.prisma.payroll.findMany({
            where,
            include: { staff: { select: { name: true, employeeCode: true } } },
        });
        let totalPayout = 0;
        const records = payrolls.map((p) => {
            totalPayout += Number(p.payableSalary);
            return {
                staffName: p.staff?.name,
                employeeCode: p.staff?.employeeCode,
                month: p.salaryMonth,
                year: p.salaryYear,
                payableSalary: Number(p.payableSalary),
                status: p.paymentStatus,
            };
        });
        return {
            totalPayout,
            totalStaffPaid: records.length,
            records,
        };
    }
};
exports.ReportService = ReportService;
exports.ReportService = ReportService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ReportService);
//# sourceMappingURL=report.service.js.map