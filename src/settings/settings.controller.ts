import { Controller, Get, Patch, Body, UseGuards, HttpCode, HttpStatus, Query } from '@nestjs/common';
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

  @Get('audit')
  // TODO: Re-enable Auth Guards when frontend login is fully connected
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserType.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async getAuditLogs(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.settingsService.getAuditLogs(Number(page) || 1, Number(limit) || 50);
  }
}
