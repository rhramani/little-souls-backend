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
        name: string;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        code: string;
    }>;
    findAllGroups(): Promise<({
        _count: {
            productPricing: number;
            customers: number;
        };
    } & {
        name: string;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        code: string;
    })[]>;
    findOneGroup(id: string): Promise<{
        customers: {
            businessName: string;
            id: string;
            customerCode: string | null;
        }[];
    } & {
        name: string;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        code: string;
    }>;
    updateGroup(id: string, dto: UpdatePricingGroupDto): Promise<{
        name: string;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        code: string;
    }>;
    removeGroup(id: string): Promise<{
        message: string;
    }>;
    setProductPrice(dto: SetProductPricingDto, userId: string): Promise<{
        pricingGroup: {
            name: string;
            id: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            code: string;
        };
        product: {
            name: string;
            id: string;
            sku: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        pricingGroupId: string;
        createdBy: string | null;
        updatedBy: string | null;
        price: number;
        mrp: number | null;
        discountPercent: number | null;
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
