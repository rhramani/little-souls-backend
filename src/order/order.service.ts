import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CheckoutDto } from './dto/checkout.dto';
import { QueryOrderDto } from './dto/query-order.dto';
import { UpdateOrderItemsDto } from './dto/update-order-items.dto';
import { PosCheckoutDto } from './dto/pos-checkout.dto';
import { Prisma } from '@prisma/client';
import { WhatsappService } from '../notification/whatsapp.service';
import { BillingService } from '../billing/billing.service';

function getProductImageUrl(product: any): string | null {
  if (!product) return null;
  const primaryImage = product.images?.find((i: any) => i.isPrimary);
  return (
    primaryImage?.thumbnailUrl ||
    primaryImage?.originalUrl ||
    product.images?.[0]?.thumbnailUrl ||
    product.images?.[0]?.originalUrl ||
    product.productImage ||
    product.productPictureUrl ||
    null
  );
}

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsappService,
    private readonly billingService: BillingService,
  ) {}

  async checkout(customerId: string, contactId: string, dto: CheckoutDto) {
    // 1. Get active cart
    const cart = await this.prisma.cart.findFirst({
      where: {
        customerId,
        status: 'ACTIVE',
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: { orderBy: { sortOrder: 'asc' } },
                catalogues: true,
              },
            },
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Your B2B cart is empty.');
    }

    // 2. Resolve delivery address
    let deliveryAddress = dto.deliveryAddress;
    if (!deliveryAddress) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: customerId },
      });
      if (!customer) {
        throw new NotFoundException('Customer profile not found.');
      }

      const parts = [
        customer.shippingAddressLine1,
        customer.shippingAddressLine2,
        customer.shippingCity,
        customer.shippingState,
        customer.shippingPincode,
        customer.shippingCountry,
      ].filter(Boolean);

      if (parts.length > 0) {
        deliveryAddress = parts.join(', ');
      } else {
        const billingParts = [
          customer.billingAddressLine1,
          customer.billingAddressLine2,
          customer.billingCity,
          customer.billingState,
          customer.billingPincode,
          customer.billingCountry,
        ].filter(Boolean);

        if (billingParts.length > 0) {
          deliveryAddress = billingParts.join(', ');
        } else {
          throw new BadRequestException('Please provide a delivery address.');
        }
      }
    }

    // 3. Generate unique order number
    const orderNumber = `LS-${Date.now().toString().slice(-8)}-${Math.floor(1000 + Math.random() * 9000)}`;

    // 4. Calculate prices, inventory checks, and compile items inside Transaction
    const result = await this.prisma.$transaction(async (tx) => {
      let totalQuantity = 0;
      let subTotal = 0;
      let taxTotal = 0;
      let discountTotal = 0;
      const shippingCharge = Number(dto.shippingCharge || 0);

      const orderItemsData: any[] = [];
      const productUpdates: any[] = [];

      for (const item of cart.items) {
        const product = item.product;
        if (!product || !product.isActive) {
          throw new BadRequestException(
            `Product '${product?.name || 'Unknown'}' is no longer available.`,
          );
        }

        if (
          product.catalogueIds &&
          product.catalogueIds.length > 0 &&
          !product.catalogues.some((c) => c.isPublished)
        ) {
          throw new BadRequestException(
            `Product '${product.name}' belongs to a catalogue that is no longer published.`,
          );
        }

        const quantity = item.quantity;
        totalQuantity += quantity;

        // Resolve tax percent
        const taxPercent = product.taxPercent ? Number(product.taxPercent) : 0;

        // Fetch B2B product custom pricing group definition
        const customer = await tx.customer.findUnique({
          where: { id: customerId },
          select: { pricingGroupId: true },
        });

        let price = product.productPrice ? Number(product.productPrice) : 0;
        let mrp: number | null = null;
        let discountPercent = 0;

        if (customer?.pricingGroupId) {
          const pricing = await tx.productPricing.findUnique({
            where: {
              productId_pricingGroupId: {
                productId: product.id,
                pricingGroupId: customer.pricingGroupId,
              },
            },
          });

          if (pricing) {
            price = Number(pricing.price);
            mrp = pricing.mrp ? Number(pricing.mrp) : null;
            discountPercent = pricing.discountPercent
              ? Number(pricing.discountPercent)
              : 0;
          }
        }

        // Calculations exclusive of tax
        const lineSubTotal = price * quantity;
        subTotal = subTotal + lineSubTotal;

        const lineTaxTotal = lineSubTotal * (taxPercent / 100);
        taxTotal = taxTotal + lineTaxTotal;

        const lineDiscountTotal = lineSubTotal * (discountPercent / 100);
        discountTotal = discountTotal + lineDiscountTotal;

        const lineTotal = lineSubTotal + lineTaxTotal - lineDiscountTotal;

        // Inventory check
        if (product.stockQuantity < quantity) {
          throw new BadRequestException(
            `Insufficient stock for product '${product.name}'. Available: ${product.stockQuantity}, requested: ${quantity}. Please reduce quantity or select a different product before placing your order.`,
          );
        }

        orderItemsData.push({
          productId: product.id,
          sku: product.sku,
          productName: product.name,
          productImageUrl: getProductImageUrl(product),
          quantity,
          moq: product.moq,
          availableStock: product.stockQuantity,
          shortageQuantity: null,
          backorderQuantity: null,
          price,
          mrp,
          discountPercent,
          taxPercent,
          lineSubTotal,
          lineTaxTotal,
          lineTotal,
          fulfillmentStatus: 'FULFILLED',
        });
      }

      // Final calculations
      const grandTotal = subTotal + taxTotal - discountTotal + shippingCharge;

      // Create Order
      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId,
          customerContactId: contactId,
          orderStatus: 'SUBMITTED',
          orderSource: dto.orderSource || 'WEBSITE',
          deliveryAddress,
          totalQuantity,
          subTotal,
          discountTotal,
          taxTotal,
          shippingCharge,
          grandTotal,
          paymentStatus: 'UNPAID',
          notes: dto.notes,
          submittedAt: new Date(),
        },
      });

      // Create OrderItems
      await tx.orderItem.createMany({
        data: orderItemsData.map((item) => ({
          ...item,
          orderId: order.id,
        })),
      });

      // Log Order status history
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          oldStatus: 'DRAFT',
          newStatus: 'SUBMITTED',
        },
      });

      // Set active cart to converted
      await tx.cart.update({
        where: { id: cart.id },
        data: { status: 'CONVERTED' },
      });

      return tx.order.findUnique({
        where: { id: order.id },
        include: {
          items: true,
          statusHistory: true,
          customer: true,
        },
      });
    });

    // Fetch customer's primary contact number asynchronously for WhatsApp
    const primaryContact = await this.prisma.customerContact.findFirst({
      where: { customerId: result?.customerId },
      orderBy: { isPrimary: 'desc' },
    });

    const whatsappNumber =
      primaryContact?.whatsappNumber || primaryContact?.mobile;
    if (whatsappNumber && result?.customer) {
      this.whatsappService
        .sendOrderConfirmation(
          whatsappNumber,
          result.orderNumber,
          result.customer.businessName,
        )
        .catch(console.error); // Fire and forget
    }

    return result;
  }

  async findAll(query: QueryOrderDto, customerId?: string) {
    const { page = 1, limit = 10, status, startDate, endDate, sku } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (customerId) {
      where.customerId = customerId;
    }
    if (status) {
      where.orderStatus = status;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    if (sku) {
      where.items = {
        some: {
          sku: {
            contains: sku,
            mode: 'insensitive',
          },
        },
      };
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: {
              product: {
                select: {
                  images: { orderBy: { sortOrder: 'asc' } },
                  productImage: true,
                  productPictureUrl: true,
                },
              },
            },
          },
          customer: {
            select: {
              businessName: true,
              customerCode: true,
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
              gstin: true,
            },
          },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      orders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, customerId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              select: {
                images: {
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
          },
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
        customer: true,
        customerContact: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID '${id}' not found.`);
    }

    if (customerId && order.customerId !== customerId) {
      throw new ForbiddenException(
        'You do not have access to view this order.',
      );
    }

    return order;
  }

  async updateStatus(id: string, newStatus: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID '${id}' not found.`);
    }

    if (order.orderStatus === 'CANCELLED') {
      throw new BadRequestException(
        'Cannot update status of a cancelled order.',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. If transitioning from SUBMITTED/PENDING to APPROVED, allocate inventory stock
      if (newStatus === 'APPROVED' && order.orderStatus === 'SUBMITTED') {
        for (const item of order.items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });

          if (!product) {
            throw new NotFoundException(
              `Product '${item.productName}' not found during order approval.`,
            );
          }

          if (product.stockQuantity < item.quantity) {
            throw new BadRequestException(
              `Cannot approve order: Insufficient stock for product '${product.name}'. Available: ${product.stockQuantity}, Ordered: ${item.quantity}.`,
            );
          }

          const newStock = product.stockQuantity - item.quantity;

          // Update product stock and status
          await tx.product.update({
            where: { id: product.id },
            data: {
              stockQuantity: newStock,
              stockStatus:
                newStock === 0
                  ? 'OUT_OF_STOCK'
                  : newStock <= 5
                    ? 'LOW_STOCK'
                    : 'IN_STOCK',
            },
          });

          // Log StockMovement audit
          await tx.stockMovement.create({
            data: {
              productId: product.id,
              movementType: 'ORDER_OUT',
              referenceType: 'ORDER',
              referenceId: order.id,
              quantity: item.quantity,
              stockBefore: product.stockQuantity,
              stockAfter: newStock,
              note: `Stock allocated for approved Order '${order.orderNumber}'`,
              createdBy: userId,
            },
          });
        }
      }

      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          orderStatus: newStatus,
          approvedBy: newStatus === 'APPROVED' ? userId : undefined,
          approvedAt: newStatus === 'APPROVED' ? new Date() : undefined,
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          oldStatus: order.orderStatus,
          newStatus,
        },
      });

      return updatedOrder;
    });

    if (newStatus === 'APPROVED') {
      try {
        await this.billingService.generateInvoice(id, userId);
      } catch (err) {
        console.error(
          `Failed to generate invoice automatically for approved order ${id}: ${err.message}`,
        );
      }
    }

    return result;
  }

  async cancel(
    id: string,
    reason: string,
    userId: string,
    customerId?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID '${id}' not found.`);
    }

    if (customerId && order.customerId !== customerId) {
      throw new ForbiddenException(
        'You do not have authorization to cancel this order.',
      );
    }

    if (order.orderStatus === 'CANCELLED') {
      throw new BadRequestException('Order is already cancelled.');
    }

    const uncancelableStatuses = ['SHIPPED', 'DELIVERED'];
    if (uncancelableStatuses.includes(order.orderStatus)) {
      throw new BadRequestException(
        `Cannot cancel order once it has been ${order.orderStatus.toLowerCase()}.`,
      );
    }

    // Process cancellation and restore inventory stock in Transaction
    return this.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          orderStatus: 'CANCELLED',
          cancelledBy: userId,
          cancelledAt: new Date(),
          cancelReason: reason,
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          oldStatus: order.orderStatus,
          newStatus: 'CANCELLED',
        },
      });

      // Restore product inventory ONLY if stock was actually deducted (i.e. status was APPROVED/SHIPPED/DELIVERED)
      const stockDeductedStatuses = ['APPROVED', 'SHIPPED', 'DELIVERED'];
      if (stockDeductedStatuses.includes(order.orderStatus)) {
        const restoreStockPromises = order.items.map(async (item) => {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            select: { stockQuantity: true },
          });

          if (product) {
            const restoredStock = product.stockQuantity + item.quantity;
            await tx.product.update({
              where: { id: item.productId },
              data: {
                stockQuantity: restoredStock,
                stockStatus:
                  restoredStock > 5
                    ? 'IN_STOCK'
                    : restoredStock > 0
                      ? 'LOW_STOCK'
                      : 'OUT_OF_STOCK',
              },
            });

            // Log StockMovement cancellation audit
            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                movementType: 'RETURN_IN',
                referenceType: 'ORDER',
                referenceId: order.id,
                quantity: item.quantity,
                stockBefore: product.stockQuantity,
                stockAfter: restoredStock,
                note: `Stock returned from cancelled approved Order '${order.orderNumber}'`,
                createdBy: userId,
              },
            });
          }
        });

        await Promise.all(restoreStockPromises);
      }

      return updatedOrder;
    });
  }

  async approveBackorder(id: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID '${id}' not found.`);
    }

    if (order.orderStatus !== 'SUBMITTED') {
      throw new BadRequestException(
        'Only SUBMITTED orders can be backorder approved.',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          orderStatus: 'APPROVED',
          approvedBy: userId,
          approvedAt: new Date(),
          notes:
            (order.notes ? order.notes + '\n' : '') +
            `[SYSTEM] Backorder approved by User ${userId}`,
        },
      });

      // Log status change
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          oldStatus: order.orderStatus,
          newStatus: 'APPROVED',
        },
      });

      // Adjust inventory, allowing negative stock
      for (const item of order.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (product) {
          const newStock = product.stockQuantity - item.quantity;
          await tx.product.update({
            where: { id: product.id },
            data: {
              stockQuantity: newStock,
              stockStatus:
                newStock <= 0
                  ? 'OUT_OF_STOCK'
                  : newStock <= 5
                    ? 'LOW_STOCK'
                    : 'IN_STOCK',
            },
          });

          await tx.stockMovement.create({
            data: {
              productId: product.id,
              movementType: 'ORDER_OUT',
              referenceType: 'ORDER',
              referenceId: order.id,
              quantity: item.quantity,
              stockBefore: product.stockQuantity,
              stockAfter: newStock,
              note: `Stock allocated for Backorder-Approved Order '${order.orderNumber}'`,
              createdBy: userId,
            },
          });
        }
      }

      return updatedOrder;
    });

    try {
      await this.billingService.generateInvoice(id, userId);
    } catch (err) {
      console.error(
        `Failed to generate invoice automatically for backorder approved order ${id}: ${err.message}`,
      );
    }

    return result;
  }

  async createPackingSlip(
    id: string,
    notes: string | undefined,
    userId: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID '${id}' not found.`);
    }

    if (order.orderStatus !== 'APPROVED' && order.orderStatus !== 'PACKED') {
      throw new BadRequestException(
        `Cannot pack an order in ${order.orderStatus} status.`,
      );
    }

    const packingSlipNumber = `PS-${Date.now().toString().slice(-8)}`;

    return this.prisma.$transaction(async (tx) => {
      const slip = await tx.packingSlip.create({
        data: {
          orderId: id,
          packingSlipNumber,
          packedBy: userId,
          packedAt: new Date(),
          status: 'PACKED',
          notes,
        },
      });

      if (order.orderStatus === 'APPROVED') {
        await tx.order.update({
          where: { id },
          data: { orderStatus: 'PACKED' },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId: id,
            oldStatus: 'APPROVED',
            newStatus: 'PACKED',
          },
        });
      }

      return slip;
    });
  }

  async createShipment(id: string, dto: any, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID '${id}' not found.`);
    }

    if (order.orderStatus !== 'PACKED' && order.orderStatus !== 'SHIPPED') {
      throw new BadRequestException(
        `Cannot ship an order in ${order.orderStatus} status. Must be PACKED first.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.create({
        data: {
          orderId: id,
          courierName: dto.courierName,
          trackingNumber: dto.trackingNumber,
          trackingUrl: dto.trackingUrl,
          shippingProvider: dto.shippingProvider,
          shippingCost:
            dto.shippingCost != null ? Number(dto.shippingCost) : null,
          shipmentStatus: 'SHIPPED',
          shippedAt: new Date(),
          createdBy: userId,
        },
      });

      if (order.orderStatus === 'PACKED') {
        await tx.order.update({
          where: { id },
          data: { orderStatus: 'SHIPPED' },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId: id,
            oldStatus: 'PACKED',
            newStatus: 'SHIPPED',
          },
        });
      }

      return shipment;
    });
  }

  async markDelivered(id: string, userId: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException(`Order '${id}' not found.`);
    if (order.orderStatus !== 'SHIPPED') {
      throw new BadRequestException(
        `Order must be in SHIPPED status to mark delivered. Current: ${order.orderStatus}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: { orderStatus: 'DELIVERED' },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          oldStatus: 'SHIPPED',
          newStatus: 'DELIVERED',
          changedBy: userId,
        },
      });

      return updated;
    });
  }

  async updateOrderItems(id: string, dto: UpdateOrderItemsDto, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID '${id}' not found.`);
    }

    if (!['SUBMITTED', 'APPROVED'].includes(order.orderStatus)) {
      throw new BadRequestException(
        `Cannot edit items for an order in ${order.orderStatus} status. Only SUBMITTED and APPROVED orders can be edited.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. If APPROVED, revert inventory for old items
      if (order.orderStatus === 'APPROVED') {
        for (const item of order.items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            select: { stockQuantity: true },
          });

          if (product) {
            const restoredStock = product.stockQuantity + item.quantity;
            await tx.product.update({
              where: { id: item.productId },
              data: {
                stockQuantity: restoredStock,
                stockStatus:
                  restoredStock > 5
                    ? 'IN_STOCK'
                    : restoredStock > 0
                      ? 'LOW_STOCK'
                      : 'OUT_OF_STOCK',
              },
            });

            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                movementType: 'RETURN_IN',
                referenceType: 'ORDER',
                referenceId: order.id,
                quantity: item.quantity,
                stockBefore: product.stockQuantity,
                stockAfter: restoredStock,
                note: `Stock returned from edited order '${order.orderNumber}' before re-calculation`,
                createdBy: userId,
              },
            });
          }
        }
      }

      // 2. Delete existing items
      await tx.orderItem.deleteMany({
        where: { orderId: id },
      });

      // 3. Re-calculate totals and prepare new items
      let totalQuantity = 0;
      let subTotal = 0;
      const shippingCharge = order.shippingCharge
        ? Number(order.shippingCharge)
        : 0;

      // Pre-calculate subTotal by resolving all products
      const resolvedItems: {
        itemInput: any;
        product: any;
        price: number;
        lineSubTotal: number;
        taxPercent: number;
        discountPercent: number;
      }[] = [];

      for (const itemInput of dto.items) {
        const product = await tx.product.findUnique({
          where: { id: itemInput.productId },
          include: { images: { orderBy: { sortOrder: 'asc' } } },
        });

        if (!product || !product.isActive) {
          throw new BadRequestException(
            `Product '${product?.name || itemInput.productId}' is no longer available.`,
          );
        }

        const quantity = itemInput.quantity;
        totalQuantity += quantity;

        const taxPercent =
          dto.taxPercent !== undefined
            ? Number(dto.taxPercent)
            : product.taxPercent
              ? Number(product.taxPercent)
              : 0;

        const price = Number(itemInput.price);

        const oldItem = order.items.find(
          (i) => i.productId === itemInput.productId,
        );
        const discountPercent = oldItem?.discountPercent
          ? Number(oldItem.discountPercent)
          : 0;

        const lineSubTotal = price * quantity;
        subTotal = subTotal + lineSubTotal;

        resolvedItems.push({
          itemInput,
          product,
          price,
          lineSubTotal,
          taxPercent,
          discountPercent,
        });
      }

      const orderDiscountTotal =
        dto.discountTotal !== undefined ? Number(dto.discountTotal) : null;

      let taxTotal = 0;
      let calculatedDiscountTotal = 0;
      const orderItemsData: any[] = [];

      for (const resolved of resolvedItems) {
        const {
          itemInput,
          product,
          price,
          lineSubTotal,
          taxPercent,
          discountPercent,
        } = resolved;
        const oldItem = order.items.find(
          (i) => i.productId === itemInput.productId,
        );

        let lineDiscountTotal = 0;
        if (orderDiscountTotal !== null) {
          if (subTotal > 0) {
            lineDiscountTotal = (orderDiscountTotal * lineSubTotal) / subTotal;
          }
        } else {
          lineDiscountTotal = lineSubTotal * (discountPercent / 100);
        }
        calculatedDiscountTotal = calculatedDiscountTotal + lineDiscountTotal;

        const diff = lineSubTotal - lineDiscountTotal;
        const taxableLineValue = diff > 0 ? diff : 0;
        const lineTaxTotal = taxableLineValue * (taxPercent / 100);
        taxTotal = taxTotal + lineTaxTotal;

        const lineTotal = lineSubTotal + lineTaxTotal - lineDiscountTotal;

        orderItemsData.push({
          orderId: order.id,
          productId: product.id,
          sku: product.sku,
          productName: product.name,
          productImageUrl: getProductImageUrl(product),
          quantity: itemInput.quantity,
          moq: product.moq,
          availableStock: product.stockQuantity,
          shortageQuantity: null,
          backorderQuantity: null,
          price,
          mrp: oldItem?.mrp ? Number(oldItem.mrp) : null,
          discountPercent:
            orderDiscountTotal !== null
              ? subTotal > 0
                ? (lineDiscountTotal * 100) / subTotal
                : 0
              : discountPercent,
          taxPercent,
          lineSubTotal,
          lineTaxTotal,
          lineTotal,
          fulfillmentStatus: 'FULFILLED',
        });
      }

      const finalDiscountTotal =
        orderDiscountTotal !== null
          ? orderDiscountTotal
          : calculatedDiscountTotal;

      const grandTotal =
        subTotal + taxTotal - finalDiscountTotal + shippingCharge;

      // 4. If APPROVED, deduct inventory for new items
      if (order.orderStatus === 'APPROVED') {
        for (const newItem of orderItemsData) {
          const product = await tx.product.findUnique({
            where: { id: newItem.productId },
          });

          if (!product) continue;

          if (product.stockQuantity < newItem.quantity) {
            throw new BadRequestException(
              `Cannot edit order to requested quantities: Insufficient stock for product '${product.name}'. Available: ${product.stockQuantity}, Ordered: ${newItem.quantity}.`,
            );
          }

          const newStock = product.stockQuantity - newItem.quantity;

          await tx.product.update({
            where: { id: product.id },
            data: {
              stockQuantity: newStock,
              stockStatus:
                newStock === 0
                  ? 'OUT_OF_STOCK'
                  : newStock <= 5
                    ? 'LOW_STOCK'
                    : 'IN_STOCK',
            },
          });

          await tx.stockMovement.create({
            data: {
              productId: product.id,
              movementType: 'ORDER_OUT',
              referenceType: 'ORDER',
              referenceId: order.id,
              quantity: newItem.quantity,
              stockBefore: product.stockQuantity,
              stockAfter: newStock,
              note: `Stock re-allocated for edited Order '${order.orderNumber}'`,
              createdBy: userId,
            },
          });
        }
      }

      // 5. Create new items
      await tx.orderItem.createMany({
        data: orderItemsData,
      });

      // 6. Update order totals
      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          totalQuantity,
          subTotal,
          taxTotal,
          discountTotal: finalDiscountTotal,
          grandTotal,
        },
        include: {
          items: {
            include: {
              product: {
                select: {
                  images: { orderBy: { sortOrder: 'asc' } },
                },
              },
            },
          },
          statusHistory: {
            orderBy: { createdAt: 'desc' },
          },
          customer: true,
          customerContact: true,
        },
      });

      // 7. Log history
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          oldStatus: order.orderStatus,
          newStatus: order.orderStatus,
          changedBy: userId,
          note: `Order items edited by User ${userId}`,
        },
      });

      return updatedOrder;
    });
  }

  async posCheckout(dto: PosCheckoutDto, userId: string) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Cannot create POS order with no items.');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Resolve Customer
      let customerId = dto.customerId;
      if (!customerId) {
        // Find or create walk-in customer
        const walkInMobile = dto.walkInMobile || '0000000000';
        let walkInCustomer = await tx.customer.findFirst({
          where: { mainContactNumber: walkInMobile },
        });

        if (!walkInCustomer) {
          walkInCustomer = await tx.customer.create({
            data: {
              businessName: dto.walkInName || 'Walk-in Store Customer',
              mainContactNumber: walkInMobile,
              gstin: dto.walkInGstin || null,
              customerSource: 'Walk-in Customer',
              isActive: true,
              approvalStatus: 'APPROVED',
              approvedBy: userId,
              approvedAt: new Date(),
            },
          });
        }
        customerId = walkInCustomer.id;
      }

      // 2. Generate Order Number
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const countToday = await tx.order.count({
        where: {
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      });
      const orderNumber = `POS-${dateStr}-${(countToday + 1).toString().padStart(4, '0')}`;

      // 3. Process Items and calculate totals
      let totalQuantity = 0;
      let subTotal = 0;
      const orderDiscountTotal = Number(dto.discountTotal || 0);

      const resolvedItems: {
        itemInput: any;
        product: any;
        price: number;
        lineSubTotal: number;
        taxPercent: number;
      }[] = [];

      for (const itemInput of dto.items) {
        const product = await tx.product.findUnique({
          where: { id: itemInput.productId },
          include: { images: { orderBy: { sortOrder: 'asc' } } },
        });

        if (!product) {
          throw new BadRequestException(
            `Product ID '${itemInput.productId}' not found.`,
          );
        }

        if (product.stockQuantity < itemInput.quantity) {
          throw new BadRequestException(
            `Insufficient stock for '${product.name}'. Available: ${product.stockQuantity}, Requested: ${itemInput.quantity}`,
          );
        }

        const quantity = itemInput.quantity;
        totalQuantity += quantity;
        const price = Number(itemInput.price);

        const taxPercent =
          dto.withGst === false
            ? 0
            : dto.taxPercent !== undefined
              ? Number(dto.taxPercent)
              : product.taxPercent && Number(product.taxPercent) > 0
                ? Number(product.taxPercent)
                : product.taxType === 'GST' || !product.taxType
                  ? 12
                  : 0;

        const lineSubTotal = price * quantity;
        subTotal = subTotal + lineSubTotal;

        resolvedItems.push({
          itemInput,
          product,
          price,
          lineSubTotal,
          taxPercent,
        });
      }

      let taxTotal = 0;
      const orderItemsData: any[] = [];
      const stockMovementsData: any[] = [];

      for (const resolved of resolvedItems) {
        const { itemInput, product, price, lineSubTotal, taxPercent } =
          resolved;
        const quantity = itemInput.quantity;

        // Distribute discountTotal proportionally
        let lineDiscountTotal = 0;
        if (orderDiscountTotal > 0 && subTotal > 0) {
          lineDiscountTotal = (orderDiscountTotal * lineSubTotal) / subTotal;
        }

        const diff = lineSubTotal - lineDiscountTotal;
        const taxableLineValue = diff > 0 ? diff : 0;
        const lineTaxTotal = (taxableLineValue * taxPercent) / 100;
        taxTotal = taxTotal + lineTaxTotal;

        const lineTotal = lineSubTotal + lineTaxTotal - lineDiscountTotal;

        orderItemsData.push({
          productId: product.id,
          sku: product.sku,
          productName: product.name,
          productImageUrl: getProductImageUrl(product),
          quantity,
          moq: product.moq,
          availableStock: product.stockQuantity, // Pre-deduction snapshot
          price,
          mrp: product.productPrice ? Number(product.productPrice) : null,
          discountPercent:
            lineSubTotal > 0 ? (lineDiscountTotal * 100) / lineSubTotal : 0,
          taxPercent,
          lineSubTotal,
          lineTaxTotal,
          lineTotal,
          fulfillmentStatus: 'FULFILLED',
        });

        // Deduct inventory immediately
        const newStock = product.stockQuantity - quantity;
        await tx.product.update({
          where: { id: product.id },
          data: {
            stockQuantity: newStock,
            stockStatus:
              newStock === 0
                ? 'OUT_OF_STOCK'
                : newStock <= 5
                  ? 'LOW_STOCK'
                  : 'IN_STOCK',
          },
        });

        stockMovementsData.push({
          productId: product.id,
          movementType: 'ORDER_OUT',
          referenceType: 'ORDER',
          quantity,
          stockBefore: product.stockQuantity,
          stockAfter: newStock,
          note: `Stock deducted for POS Order '${orderNumber}'`,
          createdBy: userId,
        });
      }

      const grandTotal = Math.max(0, subTotal + taxTotal - orderDiscountTotal);

      // 4. Create Order
      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId,
          orderStatus: 'DELIVERED',
          orderSource: 'STAFF_PANEL',
          totalQuantity,
          subTotal,
          discountTotal: orderDiscountTotal,
          taxTotal,
          shippingCharge: 0,
          grandTotal,
          paymentStatus: dto.paymentMethod === 'UNPAID' ? 'UNPAID' : 'PAID',
          notes: `POS Walk-in. Payment: ${dto.paymentMethod || 'CASH'}.`,
          handledBySalesStaffId: userId,
          submittedAt: new Date(),
          approvedBy: userId,
          approvedAt: new Date(),
        },
      });

      // 5. Create stock movements with actual order ID
      if (stockMovementsData.length > 0) {
        await tx.stockMovement.createMany({
          data: stockMovementsData.map((sm) => ({
            ...sm,
            referenceId: order.id,
          })),
        });
      }

      // 6. Create Order Items
      await tx.orderItem.createMany({
        data: orderItemsData.map((item) => ({
          ...item,
          orderId: order.id,
        })),
      });

      // 7. Order Status History
      await tx.orderStatusHistory.createMany({
        data: [
          {
            orderId: order.id,
            oldStatus: 'DRAFT',
            newStatus: 'SUBMITTED',
            changedBy: userId,
          },
          {
            orderId: order.id,
            oldStatus: 'SUBMITTED',
            newStatus: 'APPROVED',
            changedBy: userId,
          },
          {
            orderId: order.id,
            oldStatus: 'APPROVED',
            newStatus: 'DELIVERED',
            changedBy: userId,
            note: 'POS direct checkout',
          },
        ],
      });

      return tx.order.findUnique({
        where: { id: order.id },
        include: {
          items: true,
          customer: true,
        },
      });
    });
  }

  async remove(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { invoices: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID '${id}' not found.`);
    }

    return this.prisma.$transaction(async (tx) => {
      if (order.invoices && order.invoices.length > 0) {
        const invoiceIds = order.invoices.map((i) => i.id);

        await tx.invoiceItem.deleteMany({
          where: { invoiceId: { in: invoiceIds } },
        });

        await tx.invoice.deleteMany({
          where: { id: { in: invoiceIds } },
        });

        await tx.ledgerEntry.deleteMany({
          where: {
            OR: [{ referenceId: { in: invoiceIds } }, { referenceId: id }],
          },
        });
      }

      await tx.orderStatusHistory.deleteMany({
        where: { orderId: id },
      });

      await tx.orderItem.deleteMany({
        where: { orderId: id },
      });

      await tx.backorderApproval.deleteMany({
        where: { orderId: id },
      });

      await tx.packingSlip.deleteMany({
        where: { orderId: id },
      });

      await tx.shipment.deleteMany({
        where: { orderId: id },
      });

      return tx.order.delete({
        where: { id },
      });
    });
  }

  async removeMany(ids: string[]) {
    return this.prisma.$transaction(async (tx) => {
      const orders = await tx.order.findMany({
        where: { id: { in: ids } },
        include: { invoices: true },
      });

      const invoiceIds = orders.flatMap((o) => o.invoices.map((i) => i.id));

      if (invoiceIds.length > 0) {
        await tx.invoiceItem.deleteMany({
          where: { invoiceId: { in: invoiceIds } },
        });

        await tx.invoice.deleteMany({
          where: { id: { in: invoiceIds } },
        });

        await tx.ledgerEntry.deleteMany({
          where: {
            OR: [
              { referenceId: { in: invoiceIds } },
              { referenceId: { in: ids } },
            ],
          },
        });
      }

      await tx.orderStatusHistory.deleteMany({
        where: { orderId: { in: ids } },
      });

      await tx.orderItem.deleteMany({
        where: { orderId: { in: ids } },
      });

      await tx.backorderApproval.deleteMany({
        where: { orderId: { in: ids } },
      });

      await tx.packingSlip.deleteMany({
        where: { orderId: { in: ids } },
      });

      await tx.shipment.deleteMany({
        where: { orderId: { in: ids } },
      });

      const deleteResult = await tx.order.deleteMany({
        where: { id: { in: ids } },
      });

      return { deletedCount: deleteResult.count };
    });
  }

  async bulkUpdateStatus(ids: string[], newStatus: string, userId: string) {
    const results = {
      successCount: 0,
      failureCount: 0,
      failures: [] as Array<{ id: string; orderNumber: string; error: string }>,
    };

    for (const id of ids) {
      try {
        await this.updateStatus(id, newStatus, userId);
        results.successCount++;
      } catch (err: any) {
        results.failureCount++;
        let orderNumber = 'Unknown';
        try {
          const o = await this.prisma.order.findUnique({
            where: { id },
            select: { orderNumber: true },
          });
          if (o) orderNumber = o.orderNumber;
        } catch {}
        results.failures.push({
          id,
          orderNumber,
          error: err.message || 'Unknown error',
        });
      }
    }

    return results;
  }
}
