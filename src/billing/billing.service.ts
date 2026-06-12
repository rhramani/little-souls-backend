import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { QueryBillingDto } from './dto/query-billing.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  async generateInvoice(orderId: string, userId: string) {
    // 1. Check if invoice already exists for this order
    const existingInvoice = await this.prisma.invoice.findFirst({
      where: { orderId },
    });
    if (existingInvoice) {
      throw new ConflictException(
        `An invoice already exists for order ID '${orderId}'.`,
      );
    }

    // 2. Fetch the order details
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        customer: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID '${orderId}' not found.`);
    }

    // Invoice generation eligibility check
    const eligibleStatuses = ['APPROVED', 'PACKED', 'SHIPPED', 'DELIVERED'];
    if (!eligibleStatuses.includes(order.orderStatus)) {
      throw new BadRequestException(
        `Cannot generate an invoice for an order in '${order.orderStatus}' status. Order must be approved or processing first.`,
      );
    }

    const invoiceNumber = `INV-${Date.now().toString().slice(-8)}-${Math.floor(1000 + Math.random() * 9000)}`;
    const invoiceDate = new Date();

    // Credit terms: Due in 15 days standard
    const dueDate = new Date();
    dueDate.setDate(invoiceDate.getDate() + 15);

    // Concatenate address parts
    const customer = order.customer;
    const billingAddress =
      [
        customer.billingAddressLine1,
        customer.billingAddressLine2,
        customer.billingCity,
        customer.billingState,
        customer.billingPincode,
        customer.billingCountry,
      ]
        .filter(Boolean)
        .join(', ') || null;

    const shippingAddress =
      order.deliveryAddress ||
      [
        customer.shippingAddressLine1,
        customer.shippingAddressLine2,
        customer.shippingCity,
        customer.shippingState,
        customer.shippingPincode,
        customer.shippingCountry,
      ]
        .filter(Boolean)
        .join(', ') ||
      null;

    // Transaction-wrapped Invoice generation and balance posting
    return this.prisma.$transaction(async (tx) => {
      // 1. Create Invoice record
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          orderId: order.id,
          customerId: order.customerId,
          invoiceDate,
          dueDate,
          subTotal: order.subTotal,
          discountTotal: order.discountTotal,
          taxTotal: order.taxTotal,
          shippingCharge: order.shippingCharge,
          grandTotal: order.grandTotal,
          paymentStatus: 'UNPAID',
          status: 'GENERATED',
          billingAddress,
          shippingAddress,
          gstin: customer.gstin,
          taxableAmount: order.subTotal,
          createdBy: userId,
        },
      });

      // 2. Create Invoice Items
      const invoiceItemsData = order.items.map((item) => ({
        invoiceId: invoice.id,
        productId: item.productId,
        sku: item.sku,
        productName: item.productName,
        productImageUrl: item.productImageUrl || null,
        quantity: item.quantity,
        price: item.price,
        taxPercent: item.taxPercent || new Prisma.Decimal(0),
        lineSubTotal: item.lineSubTotal,
        lineTaxTotal: item.lineTaxTotal,
        lineTotal: item.lineTotal,
      }));

      await tx.invoiceItem.createMany({
        data: invoiceItemsData,
      });

      // 3. Increment Customer currentBalance outstanding liability
      const currentCust = await tx.customer.findUnique({
        where: { id: order.customerId },
        select: { currentBalance: true },
      });

      const newBalance = (
        currentCust?.currentBalance || new Prisma.Decimal(0)
      ).add(order.grandTotal);

      await tx.customer.update({
        where: { id: order.customerId },
        data: { currentBalance: newBalance },
      });

      // 4. Record Customer Ledger Entry (DEBIT liability)
      await tx.ledgerEntry.create({
        data: {
          customerId: order.customerId,
          entryDate: invoiceDate,
          entryType: 'INVOICE',
          referenceType: 'INVOICE',
          referenceId: invoice.id,
          debit: order.grandTotal,
          credit: new Prisma.Decimal(0),
          balanceAfterEntry: newBalance,
          description: `Invoice ${invoiceNumber} generated for Order ${order.orderNumber}`,
          createdBy: userId,
        },
      });

      return tx.invoice.findUnique({
        where: { id: invoice.id },
        include: {
          items: true,
        },
      });
    });
  }

  async recordPayment(
    dto: RecordPaymentDto,
    userId: string,
    isVerified = false,
  ) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });

    if (!customer) {
      throw new NotFoundException(
        `Customer with ID '${dto.customerId}' not found.`,
      );
    }

    const paymentNumber = `PAY-${Date.now().toString().slice(-8)}-${Math.floor(1000 + Math.random() * 9000)}`;
    const transactionDate = new Date(dto.transactionDate);
    const amountDec = new Prisma.Decimal(dto.amount);

    if (isVerified) {
      // Direct transactional staff payment recording
      return this.prisma.$transaction(async (tx) => {
        const payment = await tx.payment.create({
          data: {
            customerId: dto.customerId,
            paymentNumber,
            amount: amountDec,
            paymentMode: dto.paymentMode,
            transactionDate,
            referenceNumber: dto.referenceNumber,
            attachmentUrl: dto.attachmentUrl,
            notes: dto.notes,
            paymentStatus: 'VERIFIED',
            verifiedBy: userId,
            verifiedAt: new Date(),
            receivedBy: userId,
          },
        });

        // Decrement customer outstanding balance liability
        const currentCust = await tx.customer.findUnique({
          where: { id: dto.customerId },
          select: { currentBalance: true },
        });

        const newBalance = (
          currentCust?.currentBalance || new Prisma.Decimal(0)
        ).sub(amountDec);

        await tx.customer.update({
          where: { id: dto.customerId },
          data: { currentBalance: newBalance },
        });

        // Record customer ledger credit posting
        await tx.ledgerEntry.create({
          data: {
            customerId: dto.customerId,
            entryDate: transactionDate,
            entryType: 'PAYMENT',
            referenceType: 'PAYMENT',
            referenceId: payment.id,
            debit: new Prisma.Decimal(0),
            credit: amountDec,
            balanceAfterEntry: newBalance,
            description: `Payment verified (${paymentNumber}) via ${dto.paymentMode}`,
            createdBy: userId,
          },
        });

        return payment;
      });
    } else {
      // Pending review payment submission (B2B Customer portal)
      return this.prisma.payment.create({
        data: {
          customerId: dto.customerId,
          paymentNumber,
          amount: amountDec,
          paymentMode: dto.paymentMode,
          transactionDate,
          referenceNumber: dto.referenceNumber,
          attachmentUrl: dto.attachmentUrl,
          notes: dto.notes,
          paymentStatus: 'PENDING',
        },
      });
    }
  }

  async verifyPayment(paymentId: string, userId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException(
        `Payment record with ID '${paymentId}' not found.`,
      );
    }

    if (payment.paymentStatus !== 'PENDING') {
      throw new BadRequestException(
        `Payment is already verified or processed with status: ${payment.paymentStatus}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const verifiedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          paymentStatus: 'VERIFIED',
          verifiedBy: userId,
          verifiedAt: new Date(),
        },
      });

      // Decrement outstanding balance
      const currentCust = await tx.customer.findUnique({
        where: { id: payment.customerId },
        select: { currentBalance: true },
      });

      const newBalance = (
        currentCust?.currentBalance || new Prisma.Decimal(0)
      ).sub(payment.amount);

      await tx.customer.update({
        where: { id: payment.customerId },
        data: { currentBalance: newBalance },
      });

      // Log credit ledger entry
      await tx.ledgerEntry.create({
        data: {
          customerId: payment.customerId,
          entryDate: payment.transactionDate,
          entryType: 'PAYMENT',
          referenceType: 'PAYMENT',
          referenceId: payment.id,
          debit: new Prisma.Decimal(0),
          credit: payment.amount,
          balanceAfterEntry: newBalance,
          description: `Payment verification completed (${payment.paymentNumber}) via ${payment.paymentMode}`,
          createdBy: userId,
        },
      });

      return verifiedPayment;
    });
  }

  async rejectPayment(paymentId: string, userId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException(
        `Payment record with ID '${paymentId}' not found.`,
      );
    }

    if (payment.paymentStatus !== 'PENDING') {
      throw new BadRequestException(
        `Cannot reject payment in status: ${payment.paymentStatus}`,
      );
    }

    return this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        paymentStatus: 'REJECTED',
        verifiedBy: userId,
        verifiedAt: new Date(),
      },
    });
  }

  async findAllInvoices(query: QueryBillingDto, customerId?: string) {
    const { page = 1, limit = 10, customerId: filterCustId } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (customerId) {
      where.customerId = customerId;
    } else if (filterCustId) {
      where.customerId = filterCustId;
    }

    const [invoices, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          order: {
            select: { orderNumber: true },
          },
          customer: {
            select: { businessName: true, customerCode: true },
          },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      invoices,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOneInvoice(id: string, customerId?: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        items: true,
        order: true,
        customer: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID '${id}' not found.`);
    }

    if (customerId && invoice.customerId !== customerId) {
      throw new ForbiddenException(
        'You do not have permission to view this invoice.',
      );
    }

    return invoice;
  }

  async findAllPayments(query: QueryBillingDto, customerId?: string) {
    const { page = 1, limit = 10, customerId: filterCustId } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (customerId) {
      where.customerId = customerId;
    } else if (filterCustId) {
      where.customerId = filterCustId;
    }

    const [payments, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: { businessName: true, customerCode: true },
          },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      payments,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findAllLedgerEntries(query: QueryBillingDto, customerId?: string) {
    const {
      page = 1,
      limit = 20,
      customerId: filterCustId,
      search,
      type,
    } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (customerId) {
      where.customerId = customerId;
    } else if (filterCustId) {
      where.customerId = filterCustId;
    }

    if (search && search.trim()) {
      const searchTrimmed = search.trim();
      where.OR = [
        { referenceId: { contains: searchTrimmed, mode: 'insensitive' } },
        { description: { contains: searchTrimmed, mode: 'insensitive' } },
        {
          customer: {
            OR: [
              {
                businessName: { contains: searchTrimmed, mode: 'insensitive' },
              },
              {
                customerCode: { contains: searchTrimmed, mode: 'insensitive' },
              },
            ],
          },
        },
      ];
    }

    if (type) {
      if (type === 'debit' || type === 'unpaid') {
        where.debit = { gt: 0 };
      } else if (type === 'credit' || type === 'paid') {
        where.credit = { gt: 0 };
      }
    }

    const [ledgerEntries, total] = await this.prisma.$transaction([
      this.prisma.ledgerEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { entryDate: 'desc' },
        include: {
          customer: {
            select: { businessName: true, customerCode: true },
          },
        },
      }),
      this.prisma.ledgerEntry.count({ where }),
    ]);

    return {
      ledgerEntries,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getCustomerBalance(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        businessName: true,
        customerCode: true,
        creditLimit: true,
        openingBalance: true,
        currentBalance: true,
      },
    });

    if (!customer) {
      throw new NotFoundException(
        `Customer with ID '${customerId}' not found.`,
      );
    }

    return customer;
  }

  async createCreditNote(dto: any, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id: dto.customerId },
      });

      if (!customer) throw new NotFoundException('Customer not found');

      const noteNumber = `CN-${Date.now().toString().slice(-8)}`;
      const amount = new Prisma.Decimal(dto.amount);

      const note = await tx.creditDebitNote.create({
        data: {
          customerId: dto.customerId,
          noteNumber,
          noteType: 'CREDIT_NOTE',
          amount,
          reason: dto.reason,
          referenceType: 'MANUAL',
          createdBy: userId,
        },
      });

      const newBalance = (customer.currentBalance || new Prisma.Decimal(0)).sub(
        amount,
      );

      await tx.customer.update({
        where: { id: dto.customerId },
        data: { currentBalance: newBalance },
      });

      await tx.ledgerEntry.create({
        data: {
          customerId: dto.customerId,
          entryDate: new Date(),
          entryType: 'CREDIT_NOTE',
          referenceType: 'MANUAL',
          referenceId: note.id,
          debit: new Prisma.Decimal(0),
          credit: amount,
          balanceAfterEntry: newBalance,
          description: `Credit Note ${noteNumber} issued: ${dto.reason}`,
          createdBy: userId,
        },
      });

      return note;
    });
  }

  async createDebitNote(dto: any, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id: dto.customerId },
      });

      if (!customer) throw new NotFoundException('Customer not found');

      const noteNumber = `DN-${Date.now().toString().slice(-8)}`;
      const amount = new Prisma.Decimal(dto.amount);

      const note = await tx.creditDebitNote.create({
        data: {
          customerId: dto.customerId,
          noteNumber,
          noteType: 'DEBIT_NOTE',
          amount,
          reason: dto.reason,
          referenceType: 'MANUAL',
          createdBy: userId,
        },
      });

      const newBalance = (customer.currentBalance || new Prisma.Decimal(0)).add(
        amount,
      );

      await tx.customer.update({
        where: { id: dto.customerId },
        data: { currentBalance: newBalance },
      });

      await tx.ledgerEntry.create({
        data: {
          customerId: dto.customerId,
          entryDate: new Date(),
          entryType: 'DEBIT_NOTE',
          referenceType: 'MANUAL',
          referenceId: note.id,
          debit: amount,
          credit: new Prisma.Decimal(0),
          balanceAfterEntry: newBalance,
          description: `Debit Note ${noteNumber} issued: ${dto.reason}`,
          createdBy: userId,
        },
      });

      return note;
    });
  }

  async exportLedger(customerId?: string): Promise<Buffer> {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Ledger');

    sheet.columns = [
      { header: 'Date', key: 'entryDate', width: 15 },
      { header: 'Customer', key: 'customer', width: 30 },
      { header: 'Type', key: 'entryType', width: 18 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Debit (₹)', key: 'debit', width: 15 },
      { header: 'Credit (₹)', key: 'credit', width: 15 },
      { header: 'Balance (₹)', key: 'balanceAfterEntry', width: 15 },
    ];

    // Style headers
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD6E4F7' },
    };

    const where: any = {};
    if (customerId) where.customerId = customerId;

    const entries = await this.prisma.ledgerEntry.findMany({
      where,
      orderBy: { entryDate: 'asc' },
      include: {
        customer: { select: { businessName: true, customerCode: true } },
      },
    });

    entries.forEach((e) => {
      sheet.addRow({
        entryDate: e.entryDate.toLocaleDateString('en-IN'),
        customer: `${e.customer?.businessName || ''} (${e.customer?.customerCode || ''})`,
        entryType: e.entryType,
        description: e.description || '',
        debit: Number(e.debit),
        credit: Number(e.credit),
        balanceAfterEntry: Number(e.balanceAfterEntry),
      });
    });

    return workbook.xlsx.writeBuffer() as Promise<Buffer>;
  }
}
