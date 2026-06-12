import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AssignCustomerDto } from './dto/assign-customer.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { Prisma, UserType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CreateStaffDto } from './dto/create-staff.dto';
import { EmailService } from '../common/email.service';

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  // =============== ROLES & PERMISSIONS ===============

  async getRoles() {
    return this.prisma.role.findMany({
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createRole(data: { name: string; description?: string }) {
    const existing = await this.prisma.role.findUnique({
      where: { name: data.name },
    });
    if (existing) throw new BadRequestException('Role name already exists.');

    return this.prisma.role.create({
      data: { name: data.name, description: data.description },
    });
  }

  async updateRole(id: string, data: { name?: string; description?: string }) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found.');

    if (data.name && data.name !== role.name) {
      const existing = await this.prisma.role.findUnique({
        where: { name: data.name },
      });
      if (existing) throw new BadRequestException('Role name already exists.');
    }

    return this.prisma.role.update({
      where: { id },
      data,
    });
  }

  async deleteRole(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found.');
    if (role.isSystemRole)
      throw new BadRequestException('Cannot delete system role.');

    const userRoles = await this.prisma.userRole.count({
      where: { roleId: id },
    });
    if (userRoles > 0)
      throw new BadRequestException(
        'Cannot delete role assigned to users. Reassign users first.',
      );

    return this.prisma.role.delete({ where: { id } });
  }

  async updateRolePermissions(
    roleId: string,
    permissions: { module: string; action: string; enabled: boolean }[],
  ) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException(`Role '${roleId}' not found.`);

    return this.prisma.$transaction(async (tx) => {
      for (const perm of permissions) {
        // Find the permission record
        let permissionRecord = await tx.permission.findUnique({
          where: {
            module_action: { module: perm.module, action: perm.action },
          },
        });

        if (!permissionRecord) {
          // Create the permission if it doesn't exist
          permissionRecord = await tx.permission.create({
            data: { module: perm.module, action: perm.action },
          });
        }

        if (perm.enabled) {
          // Add role permission if not exists
          const existing = await tx.rolePermission.findUnique({
            where: {
              roleId_permissionId: {
                roleId,
                permissionId: permissionRecord.id,
              },
            },
          });
          if (!existing) {
            await tx.rolePermission.create({
              data: { roleId, permissionId: permissionRecord.id },
            });
          }
        } else {
          // Remove role permission if exists
          await tx.rolePermission.deleteMany({
            where: { roleId, permissionId: permissionRecord.id },
          });
        }
      }
      return { success: true };
    });
  }

  // =============== STAFF PROFILE MANAGEMENT ===============

  async createStaff(dto: CreateStaffDto) {
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingEmail)
      throw new BadRequestException('Email is already registered.');

    const existingMobile = await this.prisma.user.findUnique({
      where: { mobile: dto.mobile },
    });
    if (existingMobile)
      throw new BadRequestException('Mobile number is already registered.');

    const existingCode = await this.prisma.staffProfile.findUnique({
      where: { employeeCode: dto.employeeCode },
    });
    if (existingCode)
      throw new BadRequestException('Employee code is already in use.');

    const role = await this.prisma.role.findUnique({
      where: { id: dto.roleId },
    });
    if (!role) throw new NotFoundException('Role not found.');

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.$transaction(async (tx) => {
      // 1. Create Staff Profile
      const staffProfile = await tx.staffProfile.create({
        data: {
          employeeCode: dto.employeeCode,
          name: dto.name,
          mobile: dto.mobile,
          email: dto.email,
          designation: dto.designation || role.name,
          department: dto.department,
        },
      });

      // 2. Create User linked to Staff Profile
      const user = await tx.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          mobile: dto.mobile,
          passwordHash,
          plainPassword: dto.password, // Only storing for initial demo/testing purposes
          userType: UserType.STAFF,
          staffId: staffProfile.id,
          isActive: true,
          isVerified: true,
        },
      });

      // 3. Assign Role to User
      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: role.id,
        },
      });

      // 4. Send Email Credentials
      await this.emailService
        .sendStaffCredentials(
          dto.email,
          dto.name,
          dto.employeeCode,
          dto.password,
        )
        .catch((err) => {
          // Silently catch email errors so it doesn't fail staff creation if SMTP is down
          console.error('Failed to send staff email:', err);
        });

      return staffProfile;
    });
  }

  async findAllStaff(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [staff, total, activeCount, disabledCount] =
      await this.prisma.$transaction([
        this.prisma.staffProfile.findMany({
          skip,
          take: limit,
          orderBy: { name: 'asc' },
          include: {
            users: {
              select: {
                id: true,
                email: true,
                isActive: true,
                userType: true,
                lastLoginAt: true,
              },
            },
          },
        }),
        this.prisma.staffProfile.count(),
        this.prisma.staffProfile.count({ where: { isActive: true } }),
        this.prisma.staffProfile.count({ where: { isActive: false } }),
      ]);
    return {
      staff,
      meta: {
        total,
        activeCount,
        disabledCount,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOneStaff(staffId: string) {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { id: staffId },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            mobile: true,
            isActive: true,
            userType: true,
            lastLoginAt: true,
          },
        },
      },
    });
    if (!staff)
      throw new NotFoundException(`Staff with ID '${staffId}' not found.`);
    return staff;
  }

  async updateStaff(staffId: string, dto: UpdateStaffDto) {
    await this.findOneStaff(staffId);
    return this.prisma.staffProfile.update({
      where: { id: staffId },
      data: {
        name: dto.name,
        designation: dto.designation,
        department: dto.department,
        photoUrl: dto.photoUrl,
        salary:
          dto.salary !== undefined ? new Prisma.Decimal(dto.salary) : undefined,
      },
    });
  }

  async deactivateStaff(staffId: string) {
    await this.findOneStaff(staffId);
    // Deactivate linked user accounts
    await this.prisma.user.updateMany({
      where: { staffId },
      data: { isActive: false },
    });
    return {
      message: `Staff '${staffId}' and linked user accounts deactivated.`,
    };
  }

  async activateStaff(staffId: string) {
    await this.findOneStaff(staffId);
    await this.prisma.user.updateMany({
      where: { staffId },
      data: { isActive: true },
    });
    return {
      message: `Staff '${staffId}' and linked user accounts activated.`,
    };
  }

  async deleteStaff(staffId: string) {
    await this.findOneStaff(staffId);

    // Check if staff has processed any orders (as handledBySalesStaffId)
    // If so, we might want to prevent deletion to maintain history,
    // but the user specifically requested delete functionality.
    // For safety, we will allow deletion but use a transaction.

    try {
      return await this.prisma.$transaction(async (tx) => {
        // First, delete the linked users to avoid foreign key constraint errors
        // since User.staffId does not have onDelete: Cascade
        const linkedUsers = await tx.user.findMany({ where: { staffId } });

        for (const user of linkedUsers) {
          // Delete related records
          await tx.userRole.deleteMany({ where: { userId: user.id } });
          await tx.userSession.deleteMany({ where: { userId: user.id } });
          await tx.passwordResetToken.deleteMany({
            where: { userId: user.id },
          });
          await tx.notification.deleteMany({ where: { userId: user.id } });

          // Manually decouple all records to allow forceful deletion
          await tx.category.updateMany({
            where: { createdBy: user.id },
            data: { createdBy: null },
          });
          await tx.category.updateMany({
            where: { updatedBy: user.id },
            data: { updatedBy: null },
          });
          await tx.product.updateMany({
            where: { createdBy: user.id },
            data: { createdBy: null },
          });
          await tx.product.updateMany({
            where: { updatedBy: user.id },
            data: { updatedBy: null },
          });
          await tx.productImage.updateMany({
            where: { createdBy: user.id },
            data: { createdBy: null },
          });
          await tx.imageCleaningTask.updateMany({
            where: { createdBy: user.id },
            data: { createdBy: null },
          });
          await tx.productCatalogFile.updateMany({
            where: { createdBy: user.id },
            data: { createdBy: null },
          });
          await tx.productVideo.updateMany({
            where: { createdBy: user.id },
            data: { createdBy: null },
          });
          await tx.banner.updateMany({
            where: { createdBy: user.id },
            data: { createdBy: null },
          });
          await tx.catalogImport.deleteMany({ where: { uploadedBy: user.id } });
          await tx.productPricing.updateMany({
            where: { createdBy: user.id },
            data: { createdBy: null },
          });
          await tx.productPricing.updateMany({
            where: { updatedBy: user.id },
            data: { updatedBy: null },
          });
          await tx.customer.updateMany({
            where: { assignedSalesStaffId: user.id },
            data: { assignedSalesStaffId: null },
          });
          await tx.customer.updateMany({
            where: { approvedBy: user.id },
            data: { approvedBy: null },
          });
          await tx.order.updateMany({
            where: { handledBySalesStaffId: user.id },
            data: { handledBySalesStaffId: null },
          });
          await tx.order.updateMany({
            where: { approvedBy: user.id },
            data: { approvedBy: null },
          });
          await tx.order.updateMany({
            where: { cancelledBy: user.id },
            data: { cancelledBy: null },
          });
          await tx.orderStatusHistory.updateMany({
            where: { changedBy: user.id },
            data: { changedBy: null },
          });
          await tx.backorderApproval.updateMany({
            where: { requestedBy: user.id },
            data: { requestedBy: null },
          });
          await tx.backorderApproval.updateMany({
            where: { approvedBy: user.id },
            data: { approvedBy: null },
          });
          await tx.packingSlip.updateMany({
            where: { packedBy: user.id },
            data: { packedBy: null },
          });
          await tx.shipment.updateMany({
            where: { createdBy: user.id },
            data: { createdBy: null },
          });
          await tx.invoice.updateMany({
            where: { createdBy: user.id },
            data: { createdBy: null },
          });
          await tx.payment.updateMany({
            where: { verifiedBy: user.id },
            data: { verifiedBy: null },
          });
          await tx.payment.updateMany({
            where: { receivedBy: user.id },
            data: { receivedBy: null },
          });
          await tx.ledgerEntry.updateMany({
            where: { createdBy: user.id },
            data: { createdBy: null },
          });
          await tx.creditDebitNote.updateMany({
            where: { createdBy: user.id },
            data: { createdBy: null },
          });
          await tx.purchaseOrder.updateMany({
            where: { createdBy: user.id },
            data: { createdBy: null },
          });
          await tx.stockMovement.updateMany({
            where: { createdBy: user.id },
            data: { createdBy: null },
          });
          await tx.attendanceRecord.updateMany({
            where: { approvedBy: user.id },
            data: { approvedBy: null },
          });
          await tx.leaveRequest.updateMany({
            where: { approvedBy: user.id },
            data: { approvedBy: null },
          });
          await tx.payroll.updateMany({
            where: { paidBy: user.id },
            data: { paidBy: null },
          });
          await tx.supportTicket.updateMany({
            where: { userId: user.id },
            data: { userId: null },
          });
          await tx.supportTicket.updateMany({
            where: { assignedTo: user.id },
            data: { assignedTo: null },
          });
          await tx.savedReport.updateMany({
            where: { createdBy: user.id },
            data: { createdBy: null },
          });
          await tx.auditLog.updateMany({
            where: { userId: user.id },
            data: { userId: null },
          });

          // Finally, delete the user
          await tx.user.delete({ where: { id: user.id } });
        }

        // The other relations (AttendanceRecord, LeaveRequest, Payroll)
        // have onDelete: Cascade so they will be automatically deleted.
        return await tx.staffProfile.delete({
          where: { id: staffId },
        });
      });
    } catch (error: any) {
      if (error.code === 'P2003') {
        throw new BadRequestException(
          'Cannot delete staff member because they have linked records (e.g., orders, customers, categories). Please reassign or delete those records first.',
        );
      }
      throw new BadRequestException(
        `Failed to delete staff member: ${error.message}`,
      );
    }
  }

  // =============== ASSIGN CUSTOMER ===============

  async assignCustomer(dto: AssignCustomerDto) {
    const staffUser = await this.prisma.user.findUnique({
      where: { id: dto.salesStaffId },
    });
    if (!staffUser)
      throw new NotFoundException(
        `Staff user '${dto.salesStaffId}' not found.`,
      );
    if (
      staffUser.userType !== UserType.STAFF &&
      staffUser.userType !== UserType.SUPER_ADMIN
    ) {
      throw new BadRequestException('User must be STAFF or SUPER_ADMIN.');
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });
    if (!customer)
      throw new NotFoundException(`Customer '${dto.customerId}' not found.`);

    return this.prisma.customer.update({
      where: { id: dto.customerId },
      data: { assignedSalesStaffId: dto.salesStaffId },
      include: {
        assignedSalesStaff: { select: { id: true, name: true, email: true } },
      },
    });
  }

  // =============== PERFORMANCE ===============

  async getStaffPerformance(salesStaffId: string) {
    const staffUser = await this.prisma.user.findUnique({
      where: { id: salesStaffId },
      include: { staff: true },
    });
    if (!staffUser)
      throw new NotFoundException(`Staff user '${salesStaffId}' not found.`);
    if (
      staffUser.userType !== UserType.STAFF &&
      staffUser.userType !== UserType.SUPER_ADMIN
    ) {
      throw new BadRequestException('Requested user is not a staff member.');
    }

    const totalCustomersAssigned = await this.prisma.customer.count({
      where: { assignedSalesStaffId: salesStaffId },
    });

    const salesOrders = await this.prisma.order.findMany({
      where: {
        handledBySalesStaffId: salesStaffId,
        orderStatus: { not: 'CANCELLED' },
      },
      select: { id: true, grandTotal: true },
    });

    const totalOrdersCount = salesOrders.length;
    let totalSalesVolume = new Prisma.Decimal(0);
    for (const order of salesOrders)
      totalSalesVolume = totalSalesVolume.add(order.grandTotal);

    const averageOrderValue =
      totalOrdersCount > 0
        ? totalSalesVolume.div(totalOrdersCount)
        : new Prisma.Decimal(0);

    const commissionRatePercent = 2.5;
    const commissionEarned = totalSalesVolume.mul(commissionRatePercent / 100);

    return {
      staffId: salesStaffId,
      name: staffUser.staff?.name || staffUser.name,
      employeeCode: staffUser.staff?.employeeCode || null,
      designation: staffUser.staff?.designation || null,
      department: staffUser.staff?.department || null,
      totalCustomersAssigned,
      totalOrdersCount,
      totalSalesVolume,
      averageOrderValue,
      commissionRatePercent,
      commissionEarned,
    };
  }

  async getStaffLeaderboard() {
    const staffUsers = await this.prisma.user.findMany({
      where: {
        userType: { in: [UserType.STAFF, UserType.SUPER_ADMIN] },
        isActive: true,
      },
      select: { id: true },
    });
    const results = await Promise.all(
      staffUsers.map((u) => this.getStaffPerformance(u.id).catch(() => null)),
    );
    const valid = results.filter(Boolean);
    return valid.sort((a, b) => {
      const volA = a?.totalSalesVolume || new Prisma.Decimal(0);
      const volB = b?.totalSalesVolume || new Prisma.Decimal(0);
      return volA.gt(volB) ? -1 : volA.lt(volB) ? 1 : 0;
    });
  }

  async findAssignedCustomers(salesStaffId: string) {
    return this.prisma.customer.findMany({
      where: { assignedSalesStaffId: salesStaffId },
      include: { contacts: true },
    });
  }

  // =============== ATTENDANCE ===============

  async getAttendanceHistory(
    staffId?: string,
    startDate?: string,
    endDate?: string,
    page = 1,
    limit = 30,
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (staffId) where.staffId = staffId;
    if (startDate || endDate) {
      where.attendanceDate = {};
      if (startDate) where.attendanceDate.gte = new Date(startDate);
      if (endDate) where.attendanceDate.lte = new Date(endDate);
    }

    const [records, total] = await this.prisma.$transaction([
      this.prisma.attendanceRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { attendanceDate: 'desc' },
        include: { staff: { select: { name: true, employeeCode: true } } },
      }),
      this.prisma.attendanceRecord.count({ where }),
    ]);

    return {
      records,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async markAttendanceAdmin(dto: MarkAttendanceDto, approvedById: string) {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { id: dto.staffId },
    });
    if (!staff)
      throw new NotFoundException(`Staff with ID '${dto.staffId}' not found.`);

    const attendanceDate = new Date(dto.attendanceDate);
    attendanceDate.setHours(0, 0, 0, 0);

    return this.prisma.attendanceRecord.upsert({
      where: {
        staffId_attendanceDate: { staffId: dto.staffId, attendanceDate },
      },
      update: { status: dto.status, note: dto.note, approvedBy: approvedById },
      create: {
        staffId: dto.staffId,
        attendanceDate,
        status: dto.status,
        note: dto.note,
        approvedBy: approvedById,
      },
    });
  }

  async checkInAttendance(userId: string, note?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { staffId: true },
    });
    if (!user?.staffId)
      throw new BadRequestException('User is not linked to a staff profile.');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await this.prisma.attendanceRecord.findUnique({
      where: {
        staffId_attendanceDate: {
          staffId: user.staffId,
          attendanceDate: today,
        },
      },
    });

    if (existing?.checkInTime)
      throw new BadRequestException('Already checked in today.');

    if (existing) {
      return this.prisma.attendanceRecord.update({
        where: { id: existing.id },
        data: {
          checkInTime: new Date(),
          status: 'PRESENT',
          note: note || existing.note,
        },
      });
    }

    return this.prisma.attendanceRecord.create({
      data: {
        staffId: user.staffId,
        attendanceDate: today,
        status: 'PRESENT',
        checkInTime: new Date(),
        note,
      },
    });
  }

  async checkOutAttendance(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { staffId: true },
    });
    if (!user?.staffId)
      throw new BadRequestException('User is not linked to a staff profile.');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await this.prisma.attendanceRecord.findUnique({
      where: {
        staffId_attendanceDate: {
          staffId: user.staffId,
          attendanceDate: today,
        },
      },
    });

    if (!existing?.checkInTime)
      throw new BadRequestException('Must check in before checking out.');
    if (existing.checkOutTime)
      throw new BadRequestException('Already checked out today.');

    const checkOutTime = new Date();
    const totalWorkMinutes = Math.floor(
      (checkOutTime.getTime() - existing.checkInTime.getTime()) / 60000,
    );

    return this.prisma.attendanceRecord.update({
      where: { id: existing.id },
      data: { checkOutTime, totalWorkMinutes },
    });
  }

  // =============== LEAVE REQUESTS ===============

  async createLeaveRequest(dto: CreateLeaveRequestDto, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { staffId: true },
    });
    if (!user?.staffId)
      throw new BadRequestException('User is not linked to a staff profile.');

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);

    if (end < start)
      throw new BadRequestException('End date must be on or after start date.');

    const diffDays =
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    return this.prisma.leaveRequest.create({
      data: {
        staffId: user.staffId,
        leaveType: dto.leaveType,
        startDate: start,
        endDate: end,
        totalDays: new Prisma.Decimal(diffDays),
        reason: dto.reason,
        status: 'PENDING',
      },
    });
  }

  async getLeaveRequests(
    userId: string,
    userType: string,
    page = 1,
    limit = 20,
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (userType === UserType.STAFF) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { staffId: true },
      });
      if (user?.staffId) where.staffId = user.staffId;
    }

    const [requests, total] = await this.prisma.$transaction([
      this.prisma.leaveRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { staff: { select: { name: true, employeeCode: true } } },
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);

    return {
      requests,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async approveLeave(leaveId: string, userId: string) {
    const leave = await this.prisma.leaveRequest.findUnique({
      where: { id: leaveId },
    });
    if (!leave)
      throw new NotFoundException(`Leave request '${leaveId}' not found.`);
    if (leave.status !== 'PENDING')
      throw new BadRequestException(`Leave is already ${leave.status}.`);

    return this.prisma.leaveRequest.update({
      where: { id: leaveId },
      data: { status: 'APPROVED', approvedBy: userId, approvedAt: new Date() },
    });
  }

  async rejectLeave(leaveId: string, userId: string) {
    const leave = await this.prisma.leaveRequest.findUnique({
      where: { id: leaveId },
    });
    if (!leave)
      throw new NotFoundException(`Leave request '${leaveId}' not found.`);
    if (leave.status !== 'PENDING')
      throw new BadRequestException(`Leave is already ${leave.status}.`);

    return this.prisma.leaveRequest.update({
      where: { id: leaveId },
      data: { status: 'REJECTED', approvedBy: userId, approvedAt: new Date() },
    });
  }

  // =============== PAYROLL ===============

  async getPayrolls(
    staffId?: string,
    month?: number,
    year?: number,
    page = 1,
    limit = 20,
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (staffId) where.staffId = staffId;
    if (month) where.salaryMonth = month;
    if (year) where.salaryYear = year;

    const [payrolls, total] = await this.prisma.$transaction([
      this.prisma.payroll.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ salaryYear: 'desc' }, { salaryMonth: 'desc' }],
        include: { staff: { select: { name: true, employeeCode: true } } },
      }),
      this.prisma.payroll.count({ where }),
    ]);

    return {
      payrolls,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async markPayrollPaid(payrollId: string, userId: string) {
    const payroll = await this.prisma.payroll.findUnique({
      where: { id: payrollId },
    });
    if (!payroll)
      throw new NotFoundException(`Payroll '${payrollId}' not found.`);
    if (payroll.paymentStatus === 'PAID')
      throw new BadRequestException('Payroll already marked as paid.');

    return this.prisma.payroll.update({
      where: { id: payrollId },
      data: { paymentStatus: 'PAID', paidAt: new Date(), paidBy: userId },
    });
  }

  async calculatePayroll(
    staffId: string,
    salaryMonth: string | number,
    salaryYear: string | number,
    userId: string,
  ) {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { id: staffId },
    });
    if (!staff)
      throw new NotFoundException(`Staff Profile '${staffId}' not found.`);

    const basicSalary = staff.salary || new Prisma.Decimal(0);
    const startDate = new Date(Number(salaryYear), Number(salaryMonth) - 1, 1);
    const endDate = new Date(Number(salaryYear), Number(salaryMonth), 0);

    const attendances = await this.prisma.attendanceRecord.findMany({
      where: { staffId, attendanceDate: { gte: startDate, lte: endDate } },
    });

    let presentDays = 0;
    attendances.forEach((a) => {
      if (a.status === 'PRESENT') presentDays++;
      if (a.status === 'HALF_DAY') presentDays += 0.5;
    });

    const dailyRate = basicSalary.div(30);
    const calculatedSalary = dailyRate.mul(presentDays);
    const overtimeAmount = new Prisma.Decimal(0);
    const deductions = new Prisma.Decimal(0);
    const bonus = new Prisma.Decimal(0);
    const payableSalary = calculatedSalary
      .add(overtimeAmount)
      .add(bonus)
      .sub(deductions);

    return this.prisma.payroll.upsert({
      where: {
        staffId_salaryMonth_salaryYear: {
          staffId,
          salaryMonth: Number(salaryMonth),
          salaryYear: Number(salaryYear),
        },
      },
      update: { basicSalary, overtimeAmount, deductions, bonus, payableSalary },
      create: {
        staffId,
        salaryMonth: Number(salaryMonth),
        salaryYear: Number(salaryYear),
        basicSalary,
        overtimeAmount,
        deductions,
        bonus,
        payableSalary,
        paymentStatus: 'PENDING',
      },
    });
  }
}
