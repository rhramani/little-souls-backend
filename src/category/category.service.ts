import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  private slugify(text: string): string {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-') // Replace spaces with -
      .replace(/[^\w\-]+/g, '') // Remove all non-word chars
      .replace(/\-\-+/g, '-'); // Replace multiple - with single -
  }

  async create(dto: CreateCategoryDto, userId: string) {
    let slug = dto.slug ? this.slugify(dto.slug) : this.slugify(dto.name);

    // Check if slug exists, append timestamp if duplicate
    const existing = await this.prisma.category.findUnique({
      where: { slug },
    });
    if (existing) {
      slug = `${slug}-${Date.now()}`;
    }

    // Verify parent category if provided
    if (dto.parentCategoryId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: dto.parentCategoryId },
      });
      if (!parent) {
        throw new NotFoundException(
          `Parent category with ID '${dto.parentCategoryId}' not found.`,
        );
      }
    }

    // Create the Category
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

  async findAll(onlyActive: boolean = false, catalogueId?: string) {
    const where: any = {};
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

  async getTree(onlyActive: boolean = false) {
    const allCategories = await this.prisma.category.findMany({
      where: onlyActive ? { isActive: true } : {},
      orderBy: { sortOrder: 'asc' },
    });

    // Construct nested category tree
    const categoryMap = new Map<string, any>();
    const tree: any[] = [];

    // Initialize map
    for (const cat of allCategories) {
      categoryMap.set(cat.id, { ...cat, children: [] });
    }

    // Populate tree and children arrays
    for (const cat of allCategories) {
      const mapped = categoryMap.get(cat.id);
      if (cat.parentCategoryId && categoryMap.has(cat.parentCategoryId)) {
        categoryMap.get(cat.parentCategoryId).children.push(mapped);
      } else {
        tree.push(mapped);
      }
    }

    return tree;
  }

  async findOne(id: string) {
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
      throw new NotFoundException(`Category with ID '${id}' not found.`);
    }

    return category;
  }

  async findOneBySlug(slug: string) {
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
      throw new NotFoundException(`Category with slug '${slug}' not found.`);
    }

    return category;
  }

  async update(id: string, dto: UpdateCategoryDto, userId: string) {
    const category = await this.findOne(id);

    let slug = category.slug;
    if (dto.slug) {
      slug = this.slugify(dto.slug);
    } else if (dto.name) {
      slug = this.slugify(dto.name);
    }

    // Check slug conflict if it changed
    if (slug !== category.slug) {
      const existing = await this.prisma.category.findUnique({
        where: { slug },
      });
      if (existing) {
        throw new ConflictException(
          `Category with slug '${slug}' already exists.`,
        );
      }
    }

    // Verify parent category
    if (dto.parentCategoryId) {
      if (dto.parentCategoryId === id) {
        throw new BadRequestException('A category cannot be its own parent.');
      }
      const parent = await this.prisma.category.findUnique({
        where: { id: dto.parentCategoryId },
      });
      if (!parent) {
        throw new NotFoundException(
          `Parent category with ID '${dto.parentCategoryId}' not found.`,
        );
      }
    }

    const updatedCategory = await this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name,
        slug,
        description:
          dto.description !== undefined ? dto.description : undefined,
        parentCategoryId:
          dto.parentCategoryId !== undefined ? dto.parentCategoryId : undefined,
        imageUrl: dto.imageUrl !== undefined ? dto.imageUrl : undefined,
        bannerUrl: dto.bannerUrl !== undefined ? dto.bannerUrl : undefined,
        isActive: dto.isActive,
        sortOrder: dto.sortOrder,
        updatedBy: userId,
      },
    });

    // Cascade isActive changes to child categories and products
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

  async getAllDescendantCategoryIds(categoryId: string): Promise<string[]> {
    const result: string[] = [];
    let currentLevel = [categoryId];
    while (currentLevel.length > 0) {
      const children = await this.prisma.category.findMany({
        where: { parentCategoryId: { in: currentLevel } },
        select: { id: true },
      });
      const childIds = children.map((c) => c.id);
      if (childIds.length === 0) break;
      result.push(...childIds);
      currentLevel = childIds;
    }
    return result;
  }

  async remove(id: string) {
    await this.findOne(id);

    // Find products in this category
    const products = await this.prisma.product.findMany({
      where: { categoryId: id },
      select: { id: true },
    });
    const productIds = products.map((p) => p.id);

    if (productIds.length > 0) {
      // 1. Delete image cleaning tasks for these products
      await this.prisma.imageCleaningTask.deleteMany({
        where: { productId: { in: productIds } },
      });

      // 2. Delete product images
      await this.prisma.productImage.deleteMany({
        where: { productId: { in: productIds } },
      });

      // 3. Delete product pricing tier records
      await this.prisma.productPricing.deleteMany({
        where: { productId: { in: productIds } },
      });

      // 4. Delete cart items
      await this.prisma.cartItem.deleteMany({
        where: { productId: { in: productIds } },
      });

      // 5. Delete products
      await this.prisma.product.deleteMany({
        where: { categoryId: id },
      });
    }

    // 6. Delete subcategories if any
    await this.prisma.category.deleteMany({
      where: { parentCategoryId: id },
    });

    // 7. Delete category
    await this.prisma.category.delete({
      where: { id },
    });

    return { message: 'Category deleted successfully' };
  }
}
