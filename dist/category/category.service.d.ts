import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
export declare class CategoryService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private slugify;
    create(dto: CreateCategoryDto, userId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        createdBy: string | null;
        description: string | null;
        isActive: boolean;
        slug: string;
        parentCategoryId: string | null;
        imageUrl: string | null;
        bannerUrl: string | null;
        catalogueId: string | null;
        sortOrder: number | null;
        updatedBy: string | null;
    }>;
    findAll(onlyActive?: boolean, catalogueId?: string): Promise<({
        _count: {
            products: number;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        createdBy: string | null;
        description: string | null;
        isActive: boolean;
        slug: string;
        parentCategoryId: string | null;
        imageUrl: string | null;
        bannerUrl: string | null;
        catalogueId: string | null;
        sortOrder: number | null;
        updatedBy: string | null;
    })[]>;
    getTree(onlyActive?: boolean): Promise<any[]>;
    findOne(id: string): Promise<{
        parentCategory: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            createdBy: string | null;
            description: string | null;
            isActive: boolean;
            slug: string;
            parentCategoryId: string | null;
            imageUrl: string | null;
            bannerUrl: string | null;
            catalogueId: string | null;
            sortOrder: number | null;
            updatedBy: string | null;
        } | null;
        childCategories: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            createdBy: string | null;
            description: string | null;
            isActive: boolean;
            slug: string;
            parentCategoryId: string | null;
            imageUrl: string | null;
            bannerUrl: string | null;
            catalogueId: string | null;
            sortOrder: number | null;
            updatedBy: string | null;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        createdBy: string | null;
        description: string | null;
        isActive: boolean;
        slug: string;
        parentCategoryId: string | null;
        imageUrl: string | null;
        bannerUrl: string | null;
        catalogueId: string | null;
        sortOrder: number | null;
        updatedBy: string | null;
    }>;
    findOneBySlug(slug: string): Promise<{
        parentCategory: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            createdBy: string | null;
            description: string | null;
            isActive: boolean;
            slug: string;
            parentCategoryId: string | null;
            imageUrl: string | null;
            bannerUrl: string | null;
            catalogueId: string | null;
            sortOrder: number | null;
            updatedBy: string | null;
        } | null;
        childCategories: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            createdBy: string | null;
            description: string | null;
            isActive: boolean;
            slug: string;
            parentCategoryId: string | null;
            imageUrl: string | null;
            bannerUrl: string | null;
            catalogueId: string | null;
            sortOrder: number | null;
            updatedBy: string | null;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        createdBy: string | null;
        description: string | null;
        isActive: boolean;
        slug: string;
        parentCategoryId: string | null;
        imageUrl: string | null;
        bannerUrl: string | null;
        catalogueId: string | null;
        sortOrder: number | null;
        updatedBy: string | null;
    }>;
    update(id: string, dto: UpdateCategoryDto, userId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        createdBy: string | null;
        description: string | null;
        isActive: boolean;
        slug: string;
        parentCategoryId: string | null;
        imageUrl: string | null;
        bannerUrl: string | null;
        catalogueId: string | null;
        sortOrder: number | null;
        updatedBy: string | null;
    }>;
    getAllDescendantCategoryIds(categoryId: string): Promise<string[]>;
    remove(id: string): Promise<{
        message: string;
    }>;
}
