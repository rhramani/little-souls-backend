import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AssignCustomerDto } from './dto/assign-customer.dto';
import { Prisma, UserType } from '@prisma/client';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async assignCustomer(dto: AssignCustomerDto) {
    // 1. Verify Sales Staff exists and is of correct role type
    const staffUser = await this.prisma.user.findUnique({
      where: { id: dto.salesStaffId },
    });

    if (!staffUser) {
      throw new NotFoundException(`Sales Staff user with ID '${dto.salesStaffId}' not found.`);
    }

    if (staffUser.userType !== UserType.STAFF && staffUser.userType !== UserType.SUPER_ADMIN) {
      throw new BadRequestException('User assigned must be a STAFF or SUPER_ADMIN role type.');
    }

    // 2. Verify Customer profile exists
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });

    if (!customer) {
      throw new NotFoundException(`Customer profile with ID '${dto.customerId}' not found.`);
    }

    // 3. Assign Staff representative
    return this.prisma.customer.update({
      where: { id: dto.customerId },
      data: {
        assignedSalesStaffId: dto.salesStaffId,
      },
      include: {
        assignedSalesStaff: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async getStaffPerformance(salesStaffId: string) {
    const staffUser = await this.prisma.user.findUnique({
      where: { id: salesStaffId },
      include: { staff: true },
    });

    if (!staffUser) {
      throw new NotFoundException(`Staff user with ID '${salesStaffId}' not found.`);
    }

    if (staffUser.userType !== UserType.STAFF && staffUser.userType !== UserType.SUPER_ADMIN) {
      throw new BadRequestException('Requested user is not a staff member.');
    }

    // 1. Count linked customer accounts
    const totalCustomersAssigned = await this.prisma.customer.count({
      where: { assignedSalesStaffId: salesStaffId },
    });

    // 2. Get active sales orders (exclude cancelled orders)
    const salesOrders = await this.prisma.order.findMany({
      where: {
        handledBySalesStaffId: salesStaffId,
        orderStatus: { not: 'CANCELLED' },
      },
      select: {
        id: true,
        grandTotal: true,
      },
    });

    const totalOrdersCount = salesOrders.length;
    let totalSalesVolume = new Prisma.Decimal(0);

    for (const order of salesOrders) {
      totalSalesVolume = totalSalesVolume.add(order.grandTotal);
    }

    const averageOrderValue = totalOrdersCount > 0 
      ? totalSalesVolume.div(totalOrdersCount) 
      : new Prisma.Decimal(0);

    // Sales commission rate: default 2.5% B2B wholesale incentive
    const commissionRatePercent = 2.5;
    const commissionEarned = totalSalesVolume.mul(commissionRatePercent / 100);

    return {
      staffId: salesStaffId,
      name: staffUser.staff?.name || staffUser.name,
      employeeCode: staffUser.staff?.employeeCode || null,
      designation: staffUser.staff?.designation || null,
      department: staffUser.staff?.department || null,
      totalCustomersAssigned,
      totalOrdersCount,
      totalSalesVolume,
      averageOrderValue,
      commissionRatePercent,
      commissionEarned,
    };
  }

  async getStaffLeaderboard() {
    // 1. Query all users of type STAFF or SUPER_ADMIN
    const staffUsers = await this.prisma.user.findMany({
      where: {
        userType: { in: [UserType.STAFF, UserType.SUPER_ADMIN] },
        isActive: true,
      },
      select: { id: true },
    });

    const leaderboardPromises = staffUsers.map((user) => 
      this.getStaffPerformance(user.id).catch(() => null),
    );

    const results = await Promise.all(leaderboardPromises);
    const validResults = results.filter(Boolean);

    // Sort by sales volume descending
    return validResults.sort((a, b) => {
      const volA = a?.totalSalesVolume || new Prisma.Decimal(0);
      const volB = b?.totalSalesVolume || new Prisma.Decimal(0);
      if (volA.gt(volB)) return -1;
      if (volA.lt(volB)) return 1;
      return 0;
    });
  }

  async findAssignedCustomers(salesStaffId: string) {
    return this.prisma.customer.findMany({
      where: { assignedSalesStaffId: salesStaffId },
      include: {
        contacts: true,
      },
    });
  }
}
