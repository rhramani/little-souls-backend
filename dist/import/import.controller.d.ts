import type { Response } from 'express';
import { ImportService } from './import.service';
import { StartImportDto } from './dto/start-import.dto';
export declare class ImportController {
    private readonly importService;
    constructor(importService: ImportService);
    startImport(dto: StartImportDto, userId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        fileUrl: string;
        importType: string;
        totalRows: number | null;
        successRows: number | null;
        failedRows: number | null;
        errorFileUrl: string | null;
        uploadedBy: string;
    }>;
    exportCatalog(res: Response): Promise<void>;
    findAll(user: any): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        fileUrl: string;
        importType: string;
        totalRows: number | null;
        successRows: number | null;
        failedRows: number | null;
        errorFileUrl: string | null;
        uploadedBy: string;
    }[]>;
    findOne(id: string): Promise<{
        rows: {
            id: string;
            createdAt: Date;
            status: string;
            sku: string | null;
            rowNumber: number;
            errorMessage: string | null;
            rawData: string | null;
            catalogImportId: string;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        fileUrl: string;
        importType: string;
        totalRows: number | null;
        successRows: number | null;
        failedRows: number | null;
        errorFileUrl: string | null;
        uploadedBy: string;
    }>;
}
