import { PrismaService } from '../prisma/prisma.service';
import { StartImportDto } from './dto/start-import.dto';
export declare class ImportService {
    private readonly prisma;
    constructor(prisma: PrismaService);
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
    processImport(importId: string, importType: string, rows: any[], userId: string): Promise<void>;
    findAll(uploadedBy?: string): Promise<{
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
    private slugify;
    private normalizeProductTax;
    private serializeSizesForExcel;
    private serializeColorsForExcel;
    private serializeSingleColorForExcel;
    private parseSizesFromExcel;
    private parseColorsFromExcel;
    exportCatalog(): Promise<Buffer>;
}
