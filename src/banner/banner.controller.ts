import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BannerService } from './banner.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { UserType } from '@prisma/client';

@Controller('banner')
export class BannerController {
  constructor(private readonly bannerService: BannerService) {}

  @Post()
  // TODO: Re-enable Auth Guards when frontend login is fully connected
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateBannerDto) {
    return this.bannerService.create(dto);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query('type') bannerType?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.bannerService.findAll(bannerType, activeOnly === 'true');
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') id: string) {
    return this.bannerService.findOne(id);
  }

  @Patch(':id')
  // TODO: Re-enable Auth Guards when frontend login is fully connected
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async update(@Param('id') id: string, @Body() dto: Partial<CreateBannerDto>) {
    return this.bannerService.update(id, dto);
  }

  @Delete(':id')
  // TODO: Re-enable Auth Guards when frontend login is fully connected
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserType.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    return this.bannerService.remove(id);
  }
}
