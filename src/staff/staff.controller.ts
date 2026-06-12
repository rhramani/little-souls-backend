import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Delete,
} from '@nestjs/common';
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { AssignCustomerDto } from './dto/assign-customer.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserType } from '@prisma/client';

@Controller('staff')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  // =============== ROLES & PERMISSIONS ===============

  @Get('roles')
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async getRoles() {
    return this.staffService.getRoles();
  }

  @Patch('roles/:id/permissions')
  @Roles(UserType.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async updateRolePermissions(
    @Param('id') roleId: string,
    @Body('permissions')
    permissions: { module: string; action: string; enabled: boolean }[],
  ) {
    return this.staffService.updateRolePermissions(roleId, permissions);
  }

  @Post('roles')
  @Roles(UserType.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createRole(@Body() data: { name: string; description?: string }) {
    return this.staffService.createRole(data);
  }

  @Patch('roles/:id')
  @Roles(UserType.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async updateRole(
    @Param('id') roleId: string,
    @Body() data: { name?: string; description?: string },
  ) {
    return this.staffService.updateRole(roleId, data);
  }

  @Delete('roles/:id')
  @Roles(UserType.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async deleteRole(@Param('id') roleId: string) {
    return this.staffService.deleteRole(roleId);
  }

  // =============== STAFF PROFILES ===============

  @Post()
  @Roles(UserType.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createStaff(@Body() dto: CreateStaffDto) {
    return this.staffService.createStaff(dto);
  }

  @Get()
  @Roles(UserType.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async findAll(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.staffService.findAllStaff(
      Number(page) || 1,
      Number(limit) || 20,
    );
  }

  @Get('profile/:staffId')
  @Roles(UserType.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async findOneStaff(@Param('staffId') staffId: string) {
    return this.staffService.findOneStaff(staffId);
  }

  @Patch('profile/:staffId')
  @Roles(UserType.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async updateStaff(
    @Param('staffId') staffId: string,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.staffService.updateStaff(staffId, dto);
  }

  @Patch('profile/:staffId/deactivate')
  @Roles(UserType.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async deactivateStaff(@Param('staffId') staffId: string) {
    return this.staffService.deactivateStaff(staffId);
  }

  @Patch('profile/:staffId/activate')
  @Roles(UserType.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async activateStaff(@Param('staffId') staffId: string) {
    return this.staffService.activateStaff(staffId);
  }

  @Delete('profile/:staffId')
  @Roles(UserType.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async deleteStaff(@Param('staffId') staffId: string) {
    return this.staffService.deleteStaff(staffId);
  }

  // =============== CUSTOMER ASSIGNMENT ===============

  @Post('assign-customer')
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async assignCustomer(@Body() dto: AssignCustomerDto) {
    return this.staffService.assignCustomer(dto);
  }

  @Get('my-customers')
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async getMyCustomers(@GetUser('id') userId: string) {
    return this.staffService.findAssignedCustomers(userId);
  }

  // =============== PERFORMANCE ===============

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
  async getLeaderboard() {
    return this.staffService.getStaffLeaderboard();
  }

  // =============== ATTENDANCE ===============

  @Get('attendance')
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async getAttendance(
    @GetUser() user: any,
    @Query('staffId') staffId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    // Staff can only see their own; super_admin can filter by any staffId
    const resolvedStaffId =
      user.userType === UserType.STAFF ? user.staffId : staffId;
    return this.staffService.getAttendanceHistory(
      resolvedStaffId,
      startDate,
      endDate,
      Number(page) || 1,
      Number(limit) || 30,
    );
  }

  @Post('attendance/mark')
  @Roles(UserType.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async markAttendance(
    @Body() dto: MarkAttendanceDto,
    @GetUser('id') userId: string,
  ) {
    return this.staffService.markAttendanceAdmin(dto, userId);
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

  // =============== LEAVE ===============

  @Post('leave/request')
  @Roles(UserType.STAFF, UserType.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createLeave(
    @Body() dto: CreateLeaveRequestDto,
    @GetUser('id') userId: string,
  ) {
    return this.staffService.createLeaveRequest(dto, userId);
  }

  @Get('leave')
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async getLeaveRequests(
    @GetUser() user: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.staffService.getLeaveRequests(
      user.id,
      user.userType,
      Number(page) || 1,
      Number(limit) || 20,
    );
  }

  @Patch('leave/:id/approve')
  @Roles(UserType.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async approveLeave(@Param('id') id: string, @GetUser('id') userId: string) {
    return this.staffService.approveLeave(id, userId);
  }

  @Patch('leave/:id/reject')
  @Roles(UserType.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async rejectLeave(@Param('id') id: string, @GetUser('id') userId: string) {
    return this.staffService.rejectLeave(id, userId);
  }

  // =============== PAYROLL ===============

  @Get('payroll')
  @Roles(UserType.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async getPayrolls(
    @Query('staffId') staffId?: string,
    @Query('month') month?: number,
    @Query('year') year?: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.staffService.getPayrolls(
      staffId,
      Number(month) || undefined,
      Number(year) || undefined,
      Number(page) || 1,
      Number(limit) || 20,
    );
  }

  @Patch('payroll/:id/mark-paid')
  @Roles(UserType.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async markPayrollPaid(
    @Param('id') id: string,
    @GetUser('id') userId: string,
  ) {
    return this.staffService.markPayrollPaid(id, userId);
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
