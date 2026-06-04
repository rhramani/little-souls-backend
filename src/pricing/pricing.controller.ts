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
  UseInterceptors,
  UploadedFile,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { PricingService } from './pricing.service';
import { CreatePricingGroupDto } from './dto/create-pricing-group.dto';
import { UpdatePricingGroupDto } from './dto/update-pricing-group.dto';
import { SetProductPricingDto } from './dto/set-product-pricing.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserType } from '@prisma/client';

@Controller('pricing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Post('group')
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.CREATED)
  async createGroup(@Body() dto: CreatePricingGroupDto) {
    return this.pricingService.createGroup(dto);
  }

  @Get('group')
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async findAllGroups() {
    return this.pricingService.findAllGroups();
  }

  @Get('group/:id')
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async findOneGroup(@Param('id') id: string) {
    return this.pricingService.findOneGroup(id);
  }

  @Patch('group/:id')
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async updateGroup(
    @Param('id') id: string,
    @Body() dto: UpdatePricingGroupDto,
  ) {
    return this.pricingService.updateGroup(id, dto);
  }

  @Delete('group/:id')
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async removeGroup(@Param('id') id: string) {
    return this.pricingService.removeGroup(id);
  }

  @Post('setup')
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async setProductPrice(
    @Body() dto: SetProductPricingDto,
    @GetUser('id') userId: string,
  ) {
    return this.pricingService.setProductPrice(dto, userId);
  }

  @Delete('price/:productId/:pricingGroupId')
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async removeProductPrice(
    @Param('productId') productId: string,
    @Param('pricingGroupId') pricingGroupId: string,
  ) {
    return this.pricingService.removeProductPrice(productId, pricingGroupId);
  }

  @Post('bulk-upload')
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  async bulkUpload(
    @UploadedFile() file: Express.Multer.File,
    @GetUser('id') userId: string,
  ) {
    if (!file) {
      return { error: 'No file uploaded' };
    }
    return this.pricingService.bulkUploadPricing(file.buffer, userId);
  }

  @Get('template')
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  async downloadTemplate(@Res({ passthrough: true }) res: Response) {
    const buffer = await this.pricingService.generateTemplate();
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':
        'attachment; filename="pricing_template.xlsx"',
    });
    return new StreamableFile(Buffer.from(buffer as ArrayBuffer));
  }
}
