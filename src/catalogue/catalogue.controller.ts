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
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CatalogueService } from './catalogue.service';
import { WhatsappService } from '../notification/whatsapp.service';
import { CreateCatalogueDto } from './dto/create-catalogue.dto';
import { UpdateCatalogueDto } from './dto/update-catalogue.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserType } from '@prisma/client';

@Controller('catalogues')
export class CatalogueController {
  constructor(
    private readonly catalogueService: CatalogueService,
    private readonly whatsappService: WhatsappService,
  ) {}

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
  @HttpCode(HttpStatus.OK)
  async findAll(@Query('search') search?: string) {
    return this.catalogueService.findAll(search);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(
    @Param('id') id: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.catalogueService.findOne(id, search, page ? parseInt(page, 10) : undefined, limit ? parseInt(limit, 10) : undefined);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async update(@Param('id') id: string, @Body() body: UpdateCatalogueDto) {
    return this.catalogueService.update(id, body);
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

  @Post(':id/share-images-meta')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async shareImagesMeta(
    @Param('id') id: string,
    @Body() body: { phone: string; images: string[] },
  ) {
    if (!body.phone) {
      throw new BadRequestException('Phone number is required.');
    }
    if (!body.images || body.images.length === 0) {
      throw new BadRequestException('Images array is required.');
    }

    // Send each image to the specified phone number via Meta API
    for (const [index, imageUrl] of body.images.entries()) {
      try {
        await this.whatsappService.sendImage(body.phone, imageUrl);
      } catch (error) {
        // We log the error in the service, but if one fails we might want to continue or throw
        // For now, let's continue attempting to send the rest.
      }
    }

    return { success: true, message: `Images sent to ${body.phone}` };
  }
}
