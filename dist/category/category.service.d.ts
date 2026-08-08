import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
export declare class CategoryService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private slugify;
    create(dto: CreateCategoryDto, userId: string): Promise<{
        name: string;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        slug: string;
        parentCategoryId: string | null;
        imageUrl: string | null;
        bannerUrl: string | null;
        catalogueId: string | null;
        sortOrder: number | null;
        createdBy: string | null;
        updatedBy: string | null;
    }>;
    findAll(onlyActive?: boolean, catalogueId?: string): Promise<({
        _count: {
            products: number;
        };
    } & {
        name: string;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        slug: string;
        parentCategoryId: string | null;
        imageUrl: string | null;
        bannerUrl: string | null;
        catalogueId: string | null;
        sortOrder: number | null;
        createdBy: string | null;
        updatedBy: string | null;
    })[]>;
    getTree(onlyActive?: boolean): Promise<any[]>;
    findOne(id: string): Promise<{
        parentCategory: {
            name: string;
            id: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            slug: string;
            parentCategoryId: string | null;
            imageUrl: string | null;
            bannerUrl: string | null;
            catalogueId: string | null;
            sortOrder: number | null;
            createdBy: string | null;
            updatedBy: string | null;
        } | null;
        childCategories: {
            name: string;
            id: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            slug: string;
            parentCategoryId: string | null;
            imageUrl: string | null;
            bannerUrl: string | null;
            catalogueId: string | null;
            sortOrder: number | null;
            createdBy: string | null;
            updatedBy: string | null;
        }[];
    } & {
        name: string;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        slug: string;
        parentCategoryId: string | null;
        imageUrl: string | null;
        bannerUrl: string | null;
        catalogueId: string | null;
        sortOrder: number | null;
        createdBy: string | null;
        updatedBy: string | null;
    }>;
    findOneBySlug(slug: string): Promise<{
        parentCategory: {
            name: string;
            id: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            slug: string;
            parentCategoryId: string | null;
            imageUrl: string | null;
            bannerUrl: string | null;
            catalogueId: string | null;
            sortOrder: number | null;
            createdBy: string | null;
            updatedBy: string | null;
        } | null;
        childCategories: {
            name: string;
            id: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            slug: string;
            parentCategoryId: string | null;
            imageUrl: string | null;
            bannerUrl: string | null;
            catalogueId: string | null;
            sortOrder: number | null;
            createdBy: string | null;
            updatedBy: string | null;
        }[];
    } & {
        name: string;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        slug: string;
        parentCategoryId: string | null;
        imageUrl: string | null;
        bannerUrl: string | null;
        catalogueId: string | null;
        sortOrder: number | null;
        createdBy: string | null;
        updatedBy: string | null;
    }>;
    update(id: string, dto: UpdateCategoryDto, userId: string): Promise<{
        name: string;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        slug: string;
        parentCategoryId: string | null;
        imageUrl: string | null;
        bannerUrl: string | null;
        catalogueId: string | null;
        sortOrder: number | null;
        createdBy: string | null;
        updatedBy: string | null;
    }>;
    remove(id: string): Promise<{
        message: string;
    }>;
}
