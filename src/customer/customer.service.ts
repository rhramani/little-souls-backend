import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryCustomerDto } from './dto/query-customer.dto';
import { ApproveCustomerDto } from './dto/approve-customer.dto';
import { RejectCustomerDto } from './dto/reject-customer.dto';
import { ApprovalStatus } from '@prisma/client';

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryCustomerDto) {
    const { page = 1, limit = 10, status, search } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    
    if (status) {
      where.approvalStatus = status;
    }
    
    if (search) {
      where.OR = [
        { businessName: { contains: search, mode: 'insensitive' } },
        { customerCode: { contains: search, mode: 'insensitive' } },
        { mainContactNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          contacts: true,
          pricingGroup: true,
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        contacts: true,
        pricingGroup: true,
        users: {
          select: { id: true, email: true, isActive: true },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    return customer;
  }

  async approve(id: string, dto: ApproveCustomerDto, adminId: string) {
    const customer = await this.findOne(id);

    if (customer.approvalStatus === ApprovalStatus.APPROVED) {
      throw new BadRequestException('Customer is already approved');
    }

    // Begin transaction to update customer and their main user
    return this.prisma.$transaction(async (tx) => {
      const updatedCustomer = await tx.customer.update({
        where: { id },
        data: {
          approvalStatus: ApprovalStatus.APPROVED,
          isActive: true,
          approvedBy: adminId,
          approvedAt: new Date(),
          ...(dto.pricingGroupId && { pricingGroupId: dto.pricingGroupId }),
        },
      });

      // Activate all users associated with this customer
      await tx.user.updateMany({
        where: { customerId: id },
        data: { isActive: true },
      });

      return updatedCustomer;
    });
  }

  async reject(id: string, dto: RejectCustomerDto, adminId: string) {
    const customer = await this.findOne(id);

    if (customer.approvalStatus === ApprovalStatus.REJECTED) {
      throw new BadRequestException('Customer is already rejected');
    }

    return this.prisma.customer.update({
      where: { id },
      data: {
        approvalStatus: ApprovalStatus.REJECTED,
        isActive: false,
        rejectionReason: dto.reason,
      },
    });
  }
}

