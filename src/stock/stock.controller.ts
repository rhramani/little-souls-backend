import { Controller, Get, Post, Body, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { StockService } from './stock.service';
import { AdjustStockDto, OpeningStockDto } from './dto/adjust-stock.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserType } from '@prisma/client';

@Controller('stock')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserType.SUPER_ADMIN, UserType.STAFF)
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Post('adjust')
  @HttpCode(HttpStatus.OK)
  async adjust(@Body() dto: AdjustStockDto, @GetUser('id') userId: string) {
    return this.stockService.adjustStock(dto, userId);
  }

  @Post('opening')
  @Roles(UserType.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async setOpening(@Body() dto: OpeningStockDto, @GetUser('id') userId: string) {
    return this.stockService.setOpeningStock(dto, userId);
  }

  @Get('movements')
  @HttpCode(HttpStatus.OK)
  async getMovements(
    @Query('productId') productId?: string,
    @Query('movementType') movementType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.stockService.getMovements(
      productId,
      movementType,
      startDate,
      endDate,
      Number(page) || 1,
      Number(limit) || 20,
    );
  }
}
