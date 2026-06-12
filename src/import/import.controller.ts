import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ImportService } from './import.service';
import { StartImportDto } from './dto/start-import.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserType } from '@prisma/client';

@Controller('import')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserType.SUPER_ADMIN, UserType.STAFF)
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async startImport(
    @Body() dto: StartImportDto,
    @GetUser('id') userId: string,
  ) {
    return this.importService.startImport(dto, userId);
  }

  @Get('export')
  @HttpCode(HttpStatus.OK)
  async exportCatalog(@Res() res: Response) {
    const buffer = await this.importService.exportCatalog();

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="little-souls-catalog-${Date.now()}.xlsx"`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(@GetUser() user: any) {
    // Super admins see all imports, staff see their own uploads
    const uploaderId =
      user.userType === UserType.SUPER_ADMIN ? undefined : user.id;
    return this.importService.findAll(uploaderId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') id: string) {
    return this.importService.findOne(id);
  }
}
