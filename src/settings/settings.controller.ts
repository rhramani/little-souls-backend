import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  Res,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as express from 'express';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserType } from '@prisma/client';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('public')
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getPublicSettings() {
    return this.settingsService.getPublicSettings();
  }

  @Get()
  // TODO: Re-enable Auth Guards when frontend login is fully connected
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async getSettings() {
    return this.settingsService.getSettings();
  }

  @Patch()
  // TODO: Re-enable Auth Guards when frontend login is fully connected
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserType.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.settingsService.updateSettings(dto);
  }


  @Get('backup/export')
  // TODO: Re-enable Auth Guards when frontend login is fully connected
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserType.SUPER_ADMIN)
  async exportBackup(@Res() res: express.Response) {
    return this.settingsService.exportBackup(res);
  }

  @Post('backup/restore')
  @UseInterceptors(FileInterceptor('file'))
  // TODO: Re-enable Auth Guards when frontend login is fully connected
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserType.SUPER_ADMIN)
  async restoreBackup(@UploadedFile() file: Express.Multer.File) {
    return this.settingsService.restoreBackup(file);
  }
}
