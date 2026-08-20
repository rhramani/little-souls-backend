"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const client_2 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const crypto = __importStar(require("crypto"));
const email_service_1 = require("../common/email.service");
const events_gateway_1 = require("../events/events.gateway");
let CustomerService = class CustomerService {
    prisma;
    emailService;
    eventsGateway;
    constructor(prisma, emailService, eventsGateway) {
        this.prisma = prisma;
        this.emailService = emailService;
        this.eventsGateway = eventsGateway;
    }
    async create(dto, adminId) {
        const existingUser = await this.prisma.user.findFirst({
            where: {
                OR: [
                    { mobile: dto.mobile },
                    dto.email ? { email: dto.email } : undefined,
                ].filter((x) => x !== undefined),
            },
        });
        if (existingUser) {
            throw new common_1.ConflictException('A user with this email or mobile number already exists');
        }
        const cleanGstin = dto.gstin && typeof dto.gstin === 'string' && dto.gstin.trim()
            ? dto.gstin.trim().toUpperCase()
            : null;
        if (cleanGstin) {
            const existingCustomer = await this.prisma.customer.findFirst({
                where: { gstin: { equals: cleanGstin, mode: 'insensitive' } },
            });
            if (existingCustomer) {
                throw new common_1.ConflictException(`GSTIN "${cleanGstin}" is already registered with customer "${existingCustomer.businessName}"`);
            }
        }
        const plainPassword = crypto.randomBytes(6).toString('hex');
        const passwordHash = await bcrypt.hash(plainPassword, 10);
        let parsedCreditLimit = null;
        if (dto.creditLimit !== undefined &&
            dto.creditLimit !== null &&
            dto.creditLimit !== '') {
            const parsed = Number(dto.creditLimit);
            parsedCreditLimit = isNaN(parsed) ? null : parsed;
        }
        const result = await this.prisma.$transaction(async (tx) => {
            let codeToAssign = dto.customerCode;
            if (!codeToAssign) {
                const customers = await tx.customer.findMany({
                    where: { customerCode: { startsWith: 'LS-C-' } },
                    select: { customerCode: true },
                });
                let nextNumber = 1;
                const numbers = customers
                    .map((c) => {
                    const match = c.customerCode?.match(/^LS-C-(\d+)$/);
                    return match ? parseInt(match[1], 10) : null;
                })
                    .filter((n) => n !== null);
                if (numbers.length > 0) {
                    nextNumber = Math.max(...numbers) + 1;
                }
                codeToAssign = `LS-C-${String(nextNumber).padStart(4, '0')}`;
            }
            const customer = await tx.customer.create({
                data: {
                    businessName: dto.businessName,
                    businessType: dto.businessType,
                    gstin: cleanGstin,
                    billingAddressLine1: dto.billingAddressLine1,
                    billingAddressLine2: dto.billingAddressLine2,
                    billingCity: dto.billingCity,
                    billingState: dto.billingState,
                    billingPincode: dto.billingPincode,
                    billingCountry: dto.billingCountry,
                    shippingAddressLine1: dto.shippingAddressLine1,
                    shippingAddressLine2: dto.shippingAddressLine2,
                    shippingCity: dto.shippingCity,
                    shippingState: dto.shippingState,
                    shippingPincode: dto.shippingPincode,
                    shippingCountry: dto.shippingCountry,
                    storePhotoUrl: dto.storePhotoUrl,
                    customerSource: dto.customerSource,
                    mainContactNumber: dto.mainContactNumber || dto.mobile,
                    pricingGroupId: dto.pricingGroupId,
                    approvalStatus: client_1.ApprovalStatus.APPROVED,
                    approvedBy: adminId,
                    approvedAt: new Date(),
                    isActive: true,
                    creditLimit: parsedCreditLimit,
                    customerCode: codeToAssign,
                },
            });
            const contact = await tx.customerContact.create({
                data: {
                    customerId: customer.id,
                    name: dto.name,
                    mobile: dto.mobile,
                    email: dto.email,
                    designation: dto.designation || 'Owner',
                    whatsappNumber: dto.whatsapp,
                    loginAccess: true,
                    isPrimary: true,
                    isActive: true,
                    canPlaceOrder: true,
                    canViewLedger: true,
                    canDownloadInvoice: true,
                },
            });
            const user = await tx.user.create({
                data: {
                    name: dto.name,
                    email: dto.email,
                    mobile: dto.mobile,
                    passwordHash,
                    plainPassword,
                    userType: client_1.UserType.CUSTOMER,
                    customerId: customer.id,
                    customerContactId: contact.id,
                    isActive: true,
                    isVerified: false,
                },
            });
            let customerRole = await tx.role.findUnique({
                where: { name: 'Customer' },
            });
            if (!customerRole) {
                customerRole = await tx.role.create({
                    data: {
                        name: 'Customer',
                        description: 'Default role for registered customers',
                        isSystemRole: true,
                    },
                });
            }
            await tx.userRole.create({
                data: {
                    userId: user.id,
                    roleId: customerRole.id,
                },
            });
            return { customer, contact, user };
        });
        if (result.contact.email) {
            await this.emailService.sendCustomerCredentials(result.contact.email, result.contact.name || 'Customer', plainPassword, {
                businessName: result.customer.businessName,
                gstin: result.customer.gstin,
                mobile: result.contact.mobile || result.customer.mainContactNumber,
                customerCode: result.customer.customerCode,
            });
        }
        this.eventsGateway.emitCustomerRegistered(result.customer);
        return this.findOne(result.customer.id);
    }
    async findAll(query) {
        const { page = 1, limit = 10, search, status } = query;
        const skip = (page - 1) * limit;
        const where = {};
        if (search) {
            where.OR = [
                { businessName: { contains: search, mode: 'insensitive' } },
                { customerCode: { contains: search, mode: 'insensitive' } },
                { gstin: { contains: search, mode: 'insensitive' } },
                { mainContactNumber: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (status) {
            where.approvalStatus = status;
        }
        const [customers, total] = await Promise.all([
            this.prisma.customer.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    contacts: { where: { isPrimary: true }, take: 1 },
                    pricingGroup: { select: { name: true, code: true } },
                    assignedSalesStaff: { select: { id: true, name: true } },
                    users: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            mobile: true,
                            plainPassword: true,
                        },
                    },
                },
            }),
            this.prisma.customer.count({ where }),
        ]);
        const customerIds = customers.map((c) => c.id);
        const [ledgerGrouped, ordersGrouped, paymentsGrouped, paidInvoicesGrouped, completedLedgerInvoicesGrouped, pendingDebitsGrouped,] = customerIds.length > 0
            ? await Promise.all([
                this.prisma.ledgerEntry.groupBy({
                    by: ['customerId'],
                    where: {
                        customerId: { in: customerIds },
                        transactionStatus: { notIn: ['CANCELLED', 'VOIDED'] },
                    },
                    _sum: { debit: true, credit: true },
                }),
                this.prisma.order.groupBy({
                    by: ['customerId'],
                    where: {
                        customerId: { in: customerIds },
                        orderStatus: { in: ['APPROVED', 'PACKED', 'SHIPPED', 'DELIVERED'] },
                    },
                    _sum: { grandTotal: true },
                }),
                this.prisma.payment.groupBy({
                    by: ['customerId'],
                    where: {
                        customerId: { in: customerIds },
                        paymentStatus: { in: ['VERIFIED', 'COMPLETED'] },
                    },
                    _sum: { amount: true },
                }),
                this.prisma.invoice.groupBy({
                    by: ['customerId'],
                    where: {
                        customerId: { in: customerIds },
                        paymentStatus: 'PAID',
                    },
                    _sum: { grandTotal: true },
                }),
                this.prisma.ledgerEntry.groupBy({
                    by: ['customerId'],
                    where: {
                        customerId: { in: customerIds },
                        entryType: 'INVOICE',
                        transactionStatus: { in: ['COMPLETED', 'VERIFIED'] },
                    },
                    _sum: { debit: true },
                }),
                this.prisma.ledgerEntry.groupBy({
                    by: ['customerId'],
                    where: {
                        customerId: { in: customerIds },
                        entryType: { in: ['INVOICE', 'OPENING_BALANCE'] },
                        debit: { gt: 0 },
                        transactionStatus: 'PENDING',
                    },
                    _sum: { debit: true },
                }),
            ])
            : [[], [], [], [], [], []];
        const ledgerMap = new Map(ledgerGrouped.map((g) => [g.customerId, { debit: g._sum.debit || 0, credit: g._sum.credit || 0 }]));
        const ordersMap = new Map(ordersGrouped.map((g) => [g.customerId, g._sum.grandTotal || 0]));
        const paymentsMap = new Map(paymentsGrouped.map((g) => [g.customerId, g._sum.amount || 0]));
        const paidInvoicesMap = new Map(paidInvoicesGrouped.map((g) => [g.customerId, g._sum.grandTotal || 0]));
        const completedLedgerInvoicesMap = new Map(completedLedgerInvoicesGrouped.map((g) => [g.customerId, g._sum.debit || 0]));
        const pendingInvoicesMap = new Map(pendingDebitsGrouped.map((g) => [g.customerId, g._sum.debit || 0]));
        const customersWithMetrics = customers.map((c) => {
            const l = ledgerMap.get(c.id) || { debit: 0, credit: 0 };
            const approvedOrdersTotal = ordersMap.get(c.id) || 0;
            const verifiedPaymentsTotal = paymentsMap.get(c.id) || 0;
            const paidInvoicesTotal = Math.max(paidInvoicesMap.get(c.id) || 0, completedLedgerInvoicesMap.get(c.id) || 0);
            const openBal = c.openingBalance || 0;
            const totalAmount = Math.max(l.debit, approvedOrdersTotal + openBal);
            const directPaymentsReceived = Math.max(l.credit, verifiedPaymentsTotal);
            const amountReceived = Math.min(totalAmount, Math.max(directPaymentsReceived, paidInvoicesTotal));
            const pendingAmount = Math.max(0, totalAmount - amountReceived);
            return {
                ...c,
                totalAmount,
                amountReceived,
                pendingAmount,
            };
        });
        return {
            customers: customersWithMetrics,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    }
    async findOne(id) {
        const customer = await this.prisma.customer.findUnique({
            where: { id },
            include: {
                contacts: true,
                pricingGroup: true,
                assignedSalesStaff: {
                    select: { id: true, name: true, email: true, mobile: true },
                },
                approvedByUser: { select: { id: true, name: true } },
                users: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        mobile: true,
                        plainPassword: true,
                    },
                },
            },
        });
        if (!customer) {
            throw new common_1.NotFoundException(`Customer with ID '${id}' not found.`);
        }
        return customer;
    }
    async update(id, dto) {
        const customer = await this.findOne(id);
        const { name, email, mobile, designation, whatsapp, creditLimit, customerCode, gstin, ...customerData } = dto;
        if (customerCode !== undefined && customerCode !== customer.customerCode) {
            if (customerCode) {
                const existingCode = await this.prisma.customer.findFirst({
                    where: {
                        customerCode: { equals: customerCode, mode: 'insensitive' },
                        id: { not: id },
                    },
                });
                if (existingCode) {
                    throw new common_1.ConflictException('Customer Code is already in use by another account');
                }
            }
        }
        let cleanGstin = undefined;
        if (gstin !== undefined) {
            cleanGstin =
                gstin && typeof gstin === 'string' && gstin.trim()
                    ? gstin.trim().toUpperCase()
                    : null;
            if (cleanGstin && cleanGstin !== customer.gstin) {
                const existingGstinCustomer = await this.prisma.customer.findFirst({
                    where: {
                        gstin: { equals: cleanGstin, mode: 'insensitive' },
                        id: { not: id },
                    },
                });
                if (existingGstinCustomer) {
                    throw new common_1.ConflictException(`GSTIN "${cleanGstin}" is already registered with customer "${existingGstinCustomer.businessName}" (${existingGstinCustomer.customerCode || existingGstinCustomer.id}).`);
                }
            }
        }
        let parsedCreditLimit = undefined;
        if (creditLimit !== undefined) {
            if (creditLimit === '' || creditLimit === null) {
                parsedCreditLimit = null;
            }
            else {
                const parsed = Number(creditLimit);
                parsedCreditLimit = isNaN(parsed) ? null : parsed;
            }
        }
        return this.prisma.$transaction(async (tx) => {
            const updatePayload = { ...customerData };
            if (parsedCreditLimit !== undefined) {
                updatePayload.creditLimit = parsedCreditLimit;
            }
            if (customerCode !== undefined) {
                updatePayload.customerCode = customerCode || null;
            }
            if (cleanGstin !== undefined) {
                updatePayload.gstin = cleanGstin;
            }
            const updatedCustomer = await tx.customer.update({
                where: { id },
                data: updatePayload,
            });
            if (name !== undefined ||
                email !== undefined ||
                mobile !== undefined ||
                designation !== undefined ||
                whatsapp !== undefined) {
                const primaryContact = customer.contacts.find((c) => c.isPrimary) || customer.contacts[0];
                if (primaryContact) {
                    await tx.customerContact.update({
                        where: { id: primaryContact.id },
                        data: {
                            name: name !== undefined ? name : undefined,
                            email: email !== undefined ? email : undefined,
                            mobile: mobile !== undefined ? mobile : undefined,
                            designation: designation !== undefined ? designation : undefined,
                            whatsappNumber: whatsapp !== undefined ? whatsapp : undefined,
                        },
                    });
                    if (name !== undefined ||
                        email !== undefined ||
                        mobile !== undefined) {
                        const user = await tx.user.findFirst({ where: { customerId: id } });
                        if (user) {
                            await tx.user.update({
                                where: { id: user.id },
                                data: {
                                    name: name !== undefined ? name : undefined,
                                    email: email !== undefined ? email : undefined,
                                    mobile: mobile !== undefined ? mobile : undefined,
                                },
                            });
                        }
                    }
                }
            }
            return updatedCustomer;
        });
        return this.findOne(id);
    }
    async approve(id, dto, adminId) {
        const customer = await this.findOne(id);
        if (customer.approvalStatus === client_1.ApprovalStatus.APPROVED) {
            return customer;
        }
        const plainPassword = crypto.randomBytes(6).toString('hex');
        const passwordHash = await bcrypt.hash(plainPassword, 10);
        await this.prisma.$transaction(async (tx) => {
            let codeToAssign = customer.customerCode;
            if (!codeToAssign) {
                const customers = await tx.customer.findMany({
                    where: { customerCode: { startsWith: 'LS-C-' } },
                    select: { customerCode: true },
                });
                let nextNumber = 1;
                const numbers = customers
                    .map((c) => {
                    const match = c.customerCode?.match(/^LS-C-(\d+)$/);
                    return match ? parseInt(match[1], 10) : null;
                })
                    .filter((n) => n !== null);
                if (numbers.length > 0) {
                    nextNumber = Math.max(...numbers) + 1;
                }
                codeToAssign = `LS-C-${String(nextNumber).padStart(4, '0')}`;
            }
            await tx.customer.update({
                where: { id },
                data: {
                    approvalStatus: client_1.ApprovalStatus.APPROVED,
                    approvedBy: adminId,
                    approvedAt: new Date(),
                    isActive: true,
                    pricingGroupId: dto.pricingGroupId ?? customer.pricingGroupId,
                    customerCode: codeToAssign,
                },
            });
            const user = await tx.user.findFirst({ where: { customerId: id } });
            if (user) {
                await tx.user.update({
                    where: { id: user.id },
                    data: {
                        isActive: true,
                        passwordHash: passwordHash,
                        plainPassword: plainPassword,
                    },
                });
            }
        });
        const primaryContact = customer.contacts.find((c) => c.isPrimary) || customer.contacts[0];
        if (primaryContact && primaryContact.email) {
            await this.emailService.sendCustomerCredentials(primaryContact.email, primaryContact.name || 'Customer', plainPassword, {
                businessName: customer.businessName,
                gstin: customer.gstin,
                mobile: primaryContact.mobile || customer.mainContactNumber,
                customerCode: customer.customerCode,
            });
        }
        this.eventsGateway.emitCustomerStatusChanged(id, client_1.ApprovalStatus.APPROVED);
        return this.findOne(id);
    }
    async reject(id, dto, adminId) {
        const customer = await this.findOne(id);
        if (customer.approvalStatus === client_1.ApprovalStatus.REJECTED) {
            throw new common_1.BadRequestException('Customer is already rejected.');
        }
        const updated = await this.prisma.customer.update({
            where: { id },
            data: {
                approvalStatus: client_1.ApprovalStatus.REJECTED,
                approvedBy: adminId,
                approvedAt: new Date(),
                isActive: false,
                rejectionReason: dto.reason,
            },
        });
        this.eventsGateway.emitCustomerStatusChanged(id, client_1.ApprovalStatus.REJECTED);
        return updated;
    }
    async deactivate(id) {
        await this.findOne(id);
        return this.prisma.customer.update({
            where: { id },
            data: { isActive: false },
        });
    }
    async activate(id) {
        const customer = await this.findOne(id);
        if (customer.approvalStatus !== client_1.ApprovalStatus.APPROVED) {
            throw new common_1.BadRequestException('Cannot activate a customer that is not approved.');
        }
        return this.prisma.customer.update({
            where: { id },
            data: { isActive: true },
        });
    }
    async remove(id) {
        await this.findOne(id);
        try {
            return await this.prisma.$transaction(async (tx) => {
                const [linkedUsers, contacts] = await Promise.all([
                    tx.user.findMany({ where: { customerId: id } }),
                    tx.customerContact.findMany({ where: { customerId: id } }),
                ]);
                const userIds = linkedUsers.map((u) => u.id);
                const contactIds = contacts.map((c) => c.id);
                const contactCleanups = [];
                if (contactIds.length > 0) {
                    contactCleanups.push(tx.user.updateMany({
                        where: { customerContactId: { in: contactIds } },
                        data: { customerContactId: null },
                    }), tx.cart.updateMany({
                        where: { customerContactId: { in: contactIds } },
                        data: { customerContactId: null },
                    }), tx.order.updateMany({
                        where: { customerContactId: { in: contactIds } },
                        data: { customerContactId: null },
                    }));
                }
                contactCleanups.push(tx.customerActivitySession.deleteMany({
                    where: {
                        OR: [
                            { customerId: id },
                            ...(userIds.length > 0 ? [{ userId: { in: userIds } }] : []),
                        ],
                    },
                }));
                await Promise.all(contactCleanups);
                if (userIds.length > 0) {
                    await Promise.all([
                        tx.userRole.deleteMany({ where: { userId: { in: userIds } } }),
                        tx.userSession.deleteMany({ where: { userId: { in: userIds } } }),
                        tx.passwordResetToken.deleteMany({
                            where: { userId: { in: userIds } },
                        }),
                        tx.notification.deleteMany({
                            where: { userId: { in: userIds } },
                        }),
                        tx.supportTicket.updateMany({
                            where: { userId: { in: userIds } },
                            data: { userId: null },
                        }),
                        tx.supportTicket.updateMany({
                            where: { assignedTo: { in: userIds } },
                            data: { assignedTo: null },
                        }),
                        tx.orderStatusHistory.updateMany({
                            where: { changedBy: { in: userIds } },
                            data: { changedBy: null },
                        }),
                        tx.order.updateMany({
                            where: { cancelledBy: { in: userIds } },
                            data: { cancelledBy: null },
                        }),
                        tx.order.updateMany({
                            where: { approvedBy: { in: userIds } },
                            data: { approvedBy: null },
                        }),
                        tx.order.updateMany({
                            where: { handledBySalesStaffId: { in: userIds } },
                            data: { handledBySalesStaffId: null },
                        }),
                        tx.backorderApproval.updateMany({
                            where: { requestedBy: { in: userIds } },
                            data: { requestedBy: null },
                        }),
                        tx.backorderApproval.updateMany({
                            where: { approvedBy: { in: userIds } },
                            data: { approvedBy: null },
                        }),
                        tx.packingSlip.updateMany({
                            where: { packedBy: { in: userIds } },
                            data: { packedBy: null },
                        }),
                        tx.shipment.updateMany({
                            where: { createdBy: { in: userIds } },
                            data: { createdBy: null },
                        }),
                        tx.invoice.updateMany({
                            where: { createdBy: { in: userIds } },
                            data: { createdBy: null },
                        }),
                        tx.payment.updateMany({
                            where: { verifiedBy: { in: userIds } },
                            data: { verifiedBy: null },
                        }),
                        tx.payment.updateMany({
                            where: { receivedBy: { in: userIds } },
                            data: { receivedBy: null },
                        }),
                        tx.ledgerEntry.updateMany({
                            where: { createdBy: { in: userIds } },
                            data: { createdBy: null },
                        }),
                        tx.stockMovement.updateMany({
                            where: { createdBy: { in: userIds } },
                            data: { createdBy: null },
                        }),
                        tx.attendanceRecord.updateMany({
                            where: { approvedBy: { in: userIds } },
                            data: { approvedBy: null },
                        }),
                        tx.leaveRequest.updateMany({
                            where: { approvedBy: { in: userIds } },
                            data: { approvedBy: null },
                        }),
                        tx.payroll.updateMany({
                            where: { paidBy: { in: userIds } },
                            data: { paidBy: null },
                        }),
                        tx.savedReport.updateMany({
                            where: { createdBy: { in: userIds } },
                            data: { createdBy: null },
                        }),
                        tx.category.updateMany({
                            where: { createdBy: { in: userIds } },
                            data: { createdBy: null },
                        }),
                        tx.category.updateMany({
                            where: { updatedBy: { in: userIds } },
                            data: { updatedBy: null },
                        }),
                        tx.product.updateMany({
                            where: { createdBy: { in: userIds } },
                            data: { createdBy: null },
                        }),
                        tx.product.updateMany({
                            where: { updatedBy: { in: userIds } },
                            data: { updatedBy: null },
                        }),
                        tx.productImage.updateMany({
                            where: { createdBy: { in: userIds } },
                            data: { createdBy: null },
                        }),
                        tx.imageCleaningTask.updateMany({
                            where: { createdBy: { in: userIds } },
                            data: { createdBy: null },
                        }),
                        tx.productCatalogFile.updateMany({
                            where: { createdBy: { in: userIds } },
                            data: { createdBy: null },
                        }),
                        tx.productVideo.updateMany({
                            where: { createdBy: { in: userIds } },
                            data: { createdBy: null },
                        }),
                        tx.banner.updateMany({
                            where: { createdBy: { in: userIds } },
                            data: { createdBy: null },
                        }),
                        tx.productPricing.updateMany({
                            where: { createdBy: { in: userIds } },
                            data: { createdBy: null },
                        }),
                        tx.productPricing.updateMany({
                            where: { updatedBy: { in: userIds } },
                            data: { updatedBy: null },
                        }),
                        tx.catalogImport.deleteMany({
                            where: { uploadedBy: { in: userIds } },
                        }),
                        tx.customer.updateMany({
                            where: { assignedSalesStaffId: { in: userIds } },
                            data: { assignedSalesStaffId: null },
                        }),
                        tx.customer.updateMany({
                            where: { approvedBy: { in: userIds } },
                            data: { approvedBy: null },
                        }),
                    ]);
                    await tx.user.deleteMany({ where: { id: { in: userIds } } });
                }
                const [carts, invoices, orders] = await Promise.all([
                    tx.cart.findMany({ where: { customerId: id } }),
                    tx.invoice.findMany({ where: { customerId: id } }),
                    tx.order.findMany({ where: { customerId: id } }),
                    tx.supportTicket.updateMany({
                        where: { customerId: id },
                        data: { customerId: null },
                    }),
                    tx.customerContact.deleteMany({ where: { customerId: id } }),
                ]);
                const cartIds = carts.map((c) => c.id);
                if (cartIds.length > 0) {
                    await tx.cartItem.deleteMany({ where: { cartId: { in: cartIds } } });
                    await tx.cart.deleteMany({ where: { id: { in: cartIds } } });
                }
                const invoiceIds = invoices.map((inv) => inv.id);
                if (invoiceIds.length > 0) {
                    await tx.invoiceItem.deleteMany({
                        where: { invoiceId: { in: invoiceIds } },
                    });
                    await tx.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
                }
                const orderIds = orders.map((o) => o.id);
                if (orderIds.length > 0) {
                    await Promise.all([
                        tx.backorderApproval.deleteMany({
                            where: { orderId: { in: orderIds } },
                        }),
                        tx.packingSlip.deleteMany({
                            where: { orderId: { in: orderIds } },
                        }),
                        tx.shipment.deleteMany({
                            where: { orderId: { in: orderIds } },
                        }),
                        tx.orderStatusHistory.deleteMany({
                            where: { orderId: { in: orderIds } },
                        }),
                        tx.orderItem.deleteMany({
                            where: { orderId: { in: orderIds } },
                        }),
                    ]);
                    await tx.order.deleteMany({ where: { id: { in: orderIds } } });
                }
                await Promise.all([
                    tx.payment.deleteMany({ where: { customerId: id } }),
                    tx.ledgerEntry.deleteMany({ where: { customerId: id } }),
                ]);
                return tx.customer.delete({ where: { id } });
            }, {
                maxWait: 10000,
                timeout: 30000,
            });
        }
        catch (error) {
            if (error instanceof client_2.Prisma.PrismaClientKnownRequestError &&
                (error.code === 'P2003' || error.code === 'P2014')) {
                throw new common_1.BadRequestException('Cannot delete customer because they have related transaction records (e.g., orders, invoices, payments) in the system. Please delete or reassign those records first.');
            }
            throw error;
        }
    }
    async setOpeningBalance(id, dto, userId) {
        const customer = await this.findOne(id);
        const amount = Number(dto.amount);
        const description = dto.description || `Opening balance set for ${customer.businessName}`;
        return this.prisma.$transaction(async (tx) => {
            const updatedCustomer = await tx.customer.update({
                where: { id },
                data: {
                    openingBalance: amount,
                    currentBalance: amount,
                },
            });
            await tx.ledgerEntry.create({
                data: {
                    customerId: id,
                    entryDate: new Date(),
                    entryType: 'OPENING_BALANCE',
                    referenceType: 'OPENING',
                    debit: amount,
                    credit: 0,
                    balanceAfterEntry: amount,
                    description,
                    createdBy: userId,
                },
            });
            return updatedCustomer;
        });
    }
    async getContacts(customerId) {
        await this.findOne(customerId);
        return this.prisma.customerContact.findMany({
            where: { customerId },
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        });
    }
    async addContact(customerId, dto) {
        await this.findOne(customerId);
        const existing = await this.prisma.customerContact.findFirst({
            where: { customerId, mobile: dto.mobile },
        });
        if (existing) {
            throw new common_1.ConflictException('A contact with this mobile number already exists for this customer.');
        }
        if (dto.isPrimary) {
            await this.prisma.customerContact.updateMany({
                where: { customerId },
                data: { isPrimary: false },
            });
        }
        return this.prisma.customerContact.create({
            data: {
                customerId,
                name: dto.name,
                mobile: dto.mobile,
                whatsappNumber: dto.whatsappNumber,
                email: dto.email,
                designation: dto.designation,
                photoUrl: dto.photoUrl,
                loginAccess: dto.loginAccess ?? false,
                isPrimary: dto.isPrimary ?? false,
                isActive: true,
                canPlaceOrder: dto.canPlaceOrder ?? true,
                canViewLedger: dto.canViewLedger ?? false,
                canDownloadInvoice: dto.canDownloadInvoice ?? false,
            },
        });
    }
    async updateContact(customerId, contactId, dto) {
        const contact = await this.prisma.customerContact.findFirst({
            where: { id: contactId, customerId },
        });
        if (!contact) {
            throw new common_1.NotFoundException(`Contact with ID '${contactId}' not found for this customer.`);
        }
        if (dto.isPrimary === true) {
            await this.prisma.customerContact.updateMany({
                where: { customerId, id: { not: contactId } },
                data: { isPrimary: false },
            });
        }
        return this.prisma.customerContact.update({
            where: { id: contactId },
            data: dto,
        });
    }
    async removeContact(customerId, contactId) {
        const contact = await this.prisma.customerContact.findFirst({
            where: { id: contactId, customerId },
        });
        if (!contact) {
            throw new common_1.NotFoundException(`Contact with ID '${contactId}' not found for this customer.`);
        }
        if (contact.isPrimary) {
            throw new common_1.BadRequestException('Cannot remove the primary contact. Set another contact as primary first.');
        }
        return this.prisma.customerContact.delete({ where: { id: contactId } });
    }
    async provisionContactLogin(customerId, contactId, dto) {
        const contact = await this.prisma.customerContact.findFirst({
            where: { id: contactId, customerId },
        });
        if (!contact) {
            throw new common_1.NotFoundException(`Contact with ID '${contactId}' not found for this customer.`);
        }
        if (!contact.loginAccess) {
            throw new common_1.BadRequestException('This contact does not have loginAccess enabled.');
        }
        const existingUser = await this.prisma.user.findFirst({
            where: { customerContactId: contactId },
        });
        if (existingUser) {
            throw new common_1.ConflictException('A login account already exists for this contact.');
        }
        const duplicateUser = await this.prisma.user.findFirst({
            where: {
                OR: [
                    { mobile: contact.mobile },
                    ...(contact.email ? [{ email: contact.email }] : []),
                ],
            },
        });
        if (duplicateUser) {
            throw new common_1.ConflictException('The mobile number or email associated with this contact is already in use by another user account.');
        }
        const passwordHash = await bcrypt.hash(dto.password, 10);
        return this.prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    name: contact.name,
                    email: contact.email,
                    mobile: contact.mobile,
                    passwordHash,
                    userType: client_1.UserType.CUSTOMER,
                    customerId: customerId,
                    customerContactId: contactId,
                    isActive: true,
                    isVerified: true,
                },
            });
            let customerRole = await tx.role.findUnique({
                where: { name: 'Customer' },
            });
            if (!customerRole) {
                customerRole = await tx.role.create({
                    data: {
                        name: 'Customer',
                        description: 'Default role for registered customers',
                        isSystemRole: true,
                    },
                });
            }
            await tx.userRole.create({
                data: {
                    userId: user.id,
                    roleId: customerRole.id,
                },
            });
            return {
                id: user.id,
                name: user.name,
                email: user.email,
                mobile: user.mobile,
                userType: user.userType,
            };
        });
    }
};
exports.CustomerService = CustomerService;
exports.CustomerService = CustomerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        email_service_1.EmailService,
        events_gateway_1.EventsGateway])
], CustomerService);
//# sourceMappingURL=customer.service.js.map