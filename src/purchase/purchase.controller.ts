import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PurchaseService } from './purchase.service';
import {
  CreateSupplierDto,
  UpdateSupplierDto,
  CreatePurchasedProductDto,
  UpdatePurchasedProductDto,
  CreatePurchaseInvoiceDto,
  CreateSupplierPaymentDto,
  UpdateSupplierPaymentDto,
} from './dto/purchase.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserType } from '@prisma/client';

@Controller('purchase')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserType.SUPER_ADMIN, UserType.STAFF)
export class PurchaseController {
  constructor(private readonly purchaseService: PurchaseService) {}

  // =========================================================================
  // SUPPLIER ENDPOINTS
  // =========================================================================

  @Get('suppliers')
  @HttpCode(HttpStatus.OK)
  async findAllSuppliers() {
    return this.purchaseService.findAllSuppliers();
  }

  @Get('suppliers/:id')
  @HttpCode(HttpStatus.OK)
  async findOneSupplier(@Param('id') id: string) {
    return this.purchaseService.findOneSupplier(id);
  }

  @Post('suppliers')
  @HttpCode(HttpStatus.CREATED)
  async createSupplier(@Body() dto: CreateSupplierDto) {
    return this.purchaseService.createSupplier(dto);
  }

  @Patch('suppliers/:id')
  @HttpCode(HttpStatus.OK)
  async updateSupplier(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.purchaseService.updateSupplier(id, dto);
  }

  @Delete('suppliers/:id')
  @HttpCode(HttpStatus.OK)
  async removeSupplier(@Param('id') id: string) {
    return this.purchaseService.removeSupplier(id);
  }

  // =========================================================================
  // PURCHASED PRODUCT ENDPOINTS
  // =========================================================================

  @Get('products')
  @HttpCode(HttpStatus.OK)
  async findAllPurchasedProducts() {
    return this.purchaseService.findAllPurchasedProducts();
  }

  @Get('products/:id')
  @HttpCode(HttpStatus.OK)
  async findOnePurchasedProduct(@Param('id') id: string) {
    return this.purchaseService.findOnePurchasedProduct(id);
  }

  @Post('products')
  @HttpCode(HttpStatus.CREATED)
  async createPurchasedProduct(@Body() dto: CreatePurchasedProductDto) {
    return this.purchaseService.createPurchasedProduct(dto);
  }

  @Patch('products/:id')
  @HttpCode(HttpStatus.OK)
  async updatePurchasedProduct(
    @Param('id') id: string,
    @Body() dto: UpdatePurchasedProductDto,
  ) {
    return this.purchaseService.updatePurchasedProduct(id, dto);
  }

  @Delete('products/:id')
  @HttpCode(HttpStatus.OK)
  async removePurchasedProduct(@Param('id') id: string) {
    return this.purchaseService.removePurchasedProduct(id);
  }

  // =========================================================================
  // PURCHASE INVOICE ENDPOINTS
  // =========================================================================

  @Get('invoices')
  @HttpCode(HttpStatus.OK)
  async findAllPurchaseInvoices() {
    return this.purchaseService.findAllPurchaseInvoices();
  }

  @Post('invoices')
  @HttpCode(HttpStatus.CREATED)
  async createPurchaseInvoice(@Body() dto: CreatePurchaseInvoiceDto) {
    return this.purchaseService.createPurchaseInvoice(dto);
  }

  @Patch('invoices/:id')
  @HttpCode(HttpStatus.OK)
  async updatePurchaseInvoice(
    @Param('id') id: string,
    @Body() dto: CreatePurchaseInvoiceDto,
  ) {
    return this.purchaseService.updatePurchaseInvoice(id, dto);
  }

  @Delete('invoices/:id')
  @HttpCode(HttpStatus.OK)
  async removePurchaseInvoice(@Param('id') id: string) {
    return this.purchaseService.removePurchaseInvoice(id);
  }

  // =========================================================================
  // SUPPLIER PAYMENT ENDPOINTS
  // =========================================================================

  @Get('payments')
  @HttpCode(HttpStatus.OK)
  async findAllSupplierPayments() {
    return this.purchaseService.findAllSupplierPayments();
  }

  @Post('payments')
  @HttpCode(HttpStatus.CREATED)
  async createSupplierPayment(@Body() dto: CreateSupplierPaymentDto) {
    return this.purchaseService.createSupplierPayment(dto);
  }

  @Patch('payments/:id')
  @HttpCode(HttpStatus.OK)
  async updateSupplierPayment(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierPaymentDto,
  ) {
    return this.purchaseService.updateSupplierPayment(id, dto);
  }

  @Delete('payments/:id')
  @HttpCode(HttpStatus.OK)
  async removeSupplierPayment(@Param('id') id: string) {
    return this.purchaseService.removeSupplierPayment(id);
  }
}
