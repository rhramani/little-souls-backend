import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  async getSalesReport(startDate?: string, endDate?: string) {
    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const orders = await this.prisma.order.findMany({
      where,
      select: { grandTotal: true, createdAt: true, orderStatus: true },
    });

    let totalRevenue = 0;
    const totalOrders = orders.length;

    orders.forEach((order) => {
      if (order.orderStatus !== 'CANCELLED') {
        totalRevenue += Number(order.grandTotal);
      }
    });

    return {
      totalOrders,
      totalRevenue,
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

  async getAttendanceReport(startDate?: string, endDate?: string) {
    const where: any = {};
    if (startDate || endDate) {
      where.attendanceDate = {};
      if (startDate) where.attendanceDate.gte = new Date(startDate);
      if (endDate) where.attendanceDate.lte = new Date(endDate);
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

  async getProductPerformance(startDate?: string, endDate?: string) {
    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const orderItems = await this.prisma.orderItem.findMany({
      where: { order: where },
      include: { product: { select: { name: true, sku: true } } },
    });

    const productMap = new Map<
      string,
      { name: string; sku: string; quantitySold: number; revenue: number }
    >();
    orderItems.forEach((item) => {
      const pid = item.productId;
      if (!productMap.has(pid)) {
        productMap.set(pid, {
          name: item.product?.name || 'Unknown',
          sku: item.product?.sku || 'N/A',
          quantitySold: 0,
          revenue: 0,
        });
      }
      const data = productMap.get(pid)!;
      data.quantitySold += item.quantity;
      data.revenue += Number(item.lineTotal);
    });

    const products = Array.from(productMap.values()).sort(
      (a, b) => b.quantitySold - a.quantitySold,
    );

    return {
      topPerforming: products.slice(0, 10),
      bottomPerforming: products.slice(-10).reverse(),
      all: products,
    };
  }

  async getCustomersReport(startDate?: string, endDate?: string) {
    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const customers = await this.prisma.customer.findMany({
      where,
      include: {
        _count: { select: { orders: true } },
      },
    });

    return customers
      .map((c) => ({
        id: c.id,
        businessName: c.businessName,
        customerCode: c.customerCode,
        ordersCount: c._count.orders,
        currentBalance: Number(c.currentBalance),
      }))
      .sort((a, b) => b.ordersCount - a.ordersCount);
  }

  async getOrdersReport(startDate?: string, endDate?: string) {
    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const orders = await this.prisma.order.findMany({
      where,
      select: { orderStatus: true, grandTotal: true },
    });

    const statusBreakdown: Record<string, { count: number; value: number }> =
      {};
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

  async getPackingReport(startDate?: string, endDate?: string) {
    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const packingSlips = await this.prisma.packingSlip.findMany({
      where,
      select: { status: true },
    });

    const statusBreakdown: Record<string, number> = {};
    packingSlips.forEach((p) => {
      statusBreakdown[p.status] = (statusBreakdown[p.status] || 0) + 1;
    });

    return {
      totalSlips: packingSlips.length,
      statusBreakdown,
    };
  }

  async getSalaryReport(month?: number, year?: number) {
    const where: any = {};
    if (month) where.salaryMonth = month;
    if (year) where.salaryYear = year;

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
}
