import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CatalogueService } from './catalogue.service';
import { CreateCatalogueDto } from './dto/create-catalogue.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserType } from '@prisma/client';

@Controller('catalogues')
export class CatalogueController {
  constructor(private readonly catalogueService: CatalogueService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateCatalogueDto,
    @GetUser('id') userId: string,
  ) {
    return this.catalogueService.create(dto, userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async findAll() {
    return this.catalogueService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') id: string) {
    return this.catalogueService.findOne(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    return this.catalogueService.remove(id);
  }

  @Get(':id/export')
  @HttpCode(HttpStatus.OK)
  async exportCatalogue(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const buffer = await this.catalogueService.exportCatalogue(id);
    
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="catalogue-products-${id}-${Date.now()}.xlsx"`,
      'Content-Length': buffer.length,
    });
    
    res.end(buffer);
  }

  @Post(':id/upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  async uploadCatalogue(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @GetUser('id') userId: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded.');
    }

    const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
    if (fileExtension !== 'xlsx') {
      throw new BadRequestException('Invalid file format. Only .xlsx files are allowed.');
    }

    return this.catalogueService.importCatalogue(id, file.buffer, userId);
  }
}
