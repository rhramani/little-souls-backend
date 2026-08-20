import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSupplierDto,
  UpdateSupplierDto,
  CreatePurchasedProductDto,
  UpdatePurchasedProductDto,
  RepeatPurchasedProductDto,
  CreatePurchaseInvoiceDto,
  CreateSupplierPaymentDto,
  UpdateSupplierPaymentDto,
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
        purchaseInvoices: true,
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
      include: {
        supplier: true,
        purchaseInvoice: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOnePurchasedProduct(id: string) {
    const product = await this.prisma.purchasedProduct.findUnique({
      where: { id },
      include: {
        supplier: true,
        purchaseInvoice: true,
      },
    });
    if (!product) {
      throw new NotFoundException(`Purchased product with ID "${id}" not found.`);
    }
    return product;
  }

  async createPurchasedProduct(dto: CreatePurchasedProductDto) {
    // Check if supplier exists
    await this.findOneSupplier(dto.supplierId);

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
        purchaseInvoiceId: dto.purchaseInvoiceId,
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

  async repeatPurchasedProduct(dto: RepeatPurchasedProductDto) {
    const existing = await this.prisma.purchasedProduct.findFirst({
      where: {
        sku: { equals: dto.sku, mode: 'insensitive' },
        ...(dto.supplierId ? { supplierId: dto.supplierId } : {}),
      },
      include: {
        supplier: true,
      },
    });

    if (!existing) {
      throw new NotFoundException(
        `Purchased product with SKU "${dto.sku}" not found.`,
      );
    }

    const supplierId = dto.supplierId || existing.supplierId;
    const purchasePrice =
      dto.purchasePrice !== undefined && dto.purchasePrice !== null
        ? Number(dto.purchasePrice)
        : existing.purchasePrice;
    const qty = Number(dto.quantity);
    const lineTotal = purchasePrice * qty;
    const purchaseDate = new Date(dto.date);

    return this.prisma.$transaction(async (tx) => {
      // Find or create the PurchaseInvoice
      let invoice = await tx.purchaseInvoice.findUnique({
        where: { invoiceNumber: dto.invoiceNumber },
        include: { items: true },
      });

      if (invoice) {
        // Check if item already exists in this invoice
        const existingItem = invoice.items?.find(
          (it) => it.sku.toLowerCase() === dto.sku.toLowerCase(),
        );

        if (existingItem) {
          await tx.purchaseInvoiceItem.update({
            where: { id: existingItem.id },
            data: {
              quantity: existingItem.quantity + qty,
              total: existingItem.total + lineTotal,
            },
          });
        } else {
          await tx.purchaseInvoiceItem.create({
            data: {
              purchaseInvoiceId: invoice.id,
              productId: existing.id,
              name: existing.name,
              sku: existing.sku,
              purchasePrice: purchasePrice,
              sellingPrice: existing.sellingPrice || null,
              quantity: qty,
              unit: existing.unit,
              discountPercent: 0,
              discountOther: 0,
              otherCharges: 0,
              taxPercent: invoice.gstRate || 0,
              total: lineTotal,
            },
          });
        }

        // Update invoice subtotal & grandTotal
        invoice = await tx.purchaseInvoice.update({
          where: { id: invoice.id },
          data: {
            subtotal: invoice.subtotal + lineTotal,
            grandTotal: invoice.grandTotal + lineTotal,
          },
          include: {
            supplier: true,
            items: true,
            purchasedProducts: true,
          },
        });
      } else {
        // Create new invoice for this repeat purchase
        invoice = await tx.purchaseInvoice.create({
          data: {
            invoiceNumber: dto.invoiceNumber,
            invoiceDate: purchaseDate,
            supplierId: supplierId,
            businessState: existing.supplier?.state || 'Other',
            withGst: false,
            gstRate: 0,
            subtotal: lineTotal,
            discountAmount: 0,
            discountPercent: 0,
            discountOther: 0,
            otherCharges: 0,
            cgstAmount: 0,
            sgstAmount: 0,
            igstAmount: 0,
            grandTotal: lineTotal,
            items: {
              create: [
                {
                  productId: existing.id,
                  name: existing.name,
                  sku: existing.sku,
                  purchasePrice: purchasePrice,
                  sellingPrice: existing.sellingPrice || null,
                  quantity: qty,
                  unit: existing.unit,
                  discountPercent: 0,
                  discountOther: 0,
                  otherCharges: 0,
                  taxPercent: 0,
                  total: lineTotal,
                },
              ],
            },
          },
          include: {
            supplier: true,
            items: true,
            purchasedProducts: true,
          },
        });
      }

      // Update existing PurchasedProduct (add quantity to existing stock)
      // Retain movedToCatalogId, movedToCategoryId, and movedQuantity so previous transferred quantity is tracked
      const currentMovedQty =
        existing.movedQuantity !== null && existing.movedQuantity !== undefined
          ? existing.movedQuantity
          : existing.movedToCatalogId
          ? existing.quantity
          : 0;

      const updatedProduct = await tx.purchasedProduct.update({
        where: { id: existing.id },
        data: {
          quantity: existing.quantity + qty,
          movedQuantity: currentMovedQty,
          purchasePrice: purchasePrice,
          purchaseDate: purchaseDate,
          purchaseInvoiceId: invoice.id,
        },
        include: {
          supplier: true,
          purchaseInvoice: true,
        },
      });

      return {
        product: updatedProduct,
        invoice,
      };
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
        purchasedProducts: true,
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

    return this.prisma.$transaction(async (tx) => {
      // Create the invoice
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
          discountPercent: dto.discountPercent !== undefined ? dto.discountPercent : 0,
          discountOther: dto.discountOther !== undefined ? dto.discountOther : 0,
          otherCharges: dto.otherCharges !== undefined ? dto.otherCharges : 0,
          cgstAmount: dto.cgstAmount,
          sgstAmount: dto.sgstAmount,
          igstAmount: dto.igstAmount,
          grandTotal: dto.grandTotal,
        },
      });

      // Create invoice items
      const itemsData = dto.items.map((item) => ({
        purchaseInvoiceId: invoice.id,
        productId: item.productId || null,
        name: item.name,
        sku: item.sku,
        purchasePrice: item.purchasePrice,
        sellingPrice: item.sellingPrice || null,
        quantity: item.quantity,
        unit: item.unit,
        discountPercent: item.discountPercent,
        discountOther: item.discountOther || 0,
        otherCharges: item.otherCharges || 0,
        taxPercent: item.taxPercent,
        total: item.total,
      }));

      await tx.purchaseInvoiceItem.createMany({
        data: itemsData,
      });

      // For each item, create or update PurchasedProduct records
      for (const item of dto.items) {
        // Check if a product with the same SKU and supplierId already exists
        const existingProducts = await tx.purchasedProduct.findMany({
          where: {
            sku: item.sku,
            supplierId: dto.supplierId,
          },
        });

        if (existingProducts.length > 0) {
          // Update existing product: increment quantity, update price to latest
          const existing = existingProducts[0];
          const currentMovedQty =
            existing.movedQuantity !== null && existing.movedQuantity !== undefined
              ? existing.movedQuantity
              : existing.movedToCatalogId
              ? existing.quantity
              : 0;

          await tx.purchasedProduct.update({
            where: { id: existing.id },
            data: {
              quantity: existing.quantity + item.quantity,
              movedQuantity: currentMovedQty,
              purchasePrice: item.purchasePrice,
              sellingPrice: item.sellingPrice || existing.sellingPrice,
              purchaseDate: new Date(dto.invoiceDate),
              purchaseInvoiceId: invoice.id,
              name: item.name,
              productImage: item.productImage || existing.productImage,
              description: item.description || existing.description,
            },
          });
        } else {
          // Create new product record
          await tx.purchasedProduct.create({
            data: {
              name: item.name,
              sku: item.sku,
              purchasePrice: item.purchasePrice,
              sellingPrice: item.sellingPrice,
              quantity: item.quantity,
              unit: item.unit,
              supplierId: dto.supplierId,
              purchaseInvoiceId: invoice.id,
              purchaseDate: new Date(dto.invoiceDate),
              productImage: item.productImage,
              description: item.description,
              category: item.category,
              brand: item.brand,
              status: 'Active',
            },
          });
        }
      }

      // Reload the created invoice with relations
      return tx.purchaseInvoice.findUnique({
        where: { id: invoice.id },
        include: {
          supplier: true,
          items: true,
          purchasedProducts: true,
        },
      });
    });
  }

  async updatePurchaseInvoice(id: string, dto: CreatePurchaseInvoiceDto) {
    const existingInv = await this.prisma.purchaseInvoice.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existingInv) {
      throw new NotFoundException(`Purchase invoice with ID "${id}" not found.`);
    }

    if (dto.supplierId) {
      await this.findOneSupplier(dto.supplierId);
    }

    return this.prisma.$transaction(async (tx) => {
      // Update invoice header
      await tx.purchaseInvoice.update({
        where: { id },
        data: {
          invoiceNumber: dto.invoiceNumber,
          invoiceDate: new Date(dto.invoiceDate),
          supplierId: dto.supplierId,
          businessState: dto.businessState,
          withGst: dto.withGst,
          gstRate: dto.gstRate,
          subtotal: dto.subtotal,
          discountAmount: dto.discountAmount,
          discountPercent: dto.discountPercent !== undefined ? dto.discountPercent : 0,
          discountOther: dto.discountOther !== undefined ? dto.discountOther : 0,
          otherCharges: dto.otherCharges !== undefined ? dto.otherCharges : 0,
          cgstAmount: dto.cgstAmount,
          sgstAmount: dto.sgstAmount,
          igstAmount: dto.igstAmount,
          grandTotal: dto.grandTotal,
        },
      });

      // Delete existing line items
      await tx.purchaseInvoiceItem.deleteMany({
        where: { purchaseInvoiceId: id },
      });

      // Insert new line items
      const itemsData = dto.items.map((item) => ({
        purchaseInvoiceId: id,
        productId: item.productId || null,
        name: item.name,
        sku: item.sku,
        purchasePrice: item.purchasePrice,
        sellingPrice: item.sellingPrice || null,
        quantity: item.quantity,
        unit: item.unit,
        discountPercent: item.discountPercent,
        discountOther: item.discountOther || 0,
        otherCharges: item.otherCharges || 0,
        taxPercent: item.taxPercent,
        total: item.total,
      }));

      await tx.purchaseInvoiceItem.createMany({
        data: itemsData,
      });

      return tx.purchaseInvoice.findUnique({
        where: { id },
        include: {
          supplier: true,
          items: true,
          purchasedProducts: true,
        },
      });
    });
  }

  async removePurchaseInvoice(id: string) {
    const invoice = await this.prisma.purchaseInvoice.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!invoice) {
      throw new NotFoundException(`Purchase invoice with ID "${id}" not found.`);
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Delete associated supplier payments tied to this invoice or invoice number
      await tx.supplierPayment.deleteMany({
        where: {
          OR: [
            { purchaseInvoiceId: id },
            { referenceNumber: { equals: invoice.invoiceNumber, mode: 'insensitive' } },
            { referenceNumber: { equals: `INV-${invoice.invoiceNumber}`, mode: 'insensitive' } },
            { referenceNumber: { contains: invoice.invoiceNumber, mode: 'insensitive' } },
            { notes: { contains: invoice.invoiceNumber, mode: 'insensitive' } },
          ],
        },
      });

      // 2. Adjust or remove purchased products linked to this invoice's line items
      for (const item of invoice.items) {
        const existingProducts = await tx.purchasedProduct.findMany({
          where: {
            sku: { equals: item.sku, mode: 'insensitive' },
            supplierId: invoice.supplierId,
          },
        });

        for (const prod of existingProducts) {
          const remainingQty = prod.quantity - item.quantity;

          if (remainingQty > 0) {
            // Find another remaining invoice for this product/sku
            const otherInvoiceItems = await tx.purchaseInvoiceItem.findMany({
              where: {
                sku: { equals: item.sku, mode: 'insensitive' },
                purchaseInvoice: {
                  id: { not: id },
                  supplierId: invoice.supplierId,
                },
              },
              include: {
                purchaseInvoice: true,
              },
              orderBy: {
                purchaseInvoice: {
                  invoiceDate: 'desc',
                },
              },
            });

            const fallbackInvoiceItem = otherInvoiceItems[0];
            const fallbackInvoice = fallbackInvoiceItem?.purchaseInvoice;

            const currentMovedQty =
              prod.movedQuantity !== null && prod.movedQuantity !== undefined
                ? prod.movedQuantity
                : prod.movedToCatalogId
                ? prod.quantity
                : 0;

            await tx.purchasedProduct.update({
              where: { id: prod.id },
              data: {
                quantity: remainingQty,
                movedQuantity: Math.min(currentMovedQty, remainingQty),
                purchaseInvoiceId: fallbackInvoice ? fallbackInvoice.id : null,
                purchasePrice: fallbackInvoiceItem
                  ? fallbackInvoiceItem.purchasePrice
                  : prod.purchasePrice,
                purchaseDate: fallbackInvoice
                  ? fallbackInvoice.invoiceDate
                  : prod.purchaseDate,
              },
            });
          } else {
            // No remaining stock for this product, safe to remove
            await tx.purchasedProduct.delete({
              where: { id: prod.id },
            });
          }
        }
      }

      // Also clean up any products directly linked to this invoice that were not covered by items
      const orphanedProducts = await tx.purchasedProduct.findMany({
        where: { purchaseInvoiceId: id },
      });
      for (const orphan of orphanedProducts) {
        await tx.purchasedProduct.delete({
          where: { id: orphan.id },
        });
      }

      // 3. Delete invoice line items
      await tx.purchaseInvoiceItem.deleteMany({
        where: { purchaseInvoiceId: id },
      });

      // 4. Delete the invoice
      return tx.purchaseInvoice.delete({
        where: { id },
      });
    });
  }

  // =========================================================================
  // SUPPLIER PAYMENT OPERATIONS
  // =========================================================================

  async findAllSupplierPayments() {
    return this.prisma.supplierPayment.findMany({
      include: { supplier: true, purchaseInvoice: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSupplierPayment(dto: CreateSupplierPaymentDto) {
    // Verify Supplier
    await this.findOneSupplier(dto.supplierId);

    return this.prisma.supplierPayment.create({
      data: {
        supplierId: dto.supplierId,
        purchaseInvoiceId: dto.purchaseInvoiceId || null,
        amount: dto.amount,
        paymentDate: new Date(dto.paymentDate),
        paymentMode: dto.paymentMode,
        referenceNumber: dto.referenceNumber,
        notes: dto.notes,
      },
      include: { supplier: true, purchaseInvoice: true },
    });
  }

  async updateSupplierPayment(id: string, dto: UpdateSupplierPaymentDto) {
    const payment = await this.prisma.supplierPayment.findUnique({
      where: { id },
    });
    if (!payment) {
      throw new NotFoundException(`Supplier payment with ID "${id}" not found.`);
    }

    if (dto.supplierId) {
      await this.findOneSupplier(dto.supplierId);
    }

    return this.prisma.supplierPayment.update({
      where: { id },
      data: {
        supplierId: dto.supplierId,
        purchaseInvoiceId:
          dto.purchaseInvoiceId !== undefined ? dto.purchaseInvoiceId : payment.purchaseInvoiceId,
        amount: dto.amount !== undefined ? dto.amount : payment.amount,
        paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : payment.paymentDate,
        paymentMode: dto.paymentMode || payment.paymentMode,
        referenceNumber:
          dto.referenceNumber !== undefined ? dto.referenceNumber : payment.referenceNumber,
        notes: dto.notes !== undefined ? dto.notes : payment.notes,
      },
      include: { supplier: true, purchaseInvoice: true },
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
