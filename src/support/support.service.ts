import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { QueryTicketDto } from './dto/query-ticket.dto';
import { UserType } from '@prisma/client';

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  async createTicket(dto: CreateTicketDto, user: any) {
    const ticketNumber = `TKT-${Date.now().toString().slice(-8)}-${Math.floor(1000 + Math.random() * 9000)}`;
    const customerId =
      user.userType === UserType.CUSTOMER ? user.customerId : null;

    return this.prisma.supportTicket.create({
      data: {
        ticketNumber,
        customerId,
        userId: user.id,
        subject: dto.subject,
        message: dto.message,
        status: 'OPEN',
        priority: dto.priority || 'MEDIUM',
      },
      include: {
        customer: {
          select: { businessName: true, customerCode: true },
        },
        user: {
          select: { name: true, email: true },
        },
      },
    });
  }

  async transitionStatus(ticketId: string, status: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException(
        `Support ticket with ID '${ticketId}' not found.`,
      );
    }

    const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException(
        `Invalid ticket status requested: '${status}'.`,
      );
    }

    return this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status },
    });
  }

  async updatePriority(ticketId: string, priority: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException(
        `Support ticket with ID '${ticketId}' not found.`,
      );
    }

    const validPriorities = ['LOW', 'MEDIUM', 'HIGH'];
    if (!validPriorities.includes(priority)) {
      throw new BadRequestException(
        `Invalid ticket priority requested: '${priority}'.`,
      );
    }

    return this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { priority },
    });
  }

  async assignTicket(ticketId: string, assignedTo: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException(
        `Support ticket with ID '${ticketId}' not found.`,
      );
    }

    // Verify assigned user exists and is staff/admin
    const assignedUser = await this.prisma.user.findUnique({
      where: { id: assignedTo },
    });

    if (!assignedUser) {
      throw new NotFoundException(
        `Assigned user representative with ID '${assignedTo}' not found.`,
      );
    }

    if (
      assignedUser.userType !== UserType.STAFF &&
      assignedUser.userType !== UserType.SUPER_ADMIN
    ) {
      throw new BadRequestException(
        'Tickets can only be assigned to STAFF or SUPER_ADMIN users.',
      );
    }

    return this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { assignedTo },
      include: {
        assignedUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async findAll(query: QueryTicketDto, user: any) {
    const { page = 1, limit = 10, status, priority } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    // Customer Isolation Guard
    if (user.userType === UserType.CUSTOMER) {
      where.customerId = user.customerId;
    }

    if (status) {
      where.status = status;
    }

    if (priority) {
      where.priority = priority;
    }

    const [tickets, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: { businessName: true, customerCode: true },
          },
          user: {
            select: { name: true, email: true },
          },
          assignedUser: {
            select: { name: true },
          },
        },
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    return {
      tickets,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(ticketId: string, user: any) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        customer: true,
        user: { select: { id: true, name: true, email: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
      },
    });

    if (!ticket) {
      throw new NotFoundException(
        `Support ticket with ID '${ticketId}' not found.`,
      );
    }

    // Customer Access Isolation Guard
    if (
      user.userType === UserType.CUSTOMER &&
      ticket.customerId !== user.customerId
    ) {
      throw new ForbiddenException(
        'You do not have permission to access this support ticket.',
      );
    }

    return ticket;
  }
}
