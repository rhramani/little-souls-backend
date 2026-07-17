import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSupplierDto,
  UpdateSupplierDto,
  CreatePurchasedProductDto,
  UpdatePurchasedProductDto,
  CreatePurchaseInvoiceDto,
  CreateSupplierPaymentDto,
} from './dto/purchase.dto';

@Injectable()
export class PurchaseService {
  constructor(private readonly prisma: PrismaService) {}

  // =========================================================================
  // SUPPLIER CRUD OPERATIONS
  // =========================================================================

  async findAllSuppliers() {
    return this.prisma.supplier.findMany({
      include: {
        purchasedProducts: true,
        supplierPayments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneSupplier(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
    });
    if (!supplier) {
      throw new NotFoundException(`Supplier with ID "${id}" not found.`);
    }
    return supplier;
  }

  async createSupplier(dto: CreateSupplierDto) {
    return this.prisma.supplier.create({
      data: {
        name: dto.name,
        companyName: dto.companyName,
        contactPerson: dto.contactPerson,
        mobile: dto.mobile,
        email: dto.email,
        gstNumber: dto.gstNumber,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        country: dto.country,
        pincode: dto.pincode,
        status: dto.status || 'Active',
        notes: dto.notes,
      },
    });
  }

  async updateSupplier(id: string, dto: UpdateSupplierDto) {
    await this.findOneSupplier(id);

    return this.prisma.supplier.update({
      where: { id },
      data: dto,
    });
  }

  async removeSupplier(id: string) {
    await this.findOneSupplier(id);

    // Prevent deletion if the supplier is linked to purchased products
    const productCount = await this.prisma.purchasedProduct.count({
      where: { supplierId: id },
    });
    if (productCount > 0) {
      throw new ConflictException(
        `Cannot delete supplier because it is linked to ${productCount} purchased product(s).`,
      );
    }

    return this.prisma.supplier.delete({
      where: { id },
    });
  }

  // =========================================================================
  // PURCHASED PRODUCT CRUD OPERATIONS
  // =========================================================================

  async findAllPurchasedProducts() {
    return this.prisma.purchasedProduct.findMany({
      include: { supplier: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOnePurchasedProduct(id: string) {
    const product = await this.prisma.purchasedProduct.findUnique({
      where: { id },
      include: { supplier: true },
    });
    if (!product) {
      throw new NotFoundException(`Purchased product with ID "${id}" not found.`);
    }
    return product;
  }

  async createPurchasedProduct(dto: CreatePurchasedProductDto) {
    // Check if supplier exists
    await this.findOneSupplier(dto.supplierId);

    // Verify SKU uniqueness
    const skuExists = await this.prisma.purchasedProduct.findUnique({
      where: { sku: dto.sku },
    });
    if (skuExists) {
      throw new ConflictException(`A purchased product with SKU "${dto.sku}" already exists.`);
    }

    return this.prisma.purchasedProduct.create({
      data: {
        productImage: dto.productImage,
        name: dto.name,
        sku: dto.sku,
        purchasePrice: dto.purchasePrice,
        sellingPrice: dto.sellingPrice,
        quantity: dto.quantity,
        unit: dto.unit || 'PCS',
        category: dto.category,
        brand: dto.brand,
        supplierId: dto.supplierId,
        purchaseDate: new Date(dto.purchaseDate),
        description: dto.description,
        status: dto.status || 'Active',
      },
    });
  }

  async updatePurchasedProduct(id: string, dto: UpdatePurchasedProductDto) {
    await this.findOnePurchasedProduct(id);

    if (dto.supplierId) {
      await this.findOneSupplier(dto.supplierId);
    }

    // Verify SKU uniqueness if changing SKU
    if (dto.sku) {
      const skuExists = await this.prisma.purchasedProduct.findUnique({
        where: { sku: dto.sku },
      });
      if (skuExists && skuExists.id !== id) {
        throw new ConflictException(`SKU "${dto.sku}" is already in use by another product.`);
      }
    }

    const data: any = { ...dto };
    if (dto.purchaseDate) {
      data.purchaseDate = new Date(dto.purchaseDate);
    }
    if (dto.movedAt) {
      data.movedAt = new Date(dto.movedAt);
    }

    return this.prisma.purchasedProduct.update({
      where: { id },
      data,
    });
  }

  async removePurchasedProduct(id: string) {
    await this.findOnePurchasedProduct(id);

    return this.prisma.purchasedProduct.delete({
      where: { id },
    });
  }

  // =========================================================================
  // PURCHASE INVOICE CREATION & RETRIEVAL
  // =========================================================================

  async findAllPurchaseInvoices() {
    return this.prisma.purchaseInvoice.findMany({
      include: {
        supplier: true,
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPurchaseInvoice(dto: CreatePurchaseInvoiceDto) {
    // Verify Supplier
    await this.findOneSupplier(dto.supplierId);

    // Check unique invoice number
    const invExists = await this.prisma.purchaseInvoice.findUnique({
      where: { invoiceNumber: dto.invoiceNumber },
    });
    if (invExists) {
      throw new ConflictException(`Invoice number "${dto.invoiceNumber}" already exists.`);
    }

    // In MongoDB replica sets, transactions are supported.
    // If not in a replica set, standard sequential writes work.
    // Since prisma.$transaction works, we will execute it:
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.purchaseInvoice.create({
        data: {
          invoiceNumber: dto.invoiceNumber,
          invoiceDate: new Date(dto.invoiceDate),
          supplierId: dto.supplierId,
          businessState: dto.businessState,
          withGst: dto.withGst,
          gstRate: dto.gstRate,
          subtotal: dto.subtotal,
          discountAmount: dto.discountAmount,
          cgstAmount: dto.cgstAmount,
          sgstAmount: dto.sgstAmount,
          igstAmount: dto.igstAmount,
          grandTotal: dto.grandTotal,
        },
      });

      const itemsData = dto.items.map((item) => ({
        purchaseInvoiceId: invoice.id,
        productId: item.productId,
        name: item.name,
        sku: item.sku,
        purchasePrice: item.purchasePrice,
        quantity: item.quantity,
        unit: item.unit,
        discountPercent: item.discountPercent,
        taxPercent: item.taxPercent,
        total: item.total,
      }));

      await tx.purchaseInvoiceItem.createMany({
        data: itemsData,
      });

      // Reload the created invoice with relations
      return tx.purchaseInvoice.findUnique({
        where: { id: invoice.id },
        include: {
          supplier: true,
          items: true,
        },
      });
    });
  }

  // =========================================================================
  // SUPPLIER PAYMENT OPERATIONS
  // =========================================================================

  async findAllSupplierPayments() {
    return this.prisma.supplierPayment.findMany({
      include: { supplier: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSupplierPayment(dto: CreateSupplierPaymentDto) {
    // Verify Supplier
    await this.findOneSupplier(dto.supplierId);

    return this.prisma.supplierPayment.create({
      data: {
        supplierId: dto.supplierId,
        amount: dto.amount,
        paymentDate: new Date(dto.paymentDate),
        paymentMode: dto.paymentMode,
        referenceNumber: dto.referenceNumber,
        notes: dto.notes,
      },
      include: { supplier: true },
    });
  }

  async removeSupplierPayment(id: string) {
    const payment = await this.prisma.supplierPayment.findUnique({
      where: { id },
    });
    if (!payment) {
      throw new NotFoundException(`Supplier payment with ID "${id}" not found.`);
    }

    return this.prisma.supplierPayment.delete({
      where: { id },
    });
  }
}

