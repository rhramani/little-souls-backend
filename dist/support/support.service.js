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
exports.SupportService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
let SupportService = class SupportService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createTicket(dto, user) {
        const ticketNumber = `TKT-${Date.now().toString().slice(-8)}-${Math.floor(1000 + Math.random() * 9000)}`;
        const customerId = user.userType === client_1.UserType.CUSTOMER ? user.customerId : null;
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
    async transitionStatus(ticketId, status) {
        const ticket = await this.prisma.supportTicket.findUnique({
            where: { id: ticketId },
        });
        if (!ticket) {
            throw new common_1.NotFoundException(`Support ticket with ID '${ticketId}' not found.`);
        }
        const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
        if (!validStatuses.includes(status)) {
            throw new common_1.BadRequestException(`Invalid ticket status requested: '${status}'.`);
        }
        return this.prisma.supportTicket.update({
            where: { id: ticketId },
            data: { status },
        });
    }
    async updatePriority(ticketId, priority) {
        const ticket = await this.prisma.supportTicket.findUnique({
            where: { id: ticketId },
        });
        if (!ticket) {
            throw new common_1.NotFoundException(`Support ticket with ID '${ticketId}' not found.`);
        }
        const validPriorities = ['LOW', 'MEDIUM', 'HIGH'];
        if (!validPriorities.includes(priority)) {
            throw new common_1.BadRequestException(`Invalid ticket priority requested: '${priority}'.`);
        }
        return this.prisma.supportTicket.update({
            where: { id: ticketId },
            data: { priority },
        });
    }
    async assignTicket(ticketId, assignedTo) {
        const ticket = await this.prisma.supportTicket.findUnique({
            where: { id: ticketId },
        });
        if (!ticket) {
            throw new common_1.NotFoundException(`Support ticket with ID '${ticketId}' not found.`);
        }
        const assignedUser = await this.prisma.user.findUnique({
            where: { id: assignedTo },
        });
        if (!assignedUser) {
            throw new common_1.NotFoundException(`Assigned user representative with ID '${assignedTo}' not found.`);
        }
        if (assignedUser.userType !== client_1.UserType.STAFF &&
            assignedUser.userType !== client_1.UserType.SUPER_ADMIN) {
            throw new common_1.BadRequestException('Tickets can only be assigned to STAFF or SUPER_ADMIN users.');
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
    async findAll(query, user) {
        const { page = 1, limit = 10, status, priority } = query;
        const skip = (page - 1) * limit;
        const where = {};
        if (user.userType === client_1.UserType.CUSTOMER) {
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
    async findOne(ticketId, user) {
        const ticket = await this.prisma.supportTicket.findUnique({
            where: { id: ticketId },
            include: {
                customer: true,
                user: { select: { id: true, name: true, email: true } },
                assignedUser: { select: { id: true, name: true, email: true } },
            },
        });
        if (!ticket) {
            throw new common_1.NotFoundException(`Support ticket with ID '${ticketId}' not found.`);
        }
        if (user.userType === client_1.UserType.CUSTOMER &&
            ticket.customerId !== user.customerId) {
            throw new common_1.ForbiddenException('You do not have permission to access this support ticket.');
        }
        return ticket;
    }
};
exports.SupportService = SupportService;
exports.SupportService = SupportService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SupportService);
//# sourceMappingURL=support.service.js.map