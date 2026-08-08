"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
let StockService = class StockService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    getStockStatus(qty) {
        if (qty === 0)
            return client_1.StockStatus.OUT_OF_STOCK;
        if (qty <= 5)
            return client_1.StockStatus.LOW_STOCK;
        return client_1.StockStatus.IN_STOCK;
    }
    async adjustStock(dto, userId) {
        const product = await this.prisma.product.findUnique({
            where: { id: dto.productId },
        });
        if (!product)
            throw new common_1.NotFoundException(`Product '${dto.productId}' not found.`);
        const stockBefore = product.stockQuantity;
        let stockAfter;
        if (dto.movementType === 'ADJUSTMENT_IN') {
            stockAfter = stockBefore + dto.quantity;
        }
        else {
            stockAfter = stockBefore - dto.quantity;
            if (stockAfter < 0) {
                throw new common_1.BadRequestException(`Adjustment would result in negative stock (${stockAfter}). Available: ${stockBefore}`);
            }
        }
        return this.prisma.$transaction(async (tx) => {
            await tx.product.update({
                where: { id: dto.productId },
                data: {
                    stockQuantity: stockAfter,
                    stockStatus: this.getStockStatus(stockAfter),
                },
            });
            return tx.stockMovement.create({
                data: {
                    productId: dto.productId,
                    movementType: dto.movementType,
                    referenceType: 'MANUAL',
                    quantity: dto.quantity,
                    stockBefore,
                    stockAfter,
                    note: dto.note || `Manual ${dto.movementType.replace('_', ' ')}`,
                    createdBy: userId,
                },
            });
        });
    }
    async setOpeningStock(dto, userId) {
        const product = await this.prisma.product.findUnique({
            where: { id: dto.productId },
        });
        if (!product)
            throw new common_1.NotFoundException(`Product '${dto.productId}' not found.`);
        const stockBefore = product.stockQuantity;
        const stockAfter = dto.quantity;
        return this.prisma.$transaction(async (tx) => {
            await tx.product.update({
                where: { id: dto.productId },
                data: {
                    stockQuantity: stockAfter,
                    stockStatus: this.getStockStatus(stockAfter),
                },
            });
            return tx.stockMovement.create({
                data: {
                    productId: dto.productId,
                    movementType: 'OPENING',
                    referenceType: 'MANUAL',
                    quantity: stockAfter,
                    stockBefore,
                    stockAfter,
                    note: dto.note || 'Opening stock set',
                    createdBy: userId,
                },
            });
        });
    }
    async getMovements(productId, movementType, startDate, endDate, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const where = {};
        if (productId)
            where.productId = productId;
        if (movementType)
            where.movementType = movementType;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate)
                where.createdAt.gte = new Date(startDate);
            if (endDate)
                where.createdAt.lte = new Date(endDate);
        }
        const [movements, total] = await Promise.all([
            this.prisma.stockMovement.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    product: { select: { sku: true, name: true } },
                },
            }),
            this.prisma.stockMovement.count({ where }),
        ]);
        return {
            movements,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    }
};
exports.StockService = StockService;
exports.StockService = StockService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], StockService);
//# sourceMappingURL=stock.service.js.map