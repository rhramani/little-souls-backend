import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePricingGroupDto } from './dto/create-pricing-group.dto';
import { UpdatePricingGroupDto } from './dto/update-pricing-group.dto';
import { SetProductPricingDto } from './dto/set-product-pricing.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async createGroup(dto: CreatePricingGroupDto) {
    const code = dto.code.trim().toUpperCase();

    // 1. Verify code uniqueness
    const existing = await this.prisma.pricingGroup.findUnique({
      where: { code },
    });
    if (existing) {
      throw new ConflictException(`Pricing Group with code '${code}' already exists.`);
    }

    return this.prisma.pricingGroup.create({
      data: {
        name: dto.name,
        code,
        description: dto.description,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });
  }

  async findAllGroups() {
    return this.prisma.pricingGroup.findMany({
      orderBy: { code: 'asc' },
    });
  }

  async findOneGroup(id: string) {
    const group = await this.prisma.pricingGroup.findUnique({
      where: { id },
      include: {
        customers: {
          select: {
            id: true,
            businessName: true,
            customerCode: true,
          },
        },
      },
    });

    if (!group) {
      throw new NotFoundException(`Pricing Group with ID '${id}' not found.`);
    }

    return group;
  }

  async updateGroup(id: string, dto: UpdatePricingGroupDto) {
    const group = await this.findOneGroup(id);

    let code = group.code;
    if (dto.code) {
      code = dto.code.trim().toUpperCase();
      if (code !== group.code) {
        const existing = await this.prisma.pricingGroup.findUnique({
          where: { code },
        });
        if (existing) {
          throw new ConflictException(`Pricing Group with code '${code}' already exists.`);
        }
      }
    }

    return this.prisma.pricingGroup.update({
      where: { id },
      data: {
        name: dto.name,
        code,
        description: dto.description,
        isActive: dto.isActive,
      },
    });
  }

  async removeGroup(id: string) {
    const group = await this.findOneGroup(id);

    // 1. Check if group has customers linked
    const customersCount = await this.prisma.customer.count({
      where: { pricingGroupId: id },
    });
    if (customersCount > 0) {
      throw new BadRequestException(`Cannot delete pricing group that is currently assigned to ${customersCount} customer(s).`);
    }

    // 2. Check if active product pricings exist
    const pricingsCount = await this.prisma.productPricing.count({
      where: { pricingGroupId: id },
    });
    if (pricingsCount > 0) {
      throw new BadRequestException(`Cannot delete pricing group with ${pricingsCount} active product price definition(s).`);
    }

    await this.prisma.pricingGroup.delete({
      where: { id },
    });

    return { message: 'Pricing Group deleted successfully' };
  }

  async setProductPrice(dto: SetProductPricingDto, userId: string) {
    // 1. Verify Product exists
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID '${dto.productId}' not found.`);
    }

    // 2. Verify Pricing Group exists
    const group = await this.prisma.pricingGroup.findUnique({
      where: { id: dto.pricingGroupId },
    });
    if (!group) {
      throw new NotFoundException(`Pricing Group with ID '${dto.pricingGroupId}' not found.`);
    }

    const price = new Prisma.Decimal(dto.price);
    const mrp = dto.mrp ? new Prisma.Decimal(dto.mrp) : null;
    const discountPercent = dto.discountPercent ? new Prisma.Decimal(dto.discountPercent) : null;

    // 3. Upsert Product Pricing record
    return this.prisma.productPricing.upsert({
      where: {
        productId_pricingGroupId: {
          productId: dto.productId,
          pricingGroupId: dto.pricingGroupId,
        },
      },
      update: {
        price,
        mrp,
        discountPercent,
        minQuantity: dto.minQuantity,
        maxQuantity: dto.maxQuantity,
        updatedBy: userId,
      },
      create: {
        productId: dto.productId,
        pricingGroupId: dto.pricingGroupId,
        price,
        mrp,
        discountPercent,
        minQuantity: dto.minQuantity,
        maxQuantity: dto.maxQuantity,
        createdBy: userId,
      },
      include: {
        pricingGroup: true,
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
      },
    });
  }

  async removeProductPrice(productId: string, pricingGroupId: string) {
    try {
      await this.prisma.productPricing.delete({
        where: {
          productId_pricingGroupId: {
            productId,
            pricingGroupId,
          },
        },
      });
      return { message: 'Product pricing deleted successfully' };
    } catch (e) {
      throw new NotFoundException('Pricing record not found.');
    }
  }
}
