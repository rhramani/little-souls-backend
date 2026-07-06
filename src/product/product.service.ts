import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { Prisma } from '@prisma/client';
import { ImageCleaningService } from '../image-cleaning/image-cleaning.service';

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imageCleaningService: ImageCleaningService,
  ) {}

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
      throw new ConflictException(
        `Product with SKU '${dto.sku}' already exists.`,
      );
    }

    // 2. Verify Slug uniqueness
    const slugExists = await this.prisma.product.findUnique({
      where: { slug },
    });
    if (slugExists) {
      throw new ConflictException(
        `Product with slug '${slug}' already exists.`,
      );
    }

    // 3. Verify Category exists
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) {
      throw new NotFoundException(
        `Category with ID '${dto.categoryId}' not found.`,
      );
    }

    // 4. Create Product with relations inside Transaction
    const product = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          sku: dto.sku,
          name: dto.name,
          slug,
          shortDescription: dto.shortDescription,
          description: dto.description,
          categoryId: dto.categoryId,
          moq: dto.moq || 1,
          barcode: dto.barcode || dto.sku,
          brand: dto.brand,
          size: dto.size,
          color: dto.color,
          material: dto.material,
          unit: dto.unit || 'PCS',
          hsnCode: dto.hsnCode,
          weight: dto.weight ? Number(dto.weight) : null,
          taxPercent: dto.taxPercent ? Number(dto.taxPercent) : null,
          stockQuantity: dto.stockQuantity || 0,
          stockStatus: dto.stockStatus || 'IN_STOCK',
          allowBackorder: dto.allowBackorder || false,
          expectedRestockDate: dto.expectedRestockDate
            ? new Date(dto.expectedRestockDate)
            : null,
          tags: dto.tags,
          productImage: dto.productImage,
          productPictureUrl: dto.productPictureUrl,
          productPrice:
            dto.productPrice !== undefined ? Number(dto.productPrice) : null,
          discountedPrice:
            dto.discountedPrice !== undefined
              ? Number(dto.discountedPrice)
              : null,
          taxType: dto.taxType,
          parentProductSku: dto.parentProductSku,
          parentProductId: dto.parentProductId,
          privateNotes: dto.privateNotes,
          setName: dto.setName,
          setQuantity: dto.setQuantity,
          setType: dto.setType,
          sizes: dto.sizes,
          sizesSetQuantity: dto.sizesSetQuantity,
          colors: dto.colors,
          colorsSetQuantity: dto.colorsSetQuantity,
          nt11_48: dto.nt11_48,
          nt11_48SetQuantity: dto.nt11_48SetQuantity,
          sixToTwelveMonths: dto.sixToTwelveMonths,
          sixToTwelveMonthsSetQuantity: dto.sixToTwelveMonthsSetQuantity,
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
            price: Number(prc.price),
            mrp: prc.mrp ? Number(prc.mrp) : null,
            discountPercent: prc.discountPercent
              ? Number(prc.discountPercent)
              : null,
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

    if (product) {
      this.imageCleaningService
        .triggerBackgroundCleaningForProduct(product.id, userId)
        .catch(() => {});
    }

    return product;
  }

  async findAll(query: QueryProductDto, userPricingGroupId?: string) {
    const {
      page = 1,
      limit = 10,
      search,
      categoryId,
      catalogueId,
      brand,
      stockStatus,
      isActive,
      isFeatured,
      sortBy,
      sortOrder,
      moqTiers,
      stockStatuses,
      hasCatalogue,
    } = query;
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

    if (hasCatalogue !== undefined) {
      if (hasCatalogue || String(hasCatalogue) === 'true') {
        where.catalogueId = { not: null };
      } else {
        where.catalogueId = null;
      }
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (catalogueId) {
      where.catalogueId = catalogueId;
    }

    if (brand) {
      where.brand = { equals: brand, mode: 'insensitive' };
    }

    const andConditions: any[] = [];

    if (userPricingGroupId) {
      andConditions.push({
        OR: [{ catalogueId: null }, { catalogue: { isPublished: true } }],
      });
    }

    if (stockStatus) {
      where.stockStatus = stockStatus;
    }

    if (stockStatuses) {
      const statuses = stockStatuses.split(',').filter(Boolean);
      const mappedStatuses: string[] = [];
      if (statuses.includes('in')) mappedStatuses.push('IN_STOCK');
      if (statuses.includes('low')) mappedStatuses.push('LOW_STOCK');
      if (statuses.includes('out')) mappedStatuses.push('OUT_OF_STOCK');
      if (statuses.includes('backorder')) mappedStatuses.push('ON_BACKORDER');

      if (mappedStatuses.length > 0) {
        where.stockStatus = { in: mappedStatuses };
      }
    }

    if (moqTiers) {
      const tiers = moqTiers.split(',').filter(Boolean);
      const moqConditions: any[] = [];

      if (tiers.includes('low')) {
        moqConditions.push({ moq: { lte: 12 } });
      }
      if (tiers.includes('mid')) {
        moqConditions.push({ moq: { gt: 12, lte: 24 } });
      }
      if (tiers.includes('high')) {
        moqConditions.push({ moq: { gt: 24 } });
      }

      if (moqConditions.length > 0) {
        andConditions.push({ OR: moqConditions });
      }
    }

    if (search) {
      const orConditions: any[] = [
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
      ];

      // If search is alphanumeric, construct a regex pattern to allow optional hyphens (e.g. "2514" -> "^2-?5-?1-?4$")
      const isAlphanumeric = /^[a-zA-Z0-9]+$/.test(search);
      if (isAlphanumeric) {
        const hyphenRegex = search.split('').join('-?');
        orConditions.push(
          { sku: { regex: `^${hyphenRegex}$`, options: 'i' } },
          { barcode: { regex: `^${hyphenRegex}$`, options: 'i' } },
        );
      }

      andConditions.push({
        OR: orConditions,
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
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
        activePrice =
          product.pricing.find(
            (p) => p.pricingGroupId === userPricingGroupId,
          ) || null;
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
        catalogue: true,
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID '${id}' not found.`);
    }

    if (
      userPricingGroupId &&
      product.catalogueId &&
      !product.catalogue?.isPublished
    ) {
      throw new NotFoundException(`Product with ID '${id}' not found.`);
    }

    let activePrice: any = null;
    if (userPricingGroupId) {
      activePrice =
        product.pricing.find((p) => p.pricingGroupId === userPricingGroupId) ||
        null;
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
        catalogue: true,
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with slug '${slug}' not found.`);
    }

    if (
      userPricingGroupId &&
      product.catalogueId &&
      !product.catalogue?.isPublished
    ) {
      throw new NotFoundException(`Product with slug '${slug}' not found.`);
    }

    let activePrice: any = null;
    if (userPricingGroupId) {
      activePrice =
        product.pricing.find((p) => p.pricingGroupId === userPricingGroupId) ||
        null;
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
        throw new NotFoundException(
          `Category with ID '${dto.categoryId}' not found.`,
        );
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
        throw new ConflictException(
          `Product with slug '${slug}' already exists.`,
        );
      }
    }

    // 3. SKU check
    if (dto.sku && dto.sku !== product.sku) {
      const skuExists = await this.prisma.product.findUnique({
        where: { sku: dto.sku },
      });
      if (skuExists) {
        throw new ConflictException(
          `Product with SKU '${dto.sku}' already exists.`,
        );
      }
    }

    // 4. Update in Transaction
    const updatedProduct = await this.prisma.$transaction(async (tx) => {
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
          barcode:
            dto.barcode !== undefined
              ? dto.barcode || dto.sku || product.sku
              : dto.sku !== undefined
                ? dto.sku
                : undefined,
          brand: dto.brand,
          size: dto.size,
          color: dto.color,
          material: dto.material,
          unit: dto.unit,
          hsnCode: dto.hsnCode,
          weight: dto.weight ? Number(dto.weight) : undefined,
          taxPercent: dto.taxPercent ? Number(dto.taxPercent) : undefined,
          stockQuantity: dto.stockQuantity,
          stockStatus: dto.stockStatus,
          allowBackorder: dto.allowBackorder,
          expectedRestockDate: dto.expectedRestockDate
            ? new Date(dto.expectedRestockDate)
            : undefined,
          tags: dto.tags,
          productImage:
            dto.productImage !== undefined ? dto.productImage : undefined,
          productPictureUrl:
            dto.productPictureUrl !== undefined
              ? dto.productPictureUrl
              : undefined,
          productPrice:
            dto.productPrice !== undefined
              ? dto.productPrice === null
                ? null
                : Number(dto.productPrice)
              : undefined,
          discountedPrice:
            dto.discountedPrice !== undefined
              ? dto.discountedPrice === null
                ? null
                : Number(dto.discountedPrice)
              : undefined,
          taxType: dto.taxType !== undefined ? dto.taxType : undefined,
          parentProductSku:
            dto.parentProductSku !== undefined
              ? dto.parentProductSku
              : undefined,
          parentProductId:
            dto.parentProductId !== undefined ? dto.parentProductId : undefined,
          privateNotes:
            dto.privateNotes !== undefined ? dto.privateNotes : undefined,
          setName: dto.setName !== undefined ? dto.setName : undefined,
          setQuantity:
            dto.setQuantity !== undefined ? dto.setQuantity : undefined,
          setType: dto.setType !== undefined ? dto.setType : undefined,
          sizes: dto.sizes !== undefined ? dto.sizes : undefined,
          sizesSetQuantity:
            dto.sizesSetQuantity !== undefined
              ? dto.sizesSetQuantity
              : undefined,
          colors: dto.colors !== undefined ? dto.colors : undefined,
          colorsSetQuantity:
            dto.colorsSetQuantity !== undefined
              ? dto.colorsSetQuantity
              : undefined,
          nt11_48: dto.nt11_48 !== undefined ? dto.nt11_48 : undefined,
          nt11_48SetQuantity:
            dto.nt11_48SetQuantity !== undefined
              ? dto.nt11_48SetQuantity
              : undefined,
          sixToTwelveMonths:
            dto.sixToTwelveMonths !== undefined
              ? dto.sixToTwelveMonths
              : undefined,
          sixToTwelveMonthsSetQuantity:
            dto.sixToTwelveMonthsSetQuantity !== undefined
              ? dto.sixToTwelveMonthsSetQuantity
              : undefined,
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
              price: Number(prc.price),
              mrp: prc.mrp ? Number(prc.mrp) : null,
              discountPercent: prc.discountPercent
                ? Number(prc.discountPercent)
                : null,
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

    if (updatedProduct) {
      this.imageCleaningService
        .triggerBackgroundCleaningForProduct(id, userId)
        .catch(() => {});
    }

    return updatedProduct;
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
      throw new BadRequestException(
        'Cannot delete product that has active customer orders associated with it.',
      );
    }

    // 2. Safe deletion of relations in cascade inside transaction
    await this.prisma.$transaction(async (tx) => {
      await tx.imageCleaningTask.deleteMany({ where: { productId: id } });
      await tx.productImage.deleteMany({ where: { productId: id } });
      await tx.productPricing.deleteMany({ where: { productId: id } });
      await tx.productCatalogFile.deleteMany({ where: { productId: id } });
      await tx.productVideo.deleteMany({ where: { productId: id } });
      await tx.cartItem.deleteMany({ where: { productId: id } });
      await tx.stockMovement.deleteMany({ where: { productId: id } });
      await tx.backorderApproval.deleteMany({ where: { productId: id } });

      await tx.product.delete({
        where: { id },
      });
    });

    return { message: 'Product deleted successfully' };
  }

  async addVideo(productId: string, dto: any, userId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID '${productId}' not found.`);
    }

    return this.prisma.productVideo.create({
      data: {
        productId,
        videoUrl: dto.videoUrl,
        videoType: dto.videoType,
        title: dto.title,
        thumbnailUrl: dto.thumbnailUrl,
        createdBy: userId,
      },
    });
  }

  async addCatalog(productId: string, dto: any, userId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID '${productId}' not found.`);
    }

    return this.prisma.productCatalogFile.create({
      data: {
        productId,
        fileUrl: dto.fileUrl,
        title: dto.title,
        fileType: dto.fileType,
        createdBy: userId,
      },
    });
  }

  async deleteImage(productId: string, imageId: string) {
    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });
    if (!image)
      throw new NotFoundException(
        `Image '${imageId}' not found for product '${productId}'.`,
      );

    await this.prisma.productImage.delete({ where: { id: imageId } });

    // If deleted was primary, auto-promote the first remaining image
    if (image.isPrimary) {
      const next = await this.prisma.productImage.findFirst({
        where: { productId },
        orderBy: { sortOrder: 'asc' },
      });
      if (next)
        await this.prisma.productImage.update({
          where: { id: next.id },
          data: { isPrimary: true },
        });
    }

    return { message: 'Image deleted successfully.' };
  }

  async setPrimaryImage(productId: string, imageId: string) {
    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });
    if (!image)
      throw new NotFoundException(
        `Image '${imageId}' not found for product '${productId}'.`,
      );

    return this.prisma.$transaction(async (tx) => {
      await tx.productImage.updateMany({
        where: { productId },
        data: { isPrimary: false },
      });
      return tx.productImage.update({
        where: { id: imageId },
        data: { isPrimary: true },
      });
    });
  }
}
