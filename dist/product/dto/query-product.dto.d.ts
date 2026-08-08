import { StockStatus } from '@prisma/client';
export declare class QueryProductDto {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    catalogueId?: string;
    brand?: string;
    stockStatus?: StockStatus;
    stockStatuses?: string;
    moqTiers?: string;
    isActive?: boolean;
    isFeatured?: boolean;
    hasCatalogue?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
