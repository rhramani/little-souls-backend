import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdjustStockDto, OpeningStockDto } from './dto/adjust-stock.dto';
import { StockStatus } from '@prisma/client';

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  private getStockStatus(qty: number): StockStatus {
    if (qty === 0) return StockStatus.OUT_OF_STOCK;
    if (qty <= 5) return StockStatus.LOW_STOCK;
    return StockStatus.IN_STOCK;
  }

  async adjustStock(dto: AdjustStockDto, userId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product)
      throw new NotFoundException(`Product '${dto.productId}' not found.`);

    const stockBefore = product.stockQuantity;
    let stockAfter: number;

    if (dto.movementType === 'ADJUSTMENT_IN') {
      stockAfter = stockBefore + dto.quantity;
    } else {
      stockAfter = stockBefore - dto.quantity;
      if (stockAfter < 0) {
        throw new BadRequestException(
          `Adjustment would result in negative stock (${stockAfter}). Available: ${stockBefore}`,
        );
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

  async setOpeningStock(dto: OpeningStockDto, userId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product)
      throw new NotFoundException(`Product '${dto.productId}' not found.`);

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

  async getMovements(
    productId?: string,
    movementType?: string,
    startDate?: string,
    endDate?: string,
    page = 1,
    limit = 20,
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (productId) where.productId = productId;
    if (movementType) where.movementType = movementType;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [movements, total] = await this.prisma.$transaction([
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
}
