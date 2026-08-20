import { PrismaService } from '../prisma/prisma.service';
import { AdjustStockDto, OpeningStockDto } from './dto/adjust-stock.dto';
export declare class StockService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private getStockStatus;
    adjustStock(dto: AdjustStockDto, userId: string): Promise<{
        id: string;
        createdAt: Date;
        createdBy: string | null;
        referenceType: string;
        referenceId: string | null;
        productId: string;
        quantity: number;
        note: string | null;
        movementType: string;
        stockBefore: number;
        stockAfter: number;
    }>;
    setOpeningStock(dto: OpeningStockDto, userId: string): Promise<{
        id: string;
        createdAt: Date;
        createdBy: string | null;
        referenceType: string;
        referenceId: string | null;
        productId: string;
        quantity: number;
        note: string | null;
        movementType: string;
        stockBefore: number;
        stockAfter: number;
    }>;
    getMovements(productId?: string, movementType?: string, startDate?: string, endDate?: string, page?: number, limit?: number): Promise<{
        movements: ({
            product: {
                name: string;
                sku: string;
            };
        } & {
            id: string;
            createdAt: Date;
            createdBy: string | null;
            referenceType: string;
            referenceId: string | null;
            productId: string;
            quantity: number;
            note: string | null;
            movementType: string;
            stockBefore: number;
            stockAfter: number;
        })[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
}
