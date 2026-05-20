import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getCart(
    @GetUser('customerId') customerId: string,
    @GetUser('contactId') contactId?: string,
  ) {
    return this.cartService.getOrCreateCart(customerId, contactId);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async addToCart(
    @GetUser('customerId') customerId: string,
    @GetUser('contactId') contactId: string,
    @Body() dto: AddToCartDto,
  ) {
    return this.cartService.addToCart(customerId, contactId, dto);
  }

  @Patch('item/:id')
  @HttpCode(HttpStatus.OK)
  async updateItemQuantity(
    @GetUser('customerId') customerId: string,
    @GetUser('contactId') contactId: string,
    @Param('id') cartItemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItemQuantity(
      customerId,
      contactId,
      cartItemId,
      dto,
    );
  }

  @Delete('item/:id')
  @HttpCode(HttpStatus.OK)
  async removeItem(
    @GetUser('customerId') customerId: string,
    @GetUser('contactId') contactId: string,
    @Param('id') cartItemId: string,
  ) {
    return this.cartService.removeItem(customerId, contactId, cartItemId);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  async clearCart(
    @GetUser('customerId') customerId: string,
    @GetUser('contactId') contactId: string,
  ) {
    return this.cartService.clearCart(customerId, contactId);
  }
}
