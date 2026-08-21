import { StockStatus } from '@prisma/client';
declare class ProductImageDto {
    originalUrl: string;
    altText?: string;
    sortOrder?: number;
    isPrimary?: boolean;
}
declare class ProductPricingDto {
    pricingGroupId: string;
    price: string;
    mrp?: string;
    discountPercent?: string;
    minQuantity?: number;
    maxQuantity?: number;
}
export declare class CreateProductDto {
    sku: string;
    name: string;
    slug?: string;
    shortDescription?: string;
    description?: string;
    categoryId?: string;
    catalogueId?: string;
    moq?: number;
    fixQty?: number;
    barcode?: string;
    brand?: string;
    size?: string;
    color?: string;
    material?: string;
    unit?: string;
    hsnCode?: string;
    weight?: number;
    taxPercent?: number;
    stockQuantity?: number;
    stockStatus?: StockStatus;
    allowBackorder?: boolean;
    expectedRestockDate?: string;
    tags?: string;
    productImage?: string;
    productPictureUrl?: string;
    productPrice?: number;
    discountedPrice?: number;
    taxType?: string;
    parentProductSku?: string;
    parentProductId?: string;
    privateNotes?: string;
    setName?: string;
    setQuantity?: number;
    setType?: string;
    sizes?: string;
    sizesSetQuantity?: number;
    colors?: string;
    colorsSetQuantity?: number;
    isActive?: boolean;
    isFeatured?: boolean;
    sortOrder?: number;
    images?: ProductImageDto[];
    pricing?: ProductPricingDto[];
}
export {};
