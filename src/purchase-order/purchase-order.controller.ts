import { Controller, Get, Post, Put, Patch, Body, Param, UseGuards, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { PurchaseOrderService } from './purchase-order.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserType } from '@prisma/client';

@Controller('purchase-order')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserType.SUPER_ADMIN, UserType.STAFF)
export class PurchaseOrderController {
  constructor(private readonly poService: PurchaseOrderService) {}

  // ================= SUPPLIER ROUTES =================

  @Post('supplier')
  @HttpCode(HttpStatus.CREATED)
  async createSupplier(@Body() dto: CreateSupplierDto) {
    return this.poService.createSupplier(dto);
  }

  @Get('supplier')
  @HttpCode(HttpStatus.OK)
  async findAllSuppliers() {
    return this.poService.findAllSuppliers();
  }

  @Get('supplier/:id')
  @HttpCode(HttpStatus.OK)
  async findOneSupplier(@Param('id') id: string) {
    return this.poService.findOneSupplier(id);
  }

  @Put('supplier/:id')
  @HttpCode(HttpStatus.OK)
  async updateSupplier(@Param('id') id: string, @Body() dto: CreateSupplierDto) {
    return this.poService.updateSupplier(id, dto);
  }

  // ================= PURCHASE ORDER ROUTES =================

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createPurchaseOrder(@Body() dto: CreatePurchaseOrderDto, @GetUser('id') userId: string) {
    return this.poService.createPurchaseOrder(dto, userId);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAllPOs(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.poService.findAllPOs(page ? Number(page) : 1, limit ? Number(limit) : 10);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOnePO(@Param('id') id: string) {
    return this.poService.findOnePO(id);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  async transitionStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @GetUser('id') userId: string,
  ) {
    return this.poService.transitionStatus(id, status, userId);
  }
}
