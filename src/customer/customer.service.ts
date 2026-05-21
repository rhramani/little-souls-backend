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
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { SetOpeningBalanceDto } from './dto/set-opening-balance.dto';
import { ProvisionContactLoginDto } from './dto/provision-contact-login.dto';
import { ApprovalStatus, UserType } from '@prisma/client';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

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
        assignedSalesStaff: { select: { id: true, name: true, email: true } },
        approvedByUser: { select: { id: true, name: true } },
      },
    });
    if (!customer) {
      throw new NotFoundException(`Customer with ID '${id}' not found.`);
    }
    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.findOne(id);
    return this.prisma.customer.update({
      where: { id },
      data: dto,
    });
  }

  async approve(id: string, dto: ApproveCustomerDto, adminId: string) {
    const customer = await this.findOne(id);
    if (customer.approvalStatus === ApprovalStatus.APPROVED) {
      throw new BadRequestException('Customer is already approved.');
    }

    return this.prisma.customer.update({
      where: { id },
      data: {
        approvalStatus: ApprovalStatus.APPROVED,
        approvedBy: adminId,
        approvedAt: new Date(),
        isActive: true,
        pricingGroupId: dto.pricingGroupId ?? customer.pricingGroupId,
      },
    });
  }

  async reject(id: string, dto: RejectCustomerDto, adminId: string) {
    const customer = await this.findOne(id);
    if (customer.approvalStatus === ApprovalStatus.REJECTED) {
      throw new BadRequestException('Customer is already rejected.');
    }

    return this.prisma.customer.update({
      where: { id },
      data: {
        approvalStatus: ApprovalStatus.REJECTED,
        approvedBy: adminId,
        approvedAt: new Date(),
        isActive: false,
        rejectionReason: dto.reason,
      },
    });
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
      throw new BadRequestException('Cannot activate a customer that is not approved.');
    }
    return this.prisma.customer.update({
      where: { id },
      data: { isActive: true },
    });
  }

  async setOpeningBalance(id: string, dto: SetOpeningBalanceDto, userId: string) {
    const customer = await this.findOne(id);

    const amount = new Prisma.Decimal(dto.amount);
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
          credit: new Prisma.Decimal(0),
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
      throw new ConflictException('A contact with this mobile number already exists for this customer.');
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

  async updateContact(customerId: string, contactId: string, dto: UpdateContactDto) {
    const contact = await this.prisma.customerContact.findFirst({
      where: { id: contactId, customerId },
    });
    if (!contact) {
      throw new NotFoundException(`Contact with ID '${contactId}' not found for this customer.`);
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
      throw new NotFoundException(`Contact with ID '${contactId}' not found for this customer.`);
    }
    if (contact.isPrimary) {
      throw new BadRequestException('Cannot remove the primary contact. Set another contact as primary first.');
    }

    return this.prisma.customerContact.delete({ where: { id: contactId } });
  }

  async provisionContactLogin(customerId: string, contactId: string, dto: ProvisionContactLoginDto) {
    const contact = await this.prisma.customerContact.findFirst({
      where: { id: contactId, customerId },
    });

    if (!contact) {
      throw new NotFoundException(`Contact with ID '${contactId}' not found for this customer.`);
    }

    if (!contact.loginAccess) {
      throw new BadRequestException('This contact does not have loginAccess enabled.');
    }

    // Check if user already exists for this contact
    const existingUser = await this.prisma.user.findFirst({
      where: { customerContactId: contactId },
    });

    if (existingUser) {
      throw new ConflictException('A login account already exists for this contact.');
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
      throw new ConflictException('The mobile number or email associated with this contact is already in use by another user account.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.create({
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
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        userType: true,
      },
    });
  }
}
