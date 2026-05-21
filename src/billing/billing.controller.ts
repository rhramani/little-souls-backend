import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { BillingService } from './billing.service';
import { PdfService } from './pdf.service';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { QueryBillingDto } from './dto/query-billing.dto';
import { CreateCreditDebitNoteDto } from './dto/create-credit-debit-note.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserType } from '@prisma/client';

@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly pdfService: PdfService,
  ) {}

  @Post('invoice/generate/:orderId')
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.CREATED)
  async generateInvoice(
    @Param('orderId') orderId: string,
    @GetUser('id') userId: string,
  ) {
    return this.billingService.generateInvoice(orderId, userId);
  }

  @Get('invoice')
  @HttpCode(HttpStatus.OK)
  async findAllInvoices(@Query() query: QueryBillingDto, @GetUser() user: any) {
    const customerId =
      user.userType === UserType.CUSTOMER ? user.customerId : undefined;
    return this.billingService.findAllInvoices(query, customerId);
  }

  @Get('invoice/:id')
  @HttpCode(HttpStatus.OK)
  async findOneInvoice(@Param('id') id: string, @GetUser() user: any) {
    const customerId =
      user.userType === UserType.CUSTOMER ? user.customerId : undefined;
    return this.billingService.findOneInvoice(id, customerId);
  }

  @Get('invoice/:id/pdf')
  @HttpCode(HttpStatus.OK)
  async downloadInvoicePdf(
    @Param('id') id: string,
    @GetUser() user: any,
    @Res() res: Response,
  ) {
    const customerId =
      user.userType === UserType.CUSTOMER ? user.customerId : undefined;
    const invoice = await this.billingService.findOneInvoice(id, customerId);
    const pdfBuffer = await this.pdfService.generateInvoicePdf(invoice);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  @Post('payment')
  @HttpCode(HttpStatus.CREATED)
  async recordPayment(@Body() dto: RecordPaymentDto, @GetUser() user: any) {
    // If recorded by staff/admin, verify directly. Customers submit proof of payment (pending).
    const isStaff =
      user.userType === UserType.SUPER_ADMIN ||
      user.userType === UserType.STAFF;
    return this.billingService.recordPayment(dto, user.id, isStaff);
  }

  @Get('payment')
  @HttpCode(HttpStatus.OK)
  async findAllPayments(@Query() query: QueryBillingDto, @GetUser() user: any) {
    const customerId =
      user.userType === UserType.CUSTOMER ? user.customerId : undefined;
    return this.billingService.findAllPayments(query, customerId);
  }

  @Post('ledger/credit-note')
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.CREATED)
  async createCreditNote(
    @Body() dto: CreateCreditDebitNoteDto,
    @GetUser('id') userId: string,
  ) {
    return this.billingService.createCreditNote(dto, userId);
  }

  @Post('ledger/debit-note')
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.CREATED)
  async createDebitNote(
    @Body() dto: CreateCreditDebitNoteDto,
    @GetUser('id') userId: string,
  ) {
    return this.billingService.createDebitNote(dto, userId);
  }

  @Post('payment/:id/verify')
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async verifyPayment(@Param('id') id: string, @GetUser('id') userId: string) {
    return this.billingService.verifyPayment(id, userId);
  }

  @Post('payment/:id/reject')
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async rejectPayment(@Param('id') id: string, @GetUser('id') userId: string) {
    return this.billingService.rejectPayment(id, userId);
  }

  @Get('ledger')
  @HttpCode(HttpStatus.OK)
  async findAllLedgerEntries(
    @Query() query: QueryBillingDto,
    @GetUser() user: any,
  ) {
    const customerId =
      user.userType === UserType.CUSTOMER ? user.customerId : undefined;
    return this.billingService.findAllLedgerEntries(query, customerId);
  }

  @Get('balance')
  @HttpCode(HttpStatus.OK)
  async getCustomerBalance(
    @GetUser() user: any,
    @Query('customerId') queryCustomerId?: string,
  ) {
    let customerId = user.customerId;
    if (user.userType !== UserType.CUSTOMER && queryCustomerId) {
      customerId = queryCustomerId;
    }
    return this.billingService.getCustomerBalance(customerId);
  }

  @Get('ledger/export')
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async exportLedger(
    @Query('customerId') customerId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.billingService.exportLedger(customerId);
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `Ledger_Export_${dateStr}.xlsx`;

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }
}
