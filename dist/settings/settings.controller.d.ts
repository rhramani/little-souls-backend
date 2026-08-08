import * as express from 'express';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
export declare class SettingsController {
    private readonly settingsService;
    constructor(settingsService: SettingsService);
    getPublicSettings(): Promise<{
        businessName: string | null;
        businessLogoUrl: string | null;
        faviconUrl: string | null;
        contactEmail: string | null;
        contactPhone: string | null;
        companyAddress: string | null;
        whatsappOrderNumber: string | null;
        gstin: any;
        companyGstin: any;
        invoicePrefix: string | null;
        orderPrefix: string | null;
        paymentPrefix: string | null;
        taxEnabled: boolean;
        defaultTaxPercent: number | null;
    }>;
    getSettings(): Promise<{
        businessName: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        businessLogoUrl: string | null;
        faviconUrl: string | null;
        contactEmail: string | null;
        contactPhone: string | null;
        companyAddress: string | null;
        companyGstin: string | null;
        whatsappOrderNumber: string | null;
        imageCleaningProvider: string | null;
        imageCleaningApiKey: string | null;
        imageCleaningIsEnabled: boolean;
        orderPrefix: string | null;
        invoicePrefix: string | null;
        paymentPrefix: string | null;
        currency: string | null;
        taxEnabled: boolean;
        defaultTaxPercent: number | null;
        lowStockThreshold: number | null;
    }>;
    updateSettings(dto: UpdateSettingsDto): Promise<{
        businessName: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        businessLogoUrl: string | null;
        faviconUrl: string | null;
        contactEmail: string | null;
        contactPhone: string | null;
        companyAddress: string | null;
        companyGstin: string | null;
        whatsappOrderNumber: string | null;
        imageCleaningProvider: string | null;
        imageCleaningApiKey: string | null;
        imageCleaningIsEnabled: boolean;
        orderPrefix: string | null;
        invoicePrefix: string | null;
        paymentPrefix: string | null;
        currency: string | null;
        taxEnabled: boolean;
        defaultTaxPercent: number | null;
        lowStockThreshold: number | null;
    }>;
    getAuditLogs(page?: number, limit?: number): Promise<{
        logs: ({
            user: {
                name: string;
                userType: import("@prisma/client").$Enums.UserType;
                staff: {
                    designation: string | null;
                } | null;
            } | null;
        } & {
            id: string;
            createdAt: Date;
            userId: string | null;
            ipAddress: string | null;
            userAgent: string | null;
            module: string;
            action: string;
            referenceId: string | null;
            oldData: string | null;
            newData: string | null;
        })[];
        pagination: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    exportBackup(res: express.Response): Promise<void>;
    restoreBackup(file: Express.Multer.File): Promise<{
        success: boolean;
        message: string;
        timestamp: string;
    }>;
}
