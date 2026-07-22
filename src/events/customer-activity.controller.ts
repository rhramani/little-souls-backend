import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { CustomerActivityService } from './customer-activity.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserType } from '@prisma/client';

@Controller('customer-activities')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserType.SUPER_ADMIN, UserType.STAFF)
export class CustomerActivityController {
  constructor(
    private readonly activityService: CustomerActivityService,
  ) {}

  @Get()
  async getSessions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.activityService.getSessionHistory(pageNum, limitNum);
  }

  @Get(':id')
  async getSessionDetails(@Param('id') id: string) {
    const details = await this.activityService.getSessionDetails(id);
    if (!details) {
      throw new NotFoundException(`Session log '${id}' not found`);
    }
    return details;
  }
}
