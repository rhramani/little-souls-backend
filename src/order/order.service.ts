import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CheckoutDto } from './dto/checkout.dto';
import { QueryOrderDto } from './dto/query-order.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

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
            product: true,
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
    return this.prisma.$transaction(async (tx) => {
      let totalQuantity = 0;
      let subTotal = new Prisma.Decimal(0);
      let taxTotal = new Prisma.Decimal(0);
      let discountTotal = new Prisma.Decimal(0);
      const shippingCharge = new Prisma.Decimal(dto.shippingCharge || '0');

      const orderItemsData: any[] = [];
      const productUpdates: any[] = [];

      for (const item of cart.items) {
        const product = item.product;
        if (!product || !product.isActive) {
          throw new BadRequestException(`Product '${product?.name || 'Unknown'}' is no longer available.`);
        }

        const quantity = item.quantity;
        totalQuantity += quantity;

        // Resolve tax percent
        const taxPercent = product.taxPercent ? new Prisma.Decimal(product.taxPercent) : new Prisma.Decimal(0);

        // Fetch B2B product custom pricing group definition
        const customer = await tx.customer.findUnique({
          where: { id: customerId },
          select: { pricingGroupId: true },
        });

        if (!customer || !customer.pricingGroupId) {
          throw new BadRequestException('B2B custom pricing group is missing on your customer profile.');
        }

        const pricing = await tx.productPricing.findUnique({
          where: {
            productId_pricingGroupId: {
              productId: product.id,
              pricingGroupId: customer.pricingGroupId,
            },
          },
        });

        if (!pricing) {
          throw new BadRequestException(`Price not defined for B2B product: ${product.name}`);
        }

        const price = pricing.price;
        const mrp = pricing.mrp || null;
        const discountPercent = pricing.discountPercent || new Prisma.Decimal(0);

        // Calculations exclusive of tax
        const lineSubTotal = price.mul(quantity);
        subTotal = subTotal.add(lineSubTotal);

        const lineTaxTotal = lineSubTotal.mul(taxPercent.div(100));
        taxTotal = taxTotal.add(lineTaxTotal);

        const lineDiscountTotal = lineSubTotal.mul(discountPercent.div(100));
        discountTotal = discountTotal.add(lineDiscountTotal);

        const lineTotal = lineSubTotal.add(lineTaxTotal).sub(lineDiscountTotal);

        // Inventory check
        if (product.stockQuantity < quantity) {
          throw new BadRequestException(`Insufficient stock for product '${product.name}'. Available: ${product.stockQuantity}, requested: ${quantity}. Please reduce quantity or select a different product before placing your order.`);
        }

        orderItemsData.push({
          productId: product.id,
          sku: product.sku,
          productName: product.name,
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
      const grandTotal = subTotal.add(taxTotal).sub(discountTotal).add(shippingCharge);

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
        },
      });
    });
  }

  async findAll(query: QueryOrderDto, customerId?: string) {
    const { page = 1, limit = 10, status } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (customerId) {
      where.customerId = customerId;
    }
    if (status) {
      where.orderStatus = status;
    }

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
          customer: {
            select: {
              businessName: true,
              customerCode: true,
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
      throw new ForbiddenException('You do not have access to view this order.');
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
      throw new BadRequestException('Cannot update status of a cancelled order.');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. If transitioning from SUBMITTED/PENDING to APPROVED, allocate inventory stock
      if (newStatus === 'APPROVED' && order.orderStatus === 'SUBMITTED') {
        for (const item of order.items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });

          if (!product) {
            throw new NotFoundException(`Product '${item.productName}' not found during order approval.`);
          }

          if (product.stockQuantity < item.quantity) {
            throw new BadRequestException(`Cannot approve order: Insufficient stock for product '${product.name}'. Available: ${product.stockQuantity}, Ordered: ${item.quantity}.`);
          }

          const newStock = product.stockQuantity - item.quantity;

          // Update product stock and status
          await tx.product.update({
            where: { id: product.id },
            data: {
              stockQuantity: newStock,
              stockStatus: newStock === 0 ? 'OUT_OF_STOCK' : newStock <= 5 ? 'LOW_STOCK' : 'IN_STOCK',
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
  }

  async cancel(id: string, reason: string, userId: string, customerId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID '${id}' not found.`);
    }

    if (customerId && order.customerId !== customerId) {
      throw new ForbiddenException('You do not have authorization to cancel this order.');
    }

    if (order.orderStatus === 'CANCELLED') {
      throw new BadRequestException('Order is already cancelled.');
    }

    const uncancelableStatuses = ['SHIPPED', 'DELIVERED'];
    if (uncancelableStatuses.includes(order.orderStatus)) {
      throw new BadRequestException(`Cannot cancel order once it has been ${order.orderStatus.toLowerCase()}.`);
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
                stockStatus: restoredStock > 5 ? 'IN_STOCK' : restoredStock > 0 ? 'LOW_STOCK' : 'OUT_OF_STOCK',
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
}
