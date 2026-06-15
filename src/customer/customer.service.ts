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
        ].filter(Boolean) as any,
      },
    });

    if (existingUser) {
      throw new ConflictException(
        'A user with this email or mobile number already exists',
      );
    }

    if (dto.gstin) {
      const existingCustomer = await this.prisma.customer.findUnique({
        where: { gstin: dto.gstin },
      });
      if (existingCustomer) {
        throw new ConflictException('GSTIN is already registered');
      }
    }

    const plainPassword = crypto.randomBytes(6).toString('hex');
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    let parsedCreditLimit: number | null = null;
    if (dto.creditLimit !== undefined && dto.creditLimit !== null && dto.creditLimit !== '') {
      const parsed = Number(dto.creditLimit);
      parsedCreditLimit = isNaN(parsed) ? null : parsed;
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Auto-generate customerCode if not provided
      let codeToAssign = dto.customerCode;
      if (!codeToAssign) {
        const count = await tx.customer.count();
        codeToAssign = `LS-C-${String(count + 1).padStart(4, '0')}`;
      }

      // Create Customer as APPROVED immediately
      const customer = await tx.customer.create({
        data: {
          businessName: dto.businessName,
          businessType: dto.businessType,
          gstin: dto.gstin,
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
          mainContactNumber: dto.mobile,
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
      );
    }

    this.eventsGateway.emitCustomerRegistered(result.customer);
    return this.findOne(result.customer.id);
  }

  async findAll(query: QueryCustomerDto) {
    const { page = 1, limit = 10, search, status } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
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

    const [customers, total] = await this.prisma.$transaction([
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

    return {
      customers,
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
    const { name, email, mobile, designation, whatsapp, creditLimit, customerCode, ...customerData } = dto;

    if (customerCode !== undefined && customerCode !== customer.customerCode) {
      if (customerCode) {
        const existingCode = await this.prisma.customer.findFirst({
          where: {
            customerCode: { equals: customerCode, mode: 'insensitive' },
            id: { not: id },
          },
        });
        if (existingCode) {
          throw new ConflictException('Customer Code is already in use by another account');
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
      const updatePayload: any = { ...customerData };
      if (parsedCreditLimit !== undefined) {
        updatePayload.creditLimit = parsedCreditLimit;
      }
      if (customerCode !== undefined) {
        updatePayload.customerCode = customerCode || null;
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
      throw new BadRequestException('Customer is already approved.');
    }

    const plainPassword = crypto.randomBytes(6).toString('hex');
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const updatedCustomer = await this.prisma.$transaction(async (tx) => {
      // Auto-generate customerCode if not present
      let codeToAssign = customer.customerCode;
      if (!codeToAssign) {
        const count = await tx.customer.count();
        codeToAssign = `LS-C-${String(count + 1).padStart(4, '0')}`;
      }

      // 1. Approve customer
      const updated = await tx.customer.update({
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
    const customer = await this.findOne(id);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.user.deleteMany({ where: { customerId: id } });
        await tx.ledgerEntry.deleteMany({ where: { customerId: id } });
        return tx.customer.delete({ where: { id } });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new BadRequestException(
          'Cannot delete customer because they have related records in the system.',
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
