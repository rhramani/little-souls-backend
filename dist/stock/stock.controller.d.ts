import { StockService } from './stock.service';
import { AdjustStockDto, OpeningStockDto } from './dto/adjust-stock.dto';
export declare class StockController {
    private readonly stockService;
    constructor(stockService: StockService);
    adjust(dto: AdjustStockDto, userId: string): Promise<{
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
    setOpening(dto: OpeningStockDto, userId: string): Promise<{
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
