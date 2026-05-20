import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CheckoutDto } from './dto/checkout.dto';
import { QueryOrderDto } from './dto/query-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { CreatePackingSlipDto } from './dto/create-packing-slip.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserType } from '@prisma/client';

@Controller('order')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post('checkout')
  @Roles(UserType.CUSTOMER)
  @HttpCode(HttpStatus.CREATED)
  async checkout(
    @GetUser('customerId') customerId: string,
    @GetUser('contactId') contactId: string,
    @Body() dto: CheckoutDto,
  ) {
    return this.orderService.checkout(customerId, contactId, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query: QueryOrderDto, @GetUser() user: any) {
    // If B2B customer, restrict them to their own orders. Staff can view all.
    const customerId =
      user.userType === UserType.CUSTOMER ? user.customerId : undefined;
    return this.orderService.findAll(query, customerId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') id: string, @GetUser() user: any) {
    const customerId =
      user.userType === UserType.CUSTOMER ? user.customerId : undefined;
    return this.orderService.findOne(id, customerId);
  }

  @Patch(':id/status')
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @GetUser('id') userId: string,
  ) {
    return this.orderService.updateStatus(id, dto.status, userId);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
    @GetUser('id') userId: string,
    @GetUser() user: any,
  ) {
    const customerId =
      user.userType === UserType.CUSTOMER ? user.customerId : undefined;
    return this.orderService.cancel(id, dto.reason, userId, customerId);
  }

  @Patch(':id/backorder/approve')
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async approveBackorder(
    @Param('id') id: string,
    @GetUser('id') userId: string,
  ) {
    return this.orderService.approveBackorder(id, userId);
  }

  @Post(':id/pack')
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.CREATED)
  async packOrder(
    @Param('id') id: string,
    @Body() dto: CreatePackingSlipDto,
    @GetUser('id') userId: string,
  ) {
    return this.orderService.createPackingSlip(id, dto.notes, userId);
  }

  @Post(':id/ship')
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.CREATED)
  async shipOrder(
    @Param('id') id: string,
    @Body() dto: CreateShipmentDto,
    @GetUser('id') userId: string,
  ) {
    return this.orderService.createShipment(id, dto, userId);
  }
}
