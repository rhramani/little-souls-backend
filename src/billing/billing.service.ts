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
      return this.prisma.invoice.findUnique({
        where: { id: existingInvoice.id },
        include: {
          items: true,
        },
      });
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
        customer?.billingAddressLine1,
        customer?.billingAddressLine2,
        customer?.billingCity,
        customer?.billingState,
        customer?.billingPincode,
        customer?.billingCountry,
      ]
        .filter(Boolean)
        .join(', ') || null;

    const shippingAddress =
      order.deliveryAddress ||
      [
        customer?.shippingAddressLine1,
        customer?.shippingAddressLine2,
        customer?.shippingCity,
        customer?.shippingState,
        customer?.shippingPincode,
        customer?.shippingCountry,
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
          gstin: customer?.gstin || null,
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
        taxPercent: item.taxPercent || 0,
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

      const newBalance = (currentCust?.currentBalance || 0) + order.grandTotal;

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
          credit: 0,
          balanceAfterEntry: newBalance,
          description: `Invoice ${invoiceNumber} generated for Order ${order.orderNumber}`,
          transactionStatus: 'PENDING',
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
    const transactionDate = dto.transactionDate ? new Date(dto.transactionDate) : new Date();
    const amountDec = Number(dto.amount);
    const statusToUse = dto.paymentStatus || (isVerified ? 'VERIFIED' : 'PENDING');

    if (isVerified || dto.paymentStatus === 'VERIFIED') {
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
            paymentStatus: statusToUse,
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

        const newBalance = (currentCust?.currentBalance || 0) - amountDec;

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
            debit: 0,
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

      const newBalance = (currentCust?.currentBalance || 0) - payment.amount;

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
          debit: 0,
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

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          order: {
            select: { orderNumber: true },
          },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    // Safe manual join — avoids crash when customerId references a deleted customer
    const customerIds = [...new Set(invoices.map((i) => i.customerId).filter(Boolean))];
    const customers = customerIds.length
      ? await this.prisma.customer.findMany({
          where: { id: { in: customerIds } },
          select: {
            id: true,
            businessName: true,
            customerCode: true,
            gstin: true,
            billingAddressLine1: true,
            billingAddressLine2: true,
            billingCity: true,
            billingState: true,
            billingPincode: true,
            billingCountry: true,
            shippingAddressLine1: true,
            shippingAddressLine2: true,
            shippingCity: true,
            shippingState: true,
            shippingPincode: true,
            shippingCountry: true,
            mainContactNumber: true,
          },
        })
      : [];
    const customerMap = new Map(customers.map((c) => [c.id, c]));

    const invoicesWithCustomer = invoices.map((i) => ({
      ...i,
      customer: customerMap.get(i.customerId) ?? null,
    }));

    return {
      invoices: invoicesWithCustomer,
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
        items: {
          include: {
            product: {
              include: {
                images: true,
              },
            },
          },
        },
        order: {
          include: {
            items: {
              include: {
                product: {
                  include: {
                    images: true,
                  },
                },
              },
            },
          },
        },
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

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.count({ where }),
    ]);

    // Safe manual join — avoids crash when customerId references a deleted customer
    const customerIds = [...new Set(payments.map((p) => p.customerId).filter(Boolean))];
    const customers = customerIds.length
      ? await this.prisma.customer.findMany({
          where: { id: { in: customerIds } },
          select: {
            id: true,
            businessName: true,
            customerCode: true,
            gstin: true,
            billingAddressLine1: true,
            billingAddressLine2: true,
            billingCity: true,
            billingState: true,
            billingPincode: true,
            billingCountry: true,
            shippingAddressLine1: true,
            shippingAddressLine2: true,
            shippingCity: true,
            shippingState: true,
            shippingPincode: true,
            shippingCountry: true,
            mainContactNumber: true,
          },
        })
      : [];
    const customerMap = new Map(customers.map((c) => [c.id, c]));

    const paymentsWithCustomer = payments.map((p) => ({
      ...p,
      customer: customerMap.get(p.customerId) ?? null,
    }));

    return {
      payments: paymentsWithCustomer,
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
      // MongoDB supports regex-based search; 'contains' with mode:'insensitive' is not supported
      where.OR = [
        { description: { contains: searchTrimmed } },
        { entryType: { contains: searchTrimmed } },
      ];
    }

    if (type) {
      if (type === 'debit' || type === 'unpaid') {
        where.debit = { gt: 0 };
      } else if (type === 'credit' || type === 'paid') {
        where.credit = { gt: 0 };
      }
    }

    const [ledgerEntries, total] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { entryDate: 'desc' },
      }),
      this.prisma.ledgerEntry.count({ where }),
    ]);

    // Safe manual join — avoids crash when customerId references a deleted customer
    const customerIds = [...new Set(ledgerEntries.map((e) => e.customerId).filter(Boolean))];
    const customers = customerIds.length
      ? await this.prisma.customer.findMany({
          where: { id: { in: customerIds } },
          select: {
            id: true,
            businessName: true,
            customerCode: true,
            gstin: true,
            billingAddressLine1: true,
            billingAddressLine2: true,
            billingCity: true,
            billingState: true,
            billingPincode: true,
            billingCountry: true,
            shippingAddressLine1: true,
            shippingAddressLine2: true,
            shippingCity: true,
            shippingState: true,
            shippingPincode: true,
            shippingCountry: true,
            mainContactNumber: true,
          },
        })
      : [];
    const customerMap = new Map(customers.map((c) => [c.id, c]));

    const ledgerEntriesWithCustomer = ledgerEntries.map((e) => ({
      ...e,
      customer: customerMap.get(e.customerId) ?? null,
    }));

    return {
      ledgerEntries: ledgerEntriesWithCustomer,
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
    const res = await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id: dto.customerId },
      });

      if (!customer) throw new NotFoundException('Customer not found');

      const noteNumber = `CN-${Date.now().toString().slice(-8)}`;
      const discountVal = Number(dto.discountAmount || 0);
      const packingVal = Number(dto.packingCharges || 0);
      const otherVal = Number(dto.otherCharges || 0);
      const amount = dto.amount ? Number(dto.amount) : (discountVal + packingVal + otherVal);

      const chargeLabel =
        dto.chargeType === 'DISCOUNT'
          ? 'Discount'
          : dto.chargeType === 'PACKING'
          ? 'Packing Charges'
          : dto.chargeType === 'OTHER'
          ? 'Other Charges'
          : 'Credit Note Adjustment';

      let refType = 'MANUAL';
      let refId: string | undefined = undefined;
      let payTag = '';

      if (dto.paymentId) {
        refType = 'PAYMENT';
        payTag = ` [Payment: ${dto.paymentId}]`;
        const targetPayment = await tx.payment.findFirst({
          where: {
            OR: [
              ...(dto.paymentId.length === 24 ? [{ id: dto.paymentId }] : []),
              { referenceNumber: dto.paymentId },
              { paymentNumber: dto.paymentId },
            ],
          },
        });
        if (targetPayment) {
          refId = targetPayment.id;
        }
      }

      const noteData: any = {
        customerId: dto.customerId,
        noteNumber,
        noteType: 'CREDIT_NOTE',
        chargeType: dto.chargeType || 'CUSTOM',
        amount,
        discountAmount: discountVal,
        packingCharges: packingVal,
        otherCharges: otherVal,
        reason: dto.reason ? `${dto.reason}${payTag}` : payTag,
        referenceType: refType,
        ...(refId && { referenceId: refId }),
        createdBy: userId,
      };

      const note = await tx.creditDebitNote.create({
        data: noteData,
      });

      const newBalance = (customer.currentBalance || 0) - amount;

      await tx.customer.update({
        where: { id: dto.customerId },
        data: { currentBalance: newBalance },
      });

      const breakdownParts: string[] = [];
      if (discountVal > 0) breakdownParts.push(`Discount: ₹${discountVal}`);
      if (packingVal > 0) breakdownParts.push(`Packing: ₹${packingVal}`);
      if (otherVal > 0) breakdownParts.push(`Other: ₹${otherVal}`);

      const descText = `${chargeLabel} — ${noteNumber}${payTag}${breakdownParts.length ? ` (${breakdownParts.join(', ')})` : ''}: ${dto.reason || ''}`;

      await tx.ledgerEntry.create({
        data: {
          customerId: dto.customerId,
          entryDate: new Date(),
          entryType: 'CREDIT_NOTE',
          referenceType: refType,
          referenceId: note.id,
          debit: 0,
          credit: amount,
          balanceAfterEntry: newBalance,
          description: descText,
          transactionStatus: dto.status || dto.transactionStatus || 'COMPLETED',
          createdBy: userId,
        },
      });

      return note;
    });

    await this.recalculateCustomerBalance(dto.customerId);
    return res;
  }

  async createDebitNote(dto: any, userId: string) {
    const res = await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id: dto.customerId },
      });

      if (!customer) throw new NotFoundException('Customer not found');

      const noteNumber = `DN-${Date.now().toString().slice(-8)}`;
      const discountVal = Number(dto.discountAmount || 0);
      const packingVal = Number(dto.packingCharges || 0);
      const otherVal = Number(dto.otherCharges || 0);
      const amount = dto.amount ? Number(dto.amount) : (discountVal + packingVal + otherVal);

      const chargeLabel =
        dto.chargeType === 'PACKING'
          ? 'Packing Charges'
          : dto.chargeType === 'OTHER'
          ? 'Other Charges'
          : dto.chargeType === 'DISCOUNT'
          ? 'Discount'
          : 'Debit Note Adjustment';

      let refType = 'MANUAL';
      let refId: string | undefined = undefined;
      let payTag = '';

      if (dto.paymentId) {
        refType = 'PAYMENT';
        payTag = ` [Payment: ${dto.paymentId}]`;
        const targetPayment = await tx.payment.findFirst({
          where: {
            OR: [
              ...(dto.paymentId.length === 24 ? [{ id: dto.paymentId }] : []),
              { referenceNumber: dto.paymentId },
              { paymentNumber: dto.paymentId },
            ],
          },
        });
        if (targetPayment) {
          refId = targetPayment.id;
        }
      }

      const noteData: any = {
        customerId: dto.customerId,
        noteNumber,
        noteType: 'DEBIT_NOTE',
        chargeType: dto.chargeType || 'CUSTOM',
        amount,
        discountAmount: discountVal,
        packingCharges: packingVal,
        otherCharges: otherVal,
        reason: dto.reason ? `${dto.reason}${payTag}` : payTag,
        referenceType: refType,
        ...(refId && { referenceId: refId }),
        createdBy: userId,
      };

      const note = await tx.creditDebitNote.create({
        data: noteData,
      });

      const newBalance = (customer.currentBalance || 0) + amount;

      await tx.customer.update({
        where: { id: dto.customerId },
        data: { currentBalance: newBalance },
      });

      const breakdownParts: string[] = [];
      if (discountVal > 0) breakdownParts.push(`Discount: ₹${discountVal}`);
      if (packingVal > 0) breakdownParts.push(`Packing: ₹${packingVal}`);
      if (otherVal > 0) breakdownParts.push(`Other: ₹${otherVal}`);

      const descText = `${chargeLabel} — ${noteNumber}${payTag}${breakdownParts.length ? ` (${breakdownParts.join(', ')})` : ''}: ${dto.reason || ''}`;

      await tx.ledgerEntry.create({
        data: {
          customerId: dto.customerId,
          entryDate: new Date(),
          entryType: 'DEBIT_NOTE',
          referenceType: refType,
          referenceId: note.id,
          debit: amount,
          credit: 0,
          balanceAfterEntry: newBalance,
          description: descText,
          transactionStatus: dto.status || dto.transactionStatus || 'COMPLETED',
          createdBy: userId,
        },
      });

      return note;
    });

    await this.recalculateCustomerBalance(dto.customerId);
    return res;
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

  async updateLedgerEntry(id: string, data: { amount?: number; referenceNumber?: string; notes?: string; transactionStatus?: string }) {
    const entry = await this.prisma.ledgerEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException(`Ledger entry with ID '${id}' not found.`);

    const VALID_STATUSES = ['COMPLETED', 'PENDING', 'CANCELLED', 'ADVANCE'];

    const updatedEntry = await this.prisma.ledgerEntry.update({
      where: { id },
      data: {
        ...(data.amount !== undefined && {
          debit: entry.debit > 0 ? data.amount : 0,
          credit: entry.credit > 0 ? data.amount : 0,
        }),
        ...(data.notes !== undefined && { description: data.notes }),
        ...(data.transactionStatus !== undefined &&
          VALID_STATUSES.includes(data.transactionStatus) && {
            transactionStatus: data.transactionStatus,
          }),
      },
    });

    await this.recalculateCustomerBalance(entry.customerId);

    return updatedEntry;
  }

  async deleteLedgerEntry(id: string) {
    const entry = await this.prisma.ledgerEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException(`Ledger entry with ID '${id}' not found.`);

    const customerId = entry.customerId;

    // 1. If this entry is a PAYMENT entry or linked to a Payment, also delete the Payment
    if (entry.referenceType === 'PAYMENT' && entry.referenceId) {
      const linkedPayment = await this.prisma.payment.findFirst({
        where: {
          OR: [
            ...(entry.referenceId.length === 24 ? [{ id: entry.referenceId }] : []),
            { paymentNumber: entry.referenceId },
            { referenceNumber: entry.referenceId },
          ],
        },
      });
      if (linkedPayment) {
        return this.deletePayment(linkedPayment.id);
      }
    }

    // 2. Find any linked CreditDebitNote records where referenceId matches entry.id or entry.referenceId
    const candidateRefIds = [entry.id, entry.referenceId].filter((x): x is string => Boolean(x));
    const linkedNotes = await this.prisma.creditDebitNote.findMany({
      where: {
        customerId,
        OR: [
          { referenceId: { in: candidateRefIds } },
          ...(entry.entryType === 'CREDIT_NOTE' || entry.entryType === 'DEBIT_NOTE'
            ? [{ id: entry.referenceId || entry.id }]
            : []),
        ],
      },
      select: { id: true },
    });

    const noteIds = linkedNotes.map((n) => n.id);
    if ((entry.entryType === 'CREDIT_NOTE' || entry.entryType === 'DEBIT_NOTE') && entry.referenceId) {
      noteIds.push(entry.referenceId);
    }

    // 3. Delete ledger entries for linked notes
    if (noteIds.length > 0) {
      await this.prisma.ledgerEntry.deleteMany({
        where: {
          customerId,
          OR: [
            { referenceId: { in: noteIds } },
            { id: { in: noteIds } },
          ],
        },
      });
      // Delete credit/debit note records
      await this.prisma.creditDebitNote.deleteMany({
        where: { id: { in: noteIds } },
      });
    }

    // 4. Delete the target ledger entry
    await this.prisma.ledgerEntry.deleteMany({
      where: { id },
    });

    // 5. Recalculate customer balance
    await this.recalculateCustomerBalance(customerId);

    return { message: 'Ledger entry and associated notes deleted successfully.' };
  }

  async updatePayment(id: string, data: { amount?: number; referenceNumber?: string; notes?: string }) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException(`Payment with ID '${id}' not found.`);

    const updatedPayment = await this.prisma.payment.update({
      where: { id },
      data: {
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.referenceNumber !== undefined && { referenceNumber: data.referenceNumber }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    });

    await this.recalculateCustomerBalance(payment.customerId);

    return updatedPayment;
  }

  async deletePayment(id: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException(`Payment with ID '${id}' not found.`);

    const customerId = payment.customerId;
    const refVariants = [
      payment.id,
      payment.paymentNumber,
      payment.referenceNumber,
    ].filter((x): x is string => Boolean(x));

    // 1. Find all linked CreditDebitNotes for this payment
    const linkedNotes = await this.prisma.creditDebitNote.findMany({
      where: {
        customerId,
        OR: [
          { referenceId: { in: refVariants } },
          { reason: { contains: payment.id } },
          { reason: { contains: payment.paymentNumber } },
        ],
      },
      select: { id: true },
    });

    const noteIds = linkedNotes.map((n) => n.id);

    // 2. Delete ledger entries for linked notes
    if (noteIds.length > 0) {
      await this.prisma.ledgerEntry.deleteMany({
        where: {
          customerId,
          OR: [
            { referenceId: { in: noteIds } },
            { id: { in: noteIds } },
          ],
        },
      });

      // Delete credit/debit notes
      await this.prisma.creditDebitNote.deleteMany({
        where: { id: { in: noteIds } },
      });
    }

    // 3. Delete ledger entries for the payment itself
    await this.prisma.ledgerEntry.deleteMany({
      where: {
        customerId,
        OR: [
          { referenceId: { in: refVariants } },
          { id: payment.id },
        ],
      },
    });

    // 4. Delete the payment record
    await this.prisma.payment.delete({ where: { id } });

    // 5. Recalculate customer balance
    await this.recalculateCustomerBalance(customerId);

    return { message: 'Payment and associated credit/debit notes deleted successfully.' };
  }

  async recalculateCustomerBalance(customerId: string) {
    // 1. Find valid payment reference identifiers
    const payments = await this.prisma.payment.findMany({
      where: { customerId },
      select: { id: true, paymentNumber: true, referenceNumber: true },
    });

    const validPaymentRefIds = new Set([
      ...payments.map((p) => p.id),
      ...payments.map((p) => p.paymentNumber).filter(Boolean),
      ...payments.map((p) => p.referenceNumber).filter(Boolean),
    ]);

    // Find valid invoices
    const invoices = await this.prisma.invoice.findMany({
      where: { customerId },
      select: { id: true, invoiceNumber: true, orderId: true },
    });
    const validInvoiceRefIds = new Set([
      ...invoices.map((i) => i.id),
      ...invoices.map((i) => i.invoiceNumber).filter(Boolean),
      ...invoices.map((i) => i.orderId).filter(Boolean),
    ]);

    // 2. Find orphan CreditDebitNotes where referenceType is PAYMENT or INVOICE but referenceId is no longer valid
    const orphanNotes = await this.prisma.creditDebitNote.findMany({
      where: { customerId },
      select: { id: true, referenceType: true, referenceId: true },
    });

    const orphanNoteIds = orphanNotes
      .filter((n) => {
        if (!n.referenceId) return false;
        if (n.referenceType === 'PAYMENT' && !validPaymentRefIds.has(n.referenceId)) return true;
        if (n.referenceType === 'INVOICE' && !validInvoiceRefIds.has(n.referenceId)) return true;
        return false;
      })
      .map((n) => n.id);

    if (orphanNoteIds.length > 0) {
      await this.prisma.ledgerEntry.deleteMany({
        where: {
          customerId,
          OR: [
            { referenceId: { in: orphanNoteIds } },
            { id: { in: orphanNoteIds } },
          ],
        },
      });
      await this.prisma.creditDebitNote.deleteMany({
        where: { id: { in: orphanNoteIds } },
      });
    }

    // 3. Find orphan LedgerEntries for PAYMENT where referenceId does not exist in Payment table
    const orphanPaymentLedgers = await this.prisma.ledgerEntry.findMany({
      where: {
        customerId,
        entryType: 'PAYMENT',
        referenceType: 'PAYMENT',
      },
      select: { id: true, referenceId: true },
    });

    const orphanPaymentLedgerIds = orphanPaymentLedgers
      .filter((l) => l.referenceId && !validPaymentRefIds.has(l.referenceId))
      .map((l) => l.id);

    if (orphanPaymentLedgerIds.length > 0) {
      await this.prisma.ledgerEntry.deleteMany({
        where: { id: { in: orphanPaymentLedgerIds } },
      });
    }

    // 4. Aggregate clean ledger entries
    const ledgerSums = await this.prisma.ledgerEntry.aggregate({
      where: {
        customerId,
        transactionStatus: { notIn: ['CANCELLED', 'VOIDED'] },
      },
      _sum: {
        debit: true,
        credit: true,
      },
    });

    const pendingDebitEntry = await this.prisma.ledgerEntry.findFirst({
      where: {
        customerId,
        debit: { gt: 0 },
        transactionStatus: 'PENDING',
      },
    });

    const totalDebit = ledgerSums._sum.debit || 0;
    const totalCredit = ledgerSums._sum.credit || 0;
    const pendingAmount = pendingDebitEntry ? Math.max(0, totalDebit - totalCredit) : 0;

    // 5. Update invoice payment status dynamically
    if (totalDebit > 0) {
      if (pendingAmount <= 0) {
        await this.prisma.invoice.updateMany({
          where: { customerId },
          data: { paymentStatus: 'PAID' },
        });
      } else if (totalCredit > 0) {
        await this.prisma.invoice.updateMany({
          where: { customerId },
          data: { paymentStatus: 'PARTIAL' },
        });
      } else {
        await this.prisma.invoice.updateMany({
          where: { customerId },
          data: { paymentStatus: 'UNPAID' },
        });
      }
    }

    await this.prisma.customer.update({
      where: { id: customerId },
      data: { currentBalance: pendingAmount },
    });

    return { totalDebit, totalCredit, pendingAmount };
  }

  async clearAllAccountsData() {
    await this.prisma.$transaction(async (tx) => {
      await tx.creditDebitNote.deleteMany({});
      await tx.payment.deleteMany({});
      await tx.ledgerEntry.deleteMany({});
      await tx.customer.updateMany({ data: { currentBalance: 0 } });
    });
    return { message: 'All accounts and ledger data removed successfully.' };
  }

  private async findNoteByAnyIdentifier(id: string) {
    let note = await this.prisma.creditDebitNote.findFirst({
      where: {
        OR: [
          { id },
          { noteNumber: id },
          { referenceId: id },
        ],
      },
    });

    if (!note) {
      const ledger = await this.prisma.ledgerEntry.findUnique({ where: { id } });
      if (ledger) {
        const refIds = [ledger.referenceId, ledger.id].filter((x): x is string => Boolean(x));
        const noteMatch = ledger.description?.match(/\b(CN|DN)-[a-zA-Z0-9-]+\b/i)?.[0];
        if (noteMatch) refIds.push(noteMatch);

        note = await this.prisma.creditDebitNote.findFirst({
          where: {
            OR: [
              { id: { in: refIds } },
              { noteNumber: { in: refIds } },
              { referenceId: { in: refIds } },
            ],
          },
        });
      }
    }

    return note;
  }

  async updateCreditDebitNote(
    id: string,
    data: { amount?: number; reason?: string; chargeType?: string },
  ) {
    const note = await this.findNoteByAnyIdentifier(id);
    if (!note) throw new NotFoundException(`Credit/Debit note with ID '${id}' not found.`);

    const newAmount = data.amount !== undefined ? data.amount : note.amount;
    const newReason = data.reason !== undefined ? data.reason : note.reason;

    const updatedNote = await this.prisma.creditDebitNote.update({
      where: { id: note.id },
      data: {
        amount: newAmount,
        reason: newReason,
        ...(data.chargeType && { chargeType: data.chargeType as any }),
      },
    });

    const isCN = note.noteType === 'CREDIT_NOTE';
    const noteNumber = note.noteNumber;

    await this.prisma.ledgerEntry.updateMany({
      where: {
        customerId: note.customerId,
        OR: [
          { referenceId: note.id },
          { id: note.id },
          { id },
          { description: { contains: noteNumber } },
        ],
      },
      data: {
        debit: isCN ? 0 : newAmount,
        credit: isCN ? newAmount : 0,
        description: `${data.chargeType || note.chargeType || (isCN ? 'Credit Note' : 'Debit Note')} - ${noteNumber}: ${newReason}`,
      },
    });

    await this.recalculateCustomerBalance(note.customerId);

    return updatedNote;
  }

  async deleteCreditDebitNote(id: string) {
    const note = await this.findNoteByAnyIdentifier(id);
    if (!note) {
      const ledger = await this.prisma.ledgerEntry.findUnique({ where: { id } });
      if (ledger) {
        await this.prisma.ledgerEntry.delete({ where: { id } });
        await this.recalculateCustomerBalance(ledger.customerId);
        return { message: 'Ledger entry deleted successfully.' };
      }
      throw new NotFoundException(`Credit/Debit note with ID '${id}' not found.`);
    }

    const customerId = note.customerId;
    const noteNumber = note.noteNumber;

    await this.prisma.ledgerEntry.deleteMany({
      where: {
        customerId,
        OR: [
          { referenceId: note.id },
          { id: note.id },
          { id },
          { description: { contains: noteNumber } },
        ],
      },
    });

    await this.prisma.creditDebitNote.delete({ where: { id: note.id } });

    await this.recalculateCustomerBalance(customerId);

    return { message: 'Credit/Debit note deleted successfully.' };
  }
}
