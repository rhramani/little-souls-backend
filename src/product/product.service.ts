import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  private slugify(text: string): string {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-');
  }

  async create(dto: CreateProductDto, userId: string) {
    const slug = dto.slug ? this.slugify(dto.slug) : this.slugify(dto.name);

    // 1. Verify SKU uniqueness
    const skuExists = await this.prisma.product.findUnique({
      where: { sku: dto.sku },
    });
    if (skuExists) {
      throw new ConflictException(`Product with SKU '${dto.sku}' already exists.`);
    }

    // 2. Verify Slug uniqueness
    const slugExists = await this.prisma.product.findUnique({
      where: { slug },
    });
    if (slugExists) {
      throw new ConflictException(`Product with slug '${slug}' already exists.`);
    }

    // 3. Verify Category exists
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) {
      throw new NotFoundException(`Category with ID '${dto.categoryId}' not found.`);
    }

    // 4. Create Product with relations inside Transaction
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          sku: dto.sku,
          name: dto.name,
          slug,
          shortDescription: dto.shortDescription,
          description: dto.description,
          categoryId: dto.categoryId,
          moq: dto.moq || 1,
          barcode: dto.barcode,
          brand: dto.brand,
          size: dto.size,
          color: dto.color,
          material: dto.material,
          unit: dto.unit || 'PCS',
          hsnCode: dto.hsnCode,
          weight: dto.weight ? new Prisma.Decimal(dto.weight) : null,
          taxPercent: dto.taxPercent ? new Prisma.Decimal(dto.taxPercent) : null,
          stockQuantity: dto.stockQuantity || 0,
          stockStatus: dto.stockStatus || 'IN_STOCK',
          allowBackorder: dto.allowBackorder || false,
          expectedRestockDate: dto.expectedRestockDate ? new Date(dto.expectedRestockDate) : null,
          tags: dto.tags,
          isActive: dto.isActive !== undefined ? dto.isActive : true,
          isFeatured: dto.isFeatured !== undefined ? dto.isFeatured : false,
          sortOrder: dto.sortOrder || 0,
          publishedAt: dto.isActive ? new Date() : null,
          createdBy: userId,
        },
      });

      // Create Images if provided
      if (dto.images && dto.images.length > 0) {
        await tx.productImage.createMany({
          data: dto.images.map((img) => ({
            productId: product.id,
            originalUrl: img.originalUrl,
            altText: img.altText,
            sortOrder: img.sortOrder || 0,
            isPrimary: img.isPrimary || false,
            cleaningStatus: 'NOT_REQUIRED',
            createdBy: userId,
          })),
        });
      }

      // Create Pricing if provided
      if (dto.pricing && dto.pricing.length > 0) {
        await tx.productPricing.createMany({
          data: dto.pricing.map((prc) => ({
            productId: product.id,
            pricingGroupId: prc.pricingGroupId,
            price: new Prisma.Decimal(prc.price),
            mrp: prc.mrp ? new Prisma.Decimal(prc.mrp) : null,
            discountPercent: prc.discountPercent ? new Prisma.Decimal(prc.discountPercent) : null,
            minQuantity: prc.minQuantity,
            maxQuantity: prc.maxQuantity,
            createdBy: userId,
          })),
        });
      }

      return tx.product.findUnique({
        where: { id: product.id },
        include: {
          category: true,
          images: true,
          pricing: {
            include: {
              pricingGroup: true,
            },
          },
        },
      });
    });
  }

  async findAll(query: QueryProductDto, userPricingGroupId?: string) {
    const { page = 1, limit = 10, search, categoryId, brand, stockStatus, isActive, isFeatured, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    // Build filters
    const where: any = {};

    if (isActive !== undefined) {
      where.isActive = isActive;
    } else {
      // By default, only fetch active products for guests or standard customers
      if (userPricingGroupId) {
        where.isActive = true;
      }
    }

    if (isFeatured !== undefined) {
      where.isFeatured = isFeatured;
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (brand) {
      where.brand = { equals: brand, mode: 'insensitive' };
    }

    if (stockStatus) {
      where.stockStatus = stockStatus;
    }

    if (search) {
      where.OR = [
        { sku: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Determine Sort Order
    let orderBy: any = {};
    if (sortBy === 'price' && userPricingGroupId) {
      // Nested ordering by price is not natively supported directly on relation in Prisma findMany without complex raw queries
      // We will sort programmatically or fall back to standard sorts.
      orderBy = { sortOrder: 'asc' };
    } else if (sortBy) {
      orderBy = { [sortBy]: sortOrder || 'desc' };
    } else {
      orderBy = { createdAt: 'desc' };
    }

    // Execute queries
    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          category: true,
          images: {
            orderBy: { sortOrder: 'asc' },
          },
          pricing: {
            include: {
              pricingGroup: true,
            },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    // Format products to dynamically assign applicable custom price
    const formattedProducts = products.map((product) => {
      let activePrice: any = null;
      if (userPricingGroupId) {
        activePrice = product.pricing.find((p) => p.pricingGroupId === userPricingGroupId) || null;
      }

      return {
        ...product,
        activePrice, // Attaches correct pricing tier to response directly
      };
    });

    return {
      products: formattedProducts,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, userPricingGroupId?: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        images: {
          orderBy: { sortOrder: 'asc' },
        },
        pricing: {
          include: {
            pricingGroup: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID '${id}' not found.`);
    }

    let activePrice: any = null;
    if (userPricingGroupId) {
      activePrice = product.pricing.find((p) => p.pricingGroupId === userPricingGroupId) || null;
    }

    return {
      ...product,
      activePrice,
    };
  }

  async findOneBySlug(slug: string, userPricingGroupId?: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        category: true,
        images: {
          orderBy: { sortOrder: 'asc' },
        },
        pricing: {
          include: {
            pricingGroup: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with slug '${slug}' not found.`);
    }

    let activePrice: any = null;
    if (userPricingGroupId) {
      activePrice = product.pricing.find((p) => p.pricingGroupId === userPricingGroupId) || null;
    }

    return {
      ...product,
      activePrice,
    };
  }

  async update(id: string, dto: UpdateProductDto, userId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID '${id}' not found.`);
    }

    // 1. Verify Category if provided
    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new NotFoundException(`Category with ID '${dto.categoryId}' not found.`);
      }
    }

    // 2. Slug check
    let slug = product.slug;
    if (dto.slug) {
      slug = this.slugify(dto.slug);
    } else if (dto.name) {
      slug = this.slugify(dto.name);
    }

    if (slug !== product.slug) {
      const slugExists = await this.prisma.product.findUnique({
        where: { slug },
      });
      if (slugExists) {
        throw new ConflictException(`Product with slug '${slug}' already exists.`);
      }
    }

    // 3. SKU check
    if (dto.sku && dto.sku !== product.sku) {
      const skuExists = await this.prisma.product.findUnique({
        where: { sku: dto.sku },
      });
      if (skuExists) {
        throw new ConflictException(`Product with SKU '${dto.sku}' already exists.`);
      }
    }

    // 4. Update in Transaction
    return this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          sku: dto.sku,
          name: dto.name,
          slug,
          shortDescription: dto.shortDescription,
          description: dto.description,
          categoryId: dto.categoryId,
          moq: dto.moq,
          barcode: dto.barcode,
          brand: dto.brand,
          size: dto.size,
          color: dto.color,
          material: dto.material,
          unit: dto.unit,
          hsnCode: dto.hsnCode,
          weight: dto.weight ? new Prisma.Decimal(dto.weight) : undefined,
          taxPercent: dto.taxPercent ? new Prisma.Decimal(dto.taxPercent) : undefined,
          stockQuantity: dto.stockQuantity,
          stockStatus: dto.stockStatus,
          allowBackorder: dto.allowBackorder,
          expectedRestockDate: dto.expectedRestockDate ? new Date(dto.expectedRestockDate) : undefined,
          tags: dto.tags,
          isActive: dto.isActive,
          isFeatured: dto.isFeatured,
          sortOrder: dto.sortOrder,
          updatedBy: userId,
        },
      });

      // Images sync: Delete existing and replace if new list provided
      if (dto.images !== undefined) {
        await tx.productImage.deleteMany({ where: { productId: id } });
        if (dto.images.length > 0) {
          await tx.productImage.createMany({
            data: dto.images.map((img) => ({
              productId: id,
              originalUrl: img.originalUrl,
              altText: img.altText,
              sortOrder: img.sortOrder || 0,
              isPrimary: img.isPrimary || false,
              cleaningStatus: 'NOT_REQUIRED',
              createdBy: userId,
            })),
          });
        }
      }

      // Pricing sync: Delete existing and replace if new list provided
      if (dto.pricing !== undefined) {
        await tx.productPricing.deleteMany({ where: { productId: id } });
        if (dto.pricing.length > 0) {
          await tx.productPricing.createMany({
            data: dto.pricing.map((prc) => ({
              productId: id,
              pricingGroupId: prc.pricingGroupId,
              price: new Prisma.Decimal(prc.price),
              mrp: prc.mrp ? new Prisma.Decimal(prc.mrp) : null,
              discountPercent: prc.discountPercent ? new Prisma.Decimal(prc.discountPercent) : null,
              minQuantity: prc.minQuantity,
              maxQuantity: prc.maxQuantity,
              createdBy: userId,
            })),
          });
        }
      }

      return tx.product.findUnique({
        where: { id },
        include: {
          category: true,
          images: true,
          pricing: {
            include: {
              pricingGroup: true,
            },
          },
        },
      });
    });
  }

  async remove(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID '${id}' not found.`);
    }

    // 1. Check if the product has associated order items
    const ordersCount = await this.prisma.orderItem.count({
      where: { productId: id },
    });
    if (ordersCount > 0) {
      throw new BadRequestException('Cannot delete product that has active customer orders associated with it.');
    }

    // 2. Safe deletion of relations in cascade (Prisma handles model-level Cascades if configured, or manual delete)
    await this.prisma.product.delete({
      where: { id },
    });

    return { message: 'Product deleted successfully' };
  }
}
