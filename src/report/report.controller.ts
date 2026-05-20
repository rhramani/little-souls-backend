import { Controller, Get, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ReportService } from './report.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserType } from '@prisma/client';

@Controller('report')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('sales')
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async getSales(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.reportService.getSalesReport(startDate, endDate);
  }

  @Get('outstanding')
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async getOutstanding() {
    return this.reportService.getOutstandingBalances();
  }

  @Get('attendance')
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async getAttendance(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.reportService.getAttendanceReport(startDate, endDate);
  }
}
