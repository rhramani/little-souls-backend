import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
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
    const slug = dto.slug ? this.slugify(dto.slug) : this.slugify(dto.name);

    // 1. Check if slug exists
    const existing = await this.prisma.category.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new ConflictException(`Category with slug '${slug}' already exists.`);
    }

    // 2. If parent category exists, verify it
    if (dto.parentCategoryId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: dto.parentCategoryId },
      });
      if (!parent) {
        throw new NotFoundException(`Parent category with ID '${dto.parentCategoryId}' not found.`);
      }
    }

    // 3. Create the Category
    return this.prisma.category.create({
      data: {
        name: dto.name,
        slug,
        parentCategoryId: dto.parentCategoryId || null,
        imageUrl: dto.imageUrl,
        bannerUrl: dto.bannerUrl,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        sortOrder: dto.sortOrder || 0,
        createdBy: userId,
      },
    });
  }

  async findAll(onlyActive: boolean = false) {
    const categories = await this.prisma.category.findMany({
      where: onlyActive ? { isActive: true } : {},
      orderBy: { sortOrder: 'asc' },
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
        throw new ConflictException(`Category with slug '${slug}' already exists.`);
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
        throw new NotFoundException(`Parent category with ID '${dto.parentCategoryId}' not found.`);
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name,
        slug,
        parentCategoryId: dto.parentCategoryId !== undefined ? dto.parentCategoryId : undefined,
        imageUrl: dto.imageUrl,
        bannerUrl: dto.bannerUrl,
        isActive: dto.isActive,
        sortOrder: dto.sortOrder,
        updatedBy: userId,
      },
    });
  }

  async remove(id: string) {
    const category = await this.findOne(id);

    // 1. Check if it has child categories
    const childrenCount = await this.prisma.category.count({
      where: { parentCategoryId: id },
    });
    if (childrenCount > 0) {
      throw new BadRequestException('Cannot delete category with active subcategories.');
    }

    // 2. Check if it has associated products
    const productsCount = await this.prisma.product.count({
      where: { categoryId: id },
    });
    if (productsCount > 0) {
      throw new BadRequestException('Cannot delete category that contains active products.');
    }

    // 3. Delete category
    await this.prisma.category.delete({
      where: { id },
    });

    return { message: 'Category deleted successfully' };
  }
}
