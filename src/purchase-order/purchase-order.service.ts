import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { Prisma, StockStatus } from '@prisma/client';

@Injectable()
export class PurchaseOrderService {
  constructor(private readonly prisma: PrismaService) {}

  // ================= SUPPLIER METHODS =================

  async createSupplier(dto: CreateSupplierDto) {
    return this.prisma.supplier.create({
      data: dto,
    });
  }

  async findAllSuppliers() {
    return this.prisma.supplier.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findOneSupplier(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
    });
    if (!supplier) {
      throw new NotFoundException(`Supplier with ID '${id}' not found.`);
    }
    return supplier;
  }

  async updateSupplier(id: string, dto: CreateSupplierDto) {
    await this.findOneSupplier(id);
    return this.prisma.supplier.update({
      where: { id },
      data: dto,
    });
  }

  // ================= PURCHASE ORDER METHODS =================

  async createPurchaseOrder(dto: CreatePurchaseOrderDto, userId: string) {
    // 1. Verify Supplier exists
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: dto.supplierId },
    });
    if (!supplier) {
      throw new NotFoundException(`Supplier with ID '${dto.supplierId}' not found.`);
    }

    // 2. Validate all products exist
    const productIds = dto.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException('One or more products specified in purchase items do not exist.');
    }

    const poNumber = `PO-${Date.now().toString().slice(-8)}-${Math.floor(1000 + Math.random() * 9000)}`;

    // 3. Compute Precision Totals
    let subTotal = new Prisma.Decimal(0);
    let taxTotal = new Prisma.Decimal(0);
    let grandTotal = new Prisma.Decimal(0);

    const itemsData = dto.items.map((item) => {
      const costDec = new Prisma.Decimal(item.costPrice);
      const taxRate = new Prisma.Decimal(item.taxPercent);
      const qtyDec = new Prisma.Decimal(item.quantity);

      const lineSubTotal = costDec.mul(qtyDec);
      const lineTaxTotal = lineSubTotal.mul(taxRate.div(100));
      const lineTotal = lineSubTotal.add(lineTaxTotal);

      subTotal = subTotal.add(lineSubTotal);
      taxTotal = taxTotal.add(lineTaxTotal);
      grandTotal = grandTotal.add(lineTotal);

      return {
        productId: item.productId,
        quantity: item.quantity,
        costPrice: costDec,
        taxPercent: taxRate,
        lineTotal: lineTotal,
      };
    });

    // 4. Create in Database inside single Transaction
    return this.prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.create({
        data: {
          poNumber,
          supplierId: dto.supplierId,
          status: 'DRAFT',
          subTotal,
          taxTotal,
          grandTotal,
          createdBy: userId,
        },
      });

      const orderItems = itemsData.map((item) => ({
        ...item,
        purchaseOrderId: po.id,
      }));

      await tx.purchaseOrderItem.createMany({
        data: orderItems,
      });

      return tx.purchaseOrder.findUnique({
        where: { id: po.id },
        include: {
          items: true,
          supplier: true,
        },
      });
    });
  }

  async transitionStatus(poId: string, status: string, userId: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: { items: true },
    });

    if (!po) {
      throw new NotFoundException(`Purchase Order with ID '${poId}' not found.`);
    }

    // Terminal state checks
    if (po.status === 'RECEIVED' || po.status === 'CANCELLED') {
      throw new BadRequestException(`Cannot change status of a terminal Purchase Order (currently in '${po.status}' state).`);
    }

    const validStatuses = ['DRAFT', 'SENT', 'RECEIVED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException(`Invalid status transitions requested: '${status}'.`);
    }

    if (status === 'RECEIVED') {
      // Stock replenishment & audit tracking inside strict transaction
      return this.prisma.$transaction(async (tx) => {
        for (const item of po.items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });

          if (!product) {
            throw new NotFoundException(`Product with ID '${item.productId}' not found during stock receiving.`);
          }

          const stockBefore = product.stockQuantity;
          const stockAfter = stockBefore + item.quantity;

          // Determine stock status level
          let stockStatus: StockStatus = StockStatus.IN_STOCK;
          if (stockAfter === 0) {
            stockStatus = StockStatus.OUT_OF_STOCK;
          } else if (stockAfter <= 5) {
            stockStatus = StockStatus.LOW_STOCK;
          }

          // Update active product inventory
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stockQuantity: stockAfter,
              stockStatus,
            },
          });

          // Log StockMovement audit entry
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              movementType: 'PURCHASE_IN',
              referenceType: 'PURCHASE_ORDER',
              referenceId: po.id,
              quantity: item.quantity,
              stockBefore,
              stockAfter,
              note: `Inventory replenished via Purchase Order '${po.poNumber}'`,
              createdBy: userId,
            },
          });
        }

        // Update purchase order header status
        return tx.purchaseOrder.update({
          where: { id: poId },
          data: { status: 'RECEIVED' },
          include: {
            items: true,
            supplier: true,
          },
        });
      });
    }

    // Standard draft / sent / cancelled status updates
    return this.prisma.purchaseOrder.update({
      where: { id: poId },
      data: { status },
      include: {
        items: true,
        supplier: true,
      },
    });
  }

  async findAllPOs(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [purchaseOrders, total] = await this.prisma.$transaction([
      this.prisma.purchaseOrder.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: {
            select: { name: true },
          },
        },
      }),
      this.prisma.purchaseOrder.count(),
    ]);

    return {
      purchaseOrders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOnePO(id: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              select: { sku: true, name: true },
            },
          },
        },
        supplier: true,
      },
    });

    if (!po) {
      throw new NotFoundException(`Purchase Order with ID '${id}' not found.`);
    }

    return po;
  }
}
