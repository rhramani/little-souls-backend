import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CheckoutDto } from './dto/checkout.dto';
import { QueryOrderDto } from './dto/query-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateOrderItemsDto } from './dto/update-order-items.dto';
import { PosCheckoutDto } from './dto/pos-checkout.dto';
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

  @Post('pos-checkout')
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.CREATED)
  async posCheckout(
    @Body() dto: PosCheckoutDto,
    @GetUser('id') userId: string,
    @Req() req: any,
  ) {
    console.log(
      '[OrderController] posCheckout hit, user:',
      req.user,
      'userId:',
      userId,
      'headers:',
      req.headers,
    );
    return this.orderService.posCheckout(dto, userId);
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

  @Patch(':id/items')
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async updateItems(
    @Param('id') id: string,
    @Body() dto: UpdateOrderItemsDto,
    @GetUser('id') userId: string,
  ) {
    return this.orderService.updateOrderItems(id, dto, userId);
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

  @Patch(':id/deliver')
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async markDelivered(@Param('id') id: string, @GetUser('id') userId: string) {
    return this.orderService.markDelivered(id, userId);
  }

  @Post('bulk-delete')
  @Roles(UserType.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async removeMany(@Body() data: { ids: string[] }) {
    if (!data.ids || !Array.isArray(data.ids) || data.ids.length === 0) {
      return { deletedCount: 0 };
    }
    return this.orderService.removeMany(data.ids);
  }

  @Delete(':id')
  @Roles(UserType.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    return this.orderService.remove(id);
  }
}
