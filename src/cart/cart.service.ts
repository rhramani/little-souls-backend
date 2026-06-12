import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateCart(customerId: string, contactId?: string) {
    let cart = await this.prisma.cart.findFirst({
      where: {
        customerId,
        status: 'ACTIVE',
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: {
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: {
          customerId,
          customerContactId: contactId || null,
          status: 'ACTIVE',
        },
        include: {
          items: {
            include: {
              product: {
                include: {
                  images: {
                    orderBy: { sortOrder: 'asc' },
                  },
                },
              },
            },
          },
        },
      });
    }

    return cart;
  }

  async getB2BProductPrice(
    productId: string,
    customerId: string,
  ): Promise<Prisma.Decimal> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    // 1. Get customer and their pricing group
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { pricingGroupId: true },
    });

    if (!customer) {
      throw new NotFoundException('Customer profile not found.');
    }

    if (!customer.pricingGroupId) {
      if (product && product.productPrice) return product.productPrice;
      return new Prisma.Decimal(0);
    }

    // 2. Fetch price defined for the group
    const pricing = await this.prisma.productPricing.findUnique({
      where: {
        productId_pricingGroupId: {
          productId,
          pricingGroupId: customer.pricingGroupId,
        },
      },
    });

    if (!pricing) {
      if (product && product.productPrice) return product.productPrice;
      return new Prisma.Decimal(0);
    }

    return pricing.price;
  }

  async addToCart(customerId: string, contactId: string, dto: AddToCartDto) {
    const { productId, quantity } = dto;

    // 1. Verify Product exists and is active
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product || !product.isActive) {
      throw new NotFoundException('Product is inactive or does not exist.');
    }

    // 2b. Verify Stock Availability
    if (quantity > product.stockQuantity) {
      throw new BadRequestException(
        `Quantity requested '${quantity}' exceeds available stock of ${product.stockQuantity} units. Please reduce quantity or select a different product.`,
      );
    }

    // 3. Resolve customized B2B price
    const price = await this.getB2BProductPrice(productId, customerId);

    // 4. Retrieve or create customer's active cart
    const cart = await this.getOrCreateCart(customerId, contactId);

    // 5. Add or update item in cart
    const existingItem = cart.items.find(
      (item) => item.productId === productId,
    );

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      if (newQuantity > product.stockQuantity) {
        throw new BadRequestException(
          `Total quantity in cart '${newQuantity}' would exceed available stock of ${product.stockQuantity} units. Please reduce quantity.`,
        );
      }
      const lineTotal = price.mul(newQuantity);

      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: newQuantity,
          price,
          lineTotal,
        },
      });
    } else {
      const lineTotal = price.mul(quantity);

      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          quantity,
          price,
          lineTotal,
        },
      });
    }

    // Return the updated cart structure
    return this.getOrCreateCart(customerId, contactId);
  }

  async updateItemQuantity(
    customerId: string,
    contactId: string,
    cartItemId: string,
    dto: UpdateCartItemDto,
  ) {
    const { quantity } = dto;

    // 1. Verify Cart item exists and belongs to this active cart
    const cart = await this.getOrCreateCart(customerId, contactId);
    const cartItem = cart.items.find((item) => item.id === cartItemId);

    if (!cartItem) {
      throw new NotFoundException('Cart item not found in your active cart.');
    }

    const product = cartItem.product;

    // 2b. Verify Stock Availability
    if (quantity > product.stockQuantity) {
      throw new BadRequestException(
        `Quantity requested '${quantity}' exceeds available stock of ${product.stockQuantity} units for ${product.name}. Please reduce quantity.`,
      );
    }

    // 3. Re-resolve B2B custom pricing to verify no changes occurred
    const price = await this.getB2BProductPrice(product.id, customerId);
    const lineTotal = price.mul(quantity);

    await this.prisma.cartItem.update({
      where: { id: cartItemId },
      data: {
        quantity,
        price,
        lineTotal,
      },
    });

    return this.getOrCreateCart(customerId, contactId);
  }

  async removeItem(customerId: string, contactId: string, cartItemId: string) {
    // 1. Verify Cart Item belongs to this active cart
    const cart = await this.getOrCreateCart(customerId, contactId);
    const cartItem = cart.items.find((item) => item.id === cartItemId);

    if (!cartItem) {
      throw new NotFoundException('Cart item not found in your active cart.');
    }

    await this.prisma.cartItem.delete({
      where: { id: cartItemId },
    });

    return this.getOrCreateCart(customerId, contactId);
  }

  async clearCart(customerId: string, contactId: string) {
    const cart = await this.getOrCreateCart(customerId, contactId);

    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    return this.getOrCreateCart(customerId, contactId);
  }
}
