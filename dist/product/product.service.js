"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let ProductService = class ProductService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    slugify(text) {
        return text
            .toString()
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')
            .replace(/[^\w\-]+/g, '')
            .replace(/\-\-+/g, '-');
    }
    async create(dto, userId) {
        const slug = dto.slug ? this.slugify(dto.slug) : this.slugify(dto.name);
        const skuExists = await this.prisma.product.findUnique({
            where: { sku: dto.sku },
        });
        if (skuExists) {
            throw new common_1.ConflictException(`Product with SKU '${dto.sku}' already exists.`);
        }
        const slugExists = await this.prisma.product.findUnique({
            where: { slug },
        });
        if (slugExists) {
            throw new common_1.ConflictException(`Product with slug '${slug}' already exists.`);
        }
        let categoryId = dto.categoryId;
        if (!categoryId) {
            let defaultCategory = await this.prisma.category.findUnique({
                where: { slug: 'uncategorized' },
            });
            if (!defaultCategory) {
                defaultCategory = await this.prisma.category.create({
                    data: {
                        name: 'Uncategorized',
                        slug: 'uncategorized',
                        isActive: true,
                        createdBy: userId,
                    },
                });
            }
            categoryId = defaultCategory.id;
        }
        else {
            const category = await this.prisma.category.findUnique({
                where: { id: categoryId },
            });
            if (!category) {
                throw new common_1.NotFoundException(`Category with ID '${categoryId}' not found.`);
            }
        }
        const product = await this.prisma.$transaction(async (tx) => {
            const product = await tx.product.create({
                data: {
                    sku: dto.sku,
                    name: dto.name,
                    slug,
                    shortDescription: dto.shortDescription,
                    description: dto.description,
                    categoryId: categoryId,
                    catalogueIds: dto.catalogueId ? [dto.catalogueId] : [],
                    moq: dto.moq || 1,
                    fixQty: dto.fixQty || null,
                    barcode: dto.barcode || dto.sku,
                    brand: dto.brand,
                    size: dto.size,
                    color: dto.color,
                    material: dto.material,
                    unit: dto.unit || 'PCS',
                    hsnCode: dto.hsnCode,
                    weight: dto.weight ? Number(dto.weight) : null,
                    taxPercent: dto.taxPercent !== undefined && dto.taxPercent !== null && dto.taxPercent !== ''
                        ? Number(dto.taxPercent)
                        : null,
                    stockQuantity: dto.stockQuantity || 0,
                    stockStatus: dto.stockStatus || 'IN_STOCK',
                    allowBackorder: dto.allowBackorder || false,
                    expectedRestockDate: dto.expectedRestockDate
                        ? new Date(dto.expectedRestockDate)
                        : null,
                    tags: dto.tags,
                    productImage: dto.productImage,
                    productPictureUrl: dto.productPictureUrl,
                    productPrice: dto.productPrice !== undefined ? Number(dto.productPrice) : null,
                    discountedPrice: dto.discountedPrice !== undefined
                        ? Number(dto.discountedPrice)
                        : null,
                    taxType: dto.taxType || null,
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
                    isActive: dto.isActive !== undefined ? dto.isActive : true,
                    isFeatured: dto.isFeatured !== undefined ? dto.isFeatured : false,
                    sortOrder: dto.sortOrder || 0,
                    publishedAt: dto.isActive ? new Date() : null,
                    createdBy: userId,
                },
            });
            if (dto.catalogueId) {
                const catalogue = await tx.catalogue.findUnique({
                    where: { id: dto.catalogueId },
                });
                if (!catalogue) {
                    throw new common_1.NotFoundException(`Catalogue with ID '${dto.catalogueId}' not found.`);
                }
                const updatedProductIds = Array.from(new Set([...catalogue.productIds, product.id]));
                await tx.catalogue.update({
                    where: { id: dto.catalogueId },
                    data: { productIds: updatedProductIds },
                });
            }
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
        return product;
    }
    async findAll(query, userPricingGroupId) {
        const { page = 1, limit = 10, search, categoryId, catalogueId, brand, stockStatus, isActive, isFeatured, sortBy, sortOrder, moqTiers, stockStatuses, hasCatalogue, } = query;
        const skip = (page - 1) * limit;
        const where = {};
        if (isActive !== undefined) {
            where.isActive = isActive;
        }
        else {
            if (userPricingGroupId) {
                where.isActive = true;
            }
        }
        if (isFeatured !== undefined) {
            where.isFeatured = isFeatured;
        }
        if (hasCatalogue !== undefined) {
            if (hasCatalogue || String(hasCatalogue) === 'true') {
                where.catalogueIds = { isEmpty: false };
            }
            else {
                where.catalogueIds = { isEmpty: true };
            }
        }
        if (categoryId) {
            where.categoryId = categoryId;
        }
        if (catalogueId) {
            where.catalogueIds = { has: catalogueId };
        }
        if (brand) {
            where.brand = { equals: brand, mode: 'insensitive' };
        }
        const andConditions = [];
        if (userPricingGroupId) {
            andConditions.push({
                OR: [
                    { catalogueIds: { isEmpty: true } },
                    { catalogues: { some: { isPublished: true } } },
                ],
            });
        }
        if (stockStatus) {
            where.stockStatus = stockStatus;
        }
        if (stockStatuses) {
            const statuses = stockStatuses.split(',').filter(Boolean);
            const mappedStatuses = [];
            if (statuses.includes('in'))
                mappedStatuses.push('IN_STOCK');
            if (statuses.includes('low'))
                mappedStatuses.push('LOW_STOCK');
            if (statuses.includes('out'))
                mappedStatuses.push('OUT_OF_STOCK');
            if (statuses.includes('backorder'))
                mappedStatuses.push('ON_BACKORDER');
            if (mappedStatuses.length > 0) {
                where.stockStatus = { in: mappedStatuses };
            }
        }
        if (moqTiers) {
            const tiers = moqTiers.split(',').filter(Boolean);
            const moqConditions = [];
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
            const orConditions = [
                { sku: { contains: search, mode: 'insensitive' } },
                { barcode: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { brand: { contains: search, mode: 'insensitive' } },
            ];
            andConditions.push({
                OR: orConditions,
            });
        }
        if (andConditions.length > 0) {
            where.AND = andConditions;
        }
        let orderBy = {};
        if (sortBy === 'price' && userPricingGroupId) {
            orderBy = { sortOrder: 'asc' };
        }
        else if (sortBy) {
            orderBy = { [sortBy]: sortOrder || 'desc' };
        }
        else {
            orderBy = { createdAt: 'desc' };
        }
        const [products, total] = await Promise.all([
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
        const formattedProducts = products.map((product) => {
            let activePrice = null;
            if (userPricingGroupId) {
                activePrice =
                    product.pricing.find((p) => p.pricingGroupId === userPricingGroupId) || null;
            }
            return {
                ...product,
                activePrice,
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
    async findOne(id, userPricingGroupId) {
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
            throw new common_1.NotFoundException(`Product with ID '${id}' not found.`);
        }
        if (userPricingGroupId && product.catalogueIds.length > 0) {
            const publishedCatalogues = await this.prisma.catalogue.findMany({
                where: { id: { in: product.catalogueIds }, isPublished: true },
                select: { id: true },
            });
            if (publishedCatalogues.length === 0) {
                throw new common_1.NotFoundException(`Product with ID '${id}' not found.`);
            }
        }
        let activePrice = null;
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
    async findOneBySlug(slug, userPricingGroupId) {
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
            throw new common_1.NotFoundException(`Product with slug '${slug}' not found.`);
        }
        if (userPricingGroupId && product.catalogueIds.length > 0) {
            const publishedCatalogues = await this.prisma.catalogue.findMany({
                where: { id: { in: product.catalogueIds }, isPublished: true },
                select: { id: true },
            });
            if (publishedCatalogues.length === 0) {
                throw new common_1.NotFoundException(`Product with slug '${slug}' not found.`);
            }
        }
        let activePrice = null;
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
    async update(id, dto, userId) {
        const product = await this.prisma.product.findUnique({
            where: { id },
        });
        if (!product) {
            throw new common_1.NotFoundException(`Product with ID '${id}' not found.`);
        }
        if (dto.categoryId) {
            const category = await this.prisma.category.findUnique({
                where: { id: dto.categoryId },
            });
            if (!category) {
                throw new common_1.NotFoundException(`Category with ID '${dto.categoryId}' not found.`);
            }
        }
        let slug = product.slug;
        if (dto.slug) {
            slug = this.slugify(dto.slug);
        }
        else if (dto.name) {
            slug = this.slugify(dto.name);
        }
        if (slug !== product.slug) {
            const slugExists = await this.prisma.product.findUnique({
                where: { slug },
            });
            if (slugExists) {
                throw new common_1.ConflictException(`Product with slug '${slug}' already exists.`);
            }
        }
        if (dto.sku && dto.sku !== product.sku) {
            const skuExists = await this.prisma.product.findUnique({
                where: { sku: dto.sku },
            });
            if (skuExists) {
                throw new common_1.ConflictException(`Product with SKU '${dto.sku}' already exists.`);
            }
        }
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
                    fixQty: dto.fixQty !== undefined ? dto.fixQty : undefined,
                    barcode: dto.barcode !== undefined
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
                    taxPercent: dto.taxPercent !== undefined
                        ? dto.taxPercent === null || dto.taxPercent === ''
                            ? null
                            : Number(dto.taxPercent)
                        : undefined,
                    stockQuantity: dto.stockQuantity,
                    stockStatus: dto.stockStatus,
                    allowBackorder: dto.allowBackorder,
                    expectedRestockDate: dto.expectedRestockDate
                        ? new Date(dto.expectedRestockDate)
                        : undefined,
                    tags: dto.tags,
                    productImage: dto.productImage !== undefined ? dto.productImage : undefined,
                    productPictureUrl: dto.productPictureUrl !== undefined
                        ? dto.productPictureUrl
                        : undefined,
                    productPrice: dto.productPrice !== undefined
                        ? dto.productPrice === null
                            ? null
                            : Number(dto.productPrice)
                        : undefined,
                    discountedPrice: dto.discountedPrice !== undefined
                        ? dto.discountedPrice === null
                            ? null
                            : Number(dto.discountedPrice)
                        : undefined,
                    taxType: dto.taxType !== undefined
                        ? dto.taxType === null || dto.taxType === ''
                            ? null
                            : dto.taxType
                        : undefined,
                    parentProductSku: dto.parentProductSku !== undefined
                        ? dto.parentProductSku
                        : undefined,
                    parentProductId: dto.parentProductId !== undefined ? dto.parentProductId : undefined,
                    privateNotes: dto.privateNotes !== undefined ? dto.privateNotes : undefined,
                    setName: dto.setName !== undefined ? dto.setName : undefined,
                    setQuantity: dto.setQuantity !== undefined ? dto.setQuantity : undefined,
                    setType: dto.setType !== undefined ? dto.setType : undefined,
                    sizes: dto.sizes !== undefined ? dto.sizes : undefined,
                    sizesSetQuantity: dto.sizesSetQuantity !== undefined
                        ? dto.sizesSetQuantity
                        : undefined,
                    colors: dto.colors !== undefined ? dto.colors : undefined,
                    colorsSetQuantity: dto.colorsSetQuantity !== undefined
                        ? dto.colorsSetQuantity
                        : undefined,
                    isActive: dto.isActive,
                    isFeatured: dto.isFeatured,
                    sortOrder: dto.sortOrder,
                    updatedBy: userId,
                },
            });
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
        return updatedProduct;
    }
    async remove(id) {
        const product = await this.prisma.product.findUnique({
            where: { id },
        });
        if (!product) {
            throw new common_1.NotFoundException(`Product with ID '${id}' not found.`);
        }
        const ordersCount = await this.prisma.orderItem.count({
            where: { productId: id },
        });
        if (ordersCount > 0) {
            throw new common_1.BadRequestException('Cannot delete product that has active customer orders associated with it.');
        }
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
    async bulkDelete(ids) {
        const orderItems = await this.prisma.orderItem.findMany({
            where: { productId: { in: ids } },
            select: { productId: true },
        });
        const orderProductIds = new Set(orderItems.map((item) => item.productId));
        const deletableIds = ids.filter((id) => !orderProductIds.has(id));
        if (deletableIds.length === 0) {
            throw new common_1.BadRequestException('Cannot delete selected products as they all have active customer orders associated with them.');
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.imageCleaningTask.deleteMany({
                where: { productId: { in: deletableIds } },
            });
            await tx.productImage.deleteMany({
                where: { productId: { in: deletableIds } },
            });
            await tx.productPricing.deleteMany({
                where: { productId: { in: deletableIds } },
            });
            await tx.productCatalogFile.deleteMany({
                where: { productId: { in: deletableIds } },
            });
            await tx.productVideo.deleteMany({
                where: { productId: { in: deletableIds } },
            });
            await tx.cartItem.deleteMany({
                where: { productId: { in: deletableIds } },
            });
            await tx.stockMovement.deleteMany({
                where: { productId: { in: deletableIds } },
            });
            await tx.backorderApproval.deleteMany({
                where: { productId: { in: deletableIds } },
            });
            await tx.product.deleteMany({
                where: { id: { in: deletableIds } },
            });
        });
        const skippedCount = ids.length - deletableIds.length;
        return {
            message: `${deletableIds.length} products deleted successfully.${skippedCount > 0 ? ` ${skippedCount} products skipped because they have active orders.` : ''}`,
            deletedCount: deletableIds.length,
            skippedCount,
        };
    }
    async addVideo(productId, dto, userId) {
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
        });
        if (!product) {
            throw new common_1.NotFoundException(`Product with ID '${productId}' not found.`);
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
    async addCatalog(productId, dto, userId) {
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
        });
        if (!product) {
            throw new common_1.NotFoundException(`Product with ID '${productId}' not found.`);
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
    async deleteImage(productId, imageId) {
        const image = await this.prisma.productImage.findFirst({
            where: { id: imageId, productId },
        });
        if (!image)
            throw new common_1.NotFoundException(`Image '${imageId}' not found for product '${productId}'.`);
        await this.prisma.productImage.delete({ where: { id: imageId } });
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
    async setPrimaryImage(productId, imageId) {
        const image = await this.prisma.productImage.findFirst({
            where: { id: imageId, productId },
        });
        if (!image)
            throw new common_1.NotFoundException(`Image '${imageId}' not found for product '${productId}'.`);
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
};
exports.ProductService = ProductService;
exports.ProductService = ProductService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ProductService);
//# sourceMappingURL=product.service.js.map