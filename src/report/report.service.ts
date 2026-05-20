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
    let totalOrders = orders.length;

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
        staff: { select: { name: true, employeeCode: true } }
      }
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
}
