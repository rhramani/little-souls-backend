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
exports.CategoryService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let CategoryService = class CategoryService {
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
        let slug = dto.slug ? this.slugify(dto.slug) : this.slugify(dto.name);
        const existing = await this.prisma.category.findUnique({
            where: { slug },
        });
        if (existing) {
            slug = `${slug}-${Date.now()}`;
        }
        if (dto.parentCategoryId) {
            const parent = await this.prisma.category.findUnique({
                where: { id: dto.parentCategoryId },
            });
            if (!parent) {
                throw new common_1.NotFoundException(`Parent category with ID '${dto.parentCategoryId}' not found.`);
            }
        }
        return this.prisma.category.create({
            data: {
                name: dto.name,
                slug,
                description: dto.description,
                parentCategoryId: dto.parentCategoryId || null,
                catalogueId: dto.catalogueId || null,
                imageUrl: dto.imageUrl,
                bannerUrl: dto.bannerUrl,
                isActive: dto.isActive !== undefined ? dto.isActive : true,
                sortOrder: dto.sortOrder || 0,
                createdBy: userId,
            },
        });
    }
    async findAll(onlyActive = false, catalogueId) {
        const where = {};
        if (onlyActive) {
            where.isActive = true;
        }
        if (catalogueId) {
            where.catalogueId = catalogueId;
        }
        const categories = await this.prisma.category.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { products: true },
                },
            },
        });
        return categories;
    }
    async getTree(onlyActive = false) {
        const allCategories = await this.prisma.category.findMany({
            where: onlyActive ? { isActive: true } : {},
            orderBy: { sortOrder: 'asc' },
        });
        const categoryMap = new Map();
        const tree = [];
        for (const cat of allCategories) {
            categoryMap.set(cat.id, { ...cat, children: [] });
        }
        for (const cat of allCategories) {
            const mapped = categoryMap.get(cat.id);
            if (cat.parentCategoryId && categoryMap.has(cat.parentCategoryId)) {
                categoryMap.get(cat.parentCategoryId).children.push(mapped);
            }
            else {
                tree.push(mapped);
            }
        }
        return tree;
    }
    async findOne(id) {
        const category = await this.prisma.category.findUnique({
            where: { id },
            include: {
                parentCategory: true,
                childCategories: {
                    orderBy: { sortOrder: 'asc' },
                },
            },
        });
        if (!category) {
            throw new common_1.NotFoundException(`Category with ID '${id}' not found.`);
        }
        return category;
    }
    async findOneBySlug(slug) {
        const category = await this.prisma.category.findUnique({
            where: { slug },
            include: {
                parentCategory: true,
                childCategories: {
                    orderBy: { sortOrder: 'asc' },
                },
            },
        });
        if (!category) {
            throw new common_1.NotFoundException(`Category with slug '${slug}' not found.`);
        }
        return category;
    }
    async update(id, dto, userId) {
        const category = await this.findOne(id);
        let slug = category.slug;
        if (dto.slug) {
            slug = this.slugify(dto.slug);
        }
        else if (dto.name) {
            slug = this.slugify(dto.name);
        }
        if (slug !== category.slug) {
            const existing = await this.prisma.category.findUnique({
                where: { slug },
            });
            if (existing) {
                throw new common_1.ConflictException(`Category with slug '${slug}' already exists.`);
            }
        }
        if (dto.parentCategoryId) {
            if (dto.parentCategoryId === id) {
                throw new common_1.BadRequestException('A category cannot be its own parent.');
            }
            const parent = await this.prisma.category.findUnique({
                where: { id: dto.parentCategoryId },
            });
            if (!parent) {
                throw new common_1.NotFoundException(`Parent category with ID '${dto.parentCategoryId}' not found.`);
            }
        }
        const updatedCategory = await this.prisma.category.update({
            where: { id },
            data: {
                name: dto.name,
                slug,
                description: dto.description !== undefined ? dto.description : undefined,
                parentCategoryId: dto.parentCategoryId !== undefined ? dto.parentCategoryId : undefined,
                imageUrl: dto.imageUrl !== undefined ? dto.imageUrl : undefined,
                bannerUrl: dto.bannerUrl !== undefined ? dto.bannerUrl : undefined,
                isActive: dto.isActive,
                sortOrder: dto.sortOrder,
                updatedBy: userId,
            },
        });
        if (dto.isActive !== undefined) {
            const descendantIds = await this.getAllDescendantCategoryIds(id);
            const allCategoryIds = [id, ...descendantIds];
            if (descendantIds.length > 0) {
                await this.prisma.category.updateMany({
                    where: { id: { in: descendantIds } },
                    data: {
                        isActive: dto.isActive,
                        updatedBy: userId,
                    },
                });
            }
            await this.prisma.product.updateMany({
                where: { categoryId: { in: allCategoryIds } },
                data: {
                    isActive: dto.isActive,
                    updatedBy: userId,
                },
            });
        }
        return updatedCategory;
    }
    async getAllDescendantCategoryIds(categoryId) {
        const result = [];
        let currentLevel = [categoryId];
        while (currentLevel.length > 0) {
            const children = await this.prisma.category.findMany({
                where: { parentCategoryId: { in: currentLevel } },
                select: { id: true },
            });
            const childIds = children.map((c) => c.id);
            if (childIds.length === 0)
                break;
            result.push(...childIds);
            currentLevel = childIds;
        }
        return result;
    }
    async remove(id) {
        await this.findOne(id);
        const products = await this.prisma.product.findMany({
            where: { categoryId: id },
            select: { id: true },
        });
        const productIds = products.map((p) => p.id);
        if (productIds.length > 0) {
            await this.prisma.imageCleaningTask.deleteMany({
                where: { productId: { in: productIds } },
            });
            await this.prisma.productImage.deleteMany({
                where: { productId: { in: productIds } },
            });
            await this.prisma.productPricing.deleteMany({
                where: { productId: { in: productIds } },
            });
            await this.prisma.cartItem.deleteMany({
                where: { productId: { in: productIds } },
            });
            await this.prisma.product.deleteMany({
                where: { categoryId: id },
            });
        }
        await this.prisma.category.deleteMany({
            where: { parentCategoryId: id },
        });
        await this.prisma.category.delete({
            where: { id },
        });
        return { message: 'Category deleted successfully' };
    }
};
exports.CategoryService = CategoryService;
exports.CategoryService = CategoryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CategoryService);
//# sourceMappingURL=category.service.js.map