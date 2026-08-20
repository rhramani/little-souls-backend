import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryCustomerDto } from './dto/query-customer.dto';
import { ApproveCustomerDto } from './dto/approve-customer.dto';
import { RejectCustomerDto } from './dto/reject-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { SetOpeningBalanceDto } from './dto/set-opening-balance.dto';
import { ProvisionContactLoginDto } from './dto/provision-contact-login.dto';
import { ApprovalStatus, UserType } from '@prisma/client';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { EmailService } from '../common/email.service';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class CustomerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async create(dto: CreateCustomerDto, adminId: string) {
    // 1. Check if user already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { mobile: dto.mobile },
          dto.email ? { email: dto.email } : undefined,
        ].filter((x): x is NonNullable<typeof x> => x !== undefined),
      },
    });

    if (existingUser) {
      throw new ConflictException(
        'A user with this email or mobile number already exists',
      );
    }

    const cleanGstin =
      dto.gstin && typeof dto.gstin === 'string' && dto.gstin.trim()
        ? dto.gstin.trim().toUpperCase()
        : null;

    if (cleanGstin) {
      const existingCustomer = await this.prisma.customer.findFirst({
        where: { gstin: { equals: cleanGstin, mode: 'insensitive' } },
      });
      if (existingCustomer) {
        throw new ConflictException(
          `GSTIN "${cleanGstin}" is already registered with customer "${existingCustomer.businessName}"`,
        );
      }
    }

    const plainPassword = crypto.randomBytes(6).toString('hex');
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    let parsedCreditLimit: number | null = null;
    if (
      dto.creditLimit !== undefined &&
      dto.creditLimit !== null &&
      dto.creditLimit !== ''
    ) {
      const parsed = Number(dto.creditLimit);
      parsedCreditLimit = isNaN(parsed) ? null : parsed;
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Auto-generate customerCode if not provided
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
          .filter((n): n is number => n !== null);
        if (numbers.length > 0) {
          nextNumber = Math.max(...numbers) + 1;
        }
        codeToAssign = `LS-C-${String(nextNumber).padStart(4, '0')}`;
      }

      // Create Customer as APPROVED immediately
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
          approvalStatus: ApprovalStatus.APPROVED,
          approvedBy: adminId,
          approvedAt: new Date(),
          isActive: true,
          creditLimit: parsedCreditLimit,
          customerCode: codeToAssign,
        },
      });

      // Create primary contact
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

      // Create user
      const user = await tx.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          mobile: dto.mobile,
          passwordHash,
          plainPassword,
          userType: UserType.CUSTOMER,
          customerId: customer.id,
          customerContactId: contact.id,
          isActive: true,
          isVerified: false,
        },
      });

      // Find or create Customer role
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

      // Assign Customer role to user
      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: customerRole.id,
        },
      });

      return { customer, contact, user };
    });

    if (result.contact.email) {
      await this.emailService.sendCustomerCredentials(
        result.contact.email,
        result.contact.name || 'Customer',
        plainPassword,
        {
          businessName: result.customer.businessName,
          gstin: result.customer.gstin,
          mobile: result.contact.mobile || result.customer.mainContactNumber,
          customerCode: result.customer.customerCode,
        },
      );
    }

    this.eventsGateway.emitCustomerRegistered(result.customer);
    return this.findOne(result.customer.id);
  }

  async findAll(query: QueryCustomerDto) {
    const { page = 1, limit = 10, search, status } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = {};
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

    const [
      ledgerGrouped,
      ordersGrouped,
      paymentsGrouped,
      paidInvoicesGrouped,
      completedLedgerInvoicesGrouped,
      pendingDebitsGrouped,
    ] = customerIds.length > 0
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
      const paidInvoicesTotal = Math.max(
        paidInvoicesMap.get(c.id) || 0,
        completedLedgerInvoicesMap.get(c.id) || 0,
      );
      const openBal = c.openingBalance || 0;

      // 1. Total Amount / Receivable (Lena Hai)
      const totalAmount = Math.max(l.debit, approvedOrdersTotal + openBal);

      // 2. Amount Received (Aaya Hai: ledger credits, verified payments, paid invoices)
      const directPaymentsReceived = Math.max(l.credit, verifiedPaymentsTotal);
      const amountReceived = Math.min(
        totalAmount,
        Math.max(directPaymentsReceived, paidInvoicesTotal),
      );

      // 3. Pending Amount (Due)
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

  async findOne(id: string) {
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
      throw new NotFoundException(`Customer with ID '${id}' not found.`);
    }
    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto) {
    const customer = await this.findOne(id);
    const {
      name,
      email,
      mobile,
      designation,
      whatsapp,
      creditLimit,
      customerCode,
      gstin,
      ...customerData
    } = dto;

    if (customerCode !== undefined && customerCode !== customer.customerCode) {
      if (customerCode) {
        const existingCode = await this.prisma.customer.findFirst({
          where: {
            customerCode: { equals: customerCode, mode: 'insensitive' },
            id: { not: id },
          },
        });
        if (existingCode) {
          throw new ConflictException(
            'Customer Code is already in use by another account',
          );
        }
      }
    }

    let cleanGstin: string | null | undefined = undefined;
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
          throw new ConflictException(
            `GSTIN "${cleanGstin}" is already registered with customer "${existingGstinCustomer.businessName}" (${existingGstinCustomer.customerCode || existingGstinCustomer.id}).`,
          );
        }
      }
    }

    let parsedCreditLimit: number | null | undefined = undefined;
    if (creditLimit !== undefined) {
      if (creditLimit === '' || creditLimit === null) {
        parsedCreditLimit = null;
      } else {
        const parsed = Number(creditLimit);
        parsedCreditLimit = isNaN(parsed) ? null : parsed;
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updatePayload: Record<string, unknown> = { ...customerData };
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

      // Update primary contact if contact fields are provided
      if (
        name !== undefined ||
        email !== undefined ||
        mobile !== undefined ||
        designation !== undefined ||
        whatsapp !== undefined
      ) {
        const primaryContact =
          customer.contacts.find((c) => c.isPrimary) || customer.contacts[0];
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

          // Also update the User record to keep email/mobile in sync for login and password resets
          if (
            name !== undefined ||
            email !== undefined ||
            mobile !== undefined
          ) {
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

  async approve(id: string, dto: ApproveCustomerDto, adminId: string) {
    const customer = await this.findOne(id);
    if (customer.approvalStatus === ApprovalStatus.APPROVED) {
      return customer;
    }

    const plainPassword = crypto.randomBytes(6).toString('hex');
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    await this.prisma.$transaction(async (tx) => {
      // Auto-generate customerCode if not present
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
          .filter((n): n is number => n !== null);
        if (numbers.length > 0) {
          nextNumber = Math.max(...numbers) + 1;
        }
        codeToAssign = `LS-C-${String(nextNumber).padStart(4, '0')}`;
      }

      // 1. Approve customer
      await tx.customer.update({
        where: { id },
        data: {
          approvalStatus: ApprovalStatus.APPROVED,
          approvedBy: adminId,
          approvedAt: new Date(),
          isActive: true,
          pricingGroupId: dto.pricingGroupId ?? customer.pricingGroupId,
          customerCode: codeToAssign,
        },
      });

      // 2. Update user credentials
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

    // 3. Send email to primary contact
    const primaryContact =
      customer.contacts.find((c) => c.isPrimary) || customer.contacts[0];
    if (primaryContact && primaryContact.email) {
      await this.emailService.sendCustomerCredentials(
        primaryContact.email,
        primaryContact.name || 'Customer',
        plainPassword,
        {
          businessName: customer.businessName,
          gstin: customer.gstin,
          mobile: primaryContact.mobile || customer.mainContactNumber,
          customerCode: customer.customerCode,
        },
      );
    }

    this.eventsGateway.emitCustomerStatusChanged(id, ApprovalStatus.APPROVED);
    return this.findOne(id);
  }

  async reject(id: string, dto: RejectCustomerDto, adminId: string) {
    const customer = await this.findOne(id);
    if (customer.approvalStatus === ApprovalStatus.REJECTED) {
      throw new BadRequestException('Customer is already rejected.');
    }

    const updated = await this.prisma.customer.update({
      where: { id },
      data: {
        approvalStatus: ApprovalStatus.REJECTED,
        approvedBy: adminId,
        approvedAt: new Date(),
        isActive: false,
        rejectionReason: dto.reason,
      },
    });

    this.eventsGateway.emitCustomerStatusChanged(id, ApprovalStatus.REJECTED);
    return updated;
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.customer.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async activate(id: string) {
    const customer = await this.findOne(id);
    if (customer.approvalStatus !== ApprovalStatus.APPROVED) {
      throw new BadRequestException(
        'Cannot activate a customer that is not approved.',
      );
    }
    return this.prisma.customer.update({
      where: { id },
      data: { isActive: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id); // guard: throws NotFoundException if not found

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // 1. Find linked users and contacts
          const [linkedUsers, contacts] = await Promise.all([
            tx.user.findMany({ where: { customerId: id } }),
            tx.customerContact.findMany({ where: { customerId: id } }),
          ]);
          const userIds = linkedUsers.map((u) => u.id);
          const contactIds = contacts.map((c) => c.id);

          // 2. Clear contact IDs & delete CustomerActivitySessions
          const contactCleanups: Promise<unknown>[] = [];
          if (contactIds.length > 0) {
            contactCleanups.push(
              tx.user.updateMany({
                where: { customerContactId: { in: contactIds } },
                data: { customerContactId: null },
              }),
              tx.cart.updateMany({
                where: { customerContactId: { in: contactIds } },
                data: { customerContactId: null },
              }),
              tx.order.updateMany({
                where: { customerContactId: { in: contactIds } },
                data: { customerContactId: null },
              }),
            );
          }

          contactCleanups.push(
            tx.customerActivitySession.deleteMany({
              where: {
                OR: [
                  { customerId: id },
                  ...(userIds.length > 0 ? [{ userId: { in: userIds } }] : []),
                ],
              },
            }),
          );

          await Promise.all(contactCleanups);

          // 3. Decouple user relations and delete linked users
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

            // Delete the users
            await tx.user.deleteMany({ where: { id: { in: userIds } } });
          }

          // 4. Decouple support tickets & fetch related transactions
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

          // 5. Delete CartItems and Carts
          const cartIds = carts.map((c) => c.id);
          if (cartIds.length > 0) {
            await tx.cartItem.deleteMany({ where: { cartId: { in: cartIds } } });
            await tx.cart.deleteMany({ where: { id: { in: cartIds } } });
          }

          // 6. Delete InvoiceItems and Invoices
          const invoiceIds = invoices.map((inv) => inv.id);
          if (invoiceIds.length > 0) {
            await tx.invoiceItem.deleteMany({
              where: { invoiceId: { in: invoiceIds } },
            });
            await tx.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
          }

          // 7. Delete Order details and Orders
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

          // 8. Delete Payments, LedgerEntries
          await Promise.all([
            tx.payment.deleteMany({ where: { customerId: id } }),
            tx.ledgerEntry.deleteMany({ where: { customerId: id } }),
          ]);

          // 9. Finally, delete the customer record
          return tx.customer.delete({ where: { id } });
        },
        {
          maxWait: 10000,
          timeout: 30000,
        },
      );
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2003' || error.code === 'P2014')
      ) {
        throw new BadRequestException(
          'Cannot delete customer because they have related transaction records (e.g., orders, invoices, payments) in the system. Please delete or reassign those records first.',
        );
      }
      throw error;
    }
  }

  async setOpeningBalance(
    id: string,
    dto: SetOpeningBalanceDto,
    userId: string,
  ) {
    const customer = await this.findOne(id);

    const amount = Number(dto.amount);
    const description =
      dto.description || `Opening balance set for ${customer.businessName}`;

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

  // =============== CONTACT PERSON MANAGEMENT ===============

  async getContacts(customerId: string) {
    await this.findOne(customerId);
    return this.prisma.customerContact.findMany({
      where: { customerId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async addContact(customerId: string, dto: CreateContactDto) {
    await this.findOne(customerId);

    // Check mobile uniqueness within contacts
    const existing = await this.prisma.customerContact.findFirst({
      where: { customerId, mobile: dto.mobile },
    });
    if (existing) {
      throw new ConflictException(
        'A contact with this mobile number already exists for this customer.',
      );
    }

    // If setting as primary, unset all others first
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

  async updateContact(
    customerId: string,
    contactId: string,
    dto: UpdateContactDto,
  ) {
    const contact = await this.prisma.customerContact.findFirst({
      where: { id: contactId, customerId },
    });
    if (!contact) {
      throw new NotFoundException(
        `Contact with ID '${contactId}' not found for this customer.`,
      );
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

  async removeContact(customerId: string, contactId: string) {
    const contact = await this.prisma.customerContact.findFirst({
      where: { id: contactId, customerId },
    });
    if (!contact) {
      throw new NotFoundException(
        `Contact with ID '${contactId}' not found for this customer.`,
      );
    }
    if (contact.isPrimary) {
      throw new BadRequestException(
        'Cannot remove the primary contact. Set another contact as primary first.',
      );
    }

    return this.prisma.customerContact.delete({ where: { id: contactId } });
  }

  async provisionContactLogin(
    customerId: string,
    contactId: string,
    dto: ProvisionContactLoginDto,
  ) {
    const contact = await this.prisma.customerContact.findFirst({
      where: { id: contactId, customerId },
    });

    if (!contact) {
      throw new NotFoundException(
        `Contact with ID '${contactId}' not found for this customer.`,
      );
    }

    if (!contact.loginAccess) {
      throw new BadRequestException(
        'This contact does not have loginAccess enabled.',
      );
    }

    // Check if user already exists for this contact
    const existingUser = await this.prisma.user.findFirst({
      where: { customerContactId: contactId },
    });

    if (existingUser) {
      throw new ConflictException(
        'A login account already exists for this contact.',
      );
    }

    // Check if mobile/email is already used across the system for any user
    const duplicateUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { mobile: contact.mobile },
          ...(contact.email ? [{ email: contact.email }] : []),
        ],
      },
    });

    if (duplicateUser) {
      throw new ConflictException(
        'The mobile number or email associated with this contact is already in use by another user account.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: contact.name,
          email: contact.email,
          mobile: contact.mobile,
          passwordHash,
          userType: UserType.CUSTOMER,
          customerId: customerId,
          customerContactId: contactId,
          isActive: true,
          isVerified: true,
        },
      });

      // Find or create Customer role
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

      // Assign Customer role to user
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
}
