import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { AddProductVideoDto } from './dto/add-product-video.dto';
import { AddProductCatalogDto } from './dto/add-product-catalog.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserType } from '@prisma/client';

@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createProductDto: CreateProductDto,
    @GetUser('id') userId: string,
  ) {
    return this.productService.create(createProductDto, userId);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query: QueryProductDto, @GetUser() user?: any) {
    const pricingGroupId = user?.customer?.pricingGroupId;
    return this.productService.findAll(query, pricingGroupId);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') id: string, @GetUser() user?: any) {
    const pricingGroupId = user?.customer?.pricingGroupId;
    return this.productService.findOne(id, pricingGroupId);
  }

  @Get('slug/:slug')
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async findOneBySlug(@Param('slug') slug: string, @GetUser() user?: any) {
    const pricingGroupId = user?.customer?.pricingGroupId;
    return this.productService.findOneBySlug(slug, pricingGroupId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @GetUser('id') userId: string,
  ) {
    return this.productService.update(id, updateProductDto, userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    return this.productService.remove(id);
  }

  @Post(':id/video')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.CREATED)
  async addVideo(
    @Param('id') id: string,
    @Body() dto: AddProductVideoDto,
    @GetUser('id') userId: string,
  ) {
    return this.productService.addVideo(id, dto, userId);
  }

  @Post(':id/catalog')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.CREATED)
  async addCatalog(
    @Param('id') id: string,
    @Body() dto: AddProductCatalogDto,
    @GetUser('id') userId: string,
  ) {
    return this.productService.addCatalog(id, dto, userId);
  }

  @Delete(':id/image/:imageId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async deleteImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ) {
    return this.productService.deleteImage(id, imageId);
  }

  @Patch(':id/image/:imageId/primary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async setPrimaryImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ) {
    return this.productService.setPrimaryImage(id, imageId);
  }
}

