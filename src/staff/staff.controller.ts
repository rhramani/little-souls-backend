import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { StaffService } from './staff.service';
import { AssignCustomerDto } from './dto/assign-customer.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserType } from '@prisma/client';

@Controller('staff')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post('assign-customer')
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async assignCustomer(@Body() dto: AssignCustomerDto) {
    return this.staffService.assignCustomer(dto);
  }

  @Get('performance')
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async getMyPerformance(@GetUser('id') userId: string) {
    return this.staffService.getStaffPerformance(userId);
  }

  @Get('performance/:id')
  @Roles(UserType.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async getStaffPerformance(@Param('id') staffId: string) {
    return this.staffService.getStaffPerformance(staffId);
  }

  @Get('leaderboard')
  @Roles(UserType.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async getStaffLeaderboard() {
    return this.staffService.getStaffLeaderboard();
  }

  @Get('my-customers')
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async getMyCustomers(@GetUser('id') userId: string) {
    return this.staffService.findAssignedCustomers(userId);
  }

  @Post('attendance/check-in')
  @Roles(UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async checkIn(@GetUser('id') userId: string, @Body('note') note?: string) {
    return this.staffService.checkInAttendance(userId, note);
  }

  @Post('attendance/check-out')
  @Roles(UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async checkOut(@GetUser('id') userId: string) {
    return this.staffService.checkOutAttendance(userId);
  }

  @Post('payroll/calculate/:staffId')
  @Roles(UserType.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async calculatePayroll(
    @Param('staffId') staffId: string,
    @Body('month') month: number,
    @Body('year') year: number,
    @GetUser('id') userId: string,
  ) {
    return this.staffService.calculatePayroll(staffId, month, year, userId);
  }
}
