import { StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { PricingService } from './pricing.service';
import { CreatePricingGroupDto } from './dto/create-pricing-group.dto';
import { UpdatePricingGroupDto } from './dto/update-pricing-group.dto';
import { SetProductPricingDto } from './dto/set-product-pricing.dto';
export declare class PricingController {
    private readonly pricingService;
    constructor(pricingService: PricingService);
    createGroup(dto: CreatePricingGroupDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        isActive: boolean;
        code: string;
    }>;
    findAllGroups(): Promise<({
        _count: {
            productPricing: number;
            customers: number;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        isActive: boolean;
        code: string;
    })[]>;
    findOneGroup(id: string): Promise<{
        customers: {
            id: string;
            businessName: string;
            customerCode: string | null;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        isActive: boolean;
        code: string;
    }>;
    updateGroup(id: string, dto: UpdatePricingGroupDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        isActive: boolean;
        code: string;
    }>;
    removeGroup(id: string): Promise<{
        message: string;
    }>;
    setProductPrice(dto: SetProductPricingDto, userId: string): Promise<{
        pricingGroup: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            description: string | null;
            isActive: boolean;
            code: string;
        };
        product: {
            id: string;
            name: string;
            sku: string;
        };
    } & {
        id: string;
        discountPercent: number | null;
        createdAt: Date;
        updatedAt: Date;
        createdBy: string | null;
        pricingGroupId: string;
        updatedBy: string | null;
        price: number;
        mrp: number | null;
        minQuantity: number | null;
        maxQuantity: number | null;
        productId: string;
        effectiveFrom: Date | null;
        effectiveTo: Date | null;
    }>;
    removeProductPrice(productId: string, pricingGroupId: string): Promise<{
        message: string;
    }>;
    bulkUpload(file: Express.Multer.File, userId: string): Promise<{
        total: number;
        success: number;
        skipped: number;
        errorCount: number;
        errors: {
            row: number;
            sku: string;
            reason: string;
        }[];
        tiersMatched: string[];
    } | {
        error: string;
    }>;
    downloadTemplate(catalogueId: string, res: Response): Promise<StreamableFile>;
}
