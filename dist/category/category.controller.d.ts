import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
export declare class CategoryController {
    private readonly categoryService;
    constructor(categoryService: CategoryService);
    create(createCategoryDto: CreateCategoryDto, userId: string): Promise<{
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
    findAll(onlyActive?: string, catalogueId?: string): Promise<({
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
    update(id: string, updateCategoryDto: UpdateCategoryDto, userId: string): Promise<{
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
