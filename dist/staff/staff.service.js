"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaffService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const email_service_1 = require("../common/email.service");
let StaffService = class StaffService {
    prisma;
    emailService;
    constructor(prisma, emailService) {
        this.prisma = prisma;
        this.emailService = emailService;
    }
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
    async createRole(data) {
        const existing = await this.prisma.role.findUnique({
            where: { name: data.name },
        });
        if (existing)
            throw new common_1.BadRequestException('Role name already exists.');
        return this.prisma.role.create({
            data: { name: data.name, description: data.description },
        });
    }
    async updateRole(id, data) {
        const role = await this.prisma.role.findUnique({ where: { id } });
        if (!role)
            throw new common_1.NotFoundException('Role not found.');
        if (data.name && data.name !== role.name) {
            const existing = await this.prisma.role.findUnique({
                where: { name: data.name },
            });
            if (existing)
                throw new common_1.BadRequestException('Role name already exists.');
        }
        return this.prisma.role.update({
            where: { id },
            data,
        });
    }
    async deleteRole(id) {
        const role = await this.prisma.role.findUnique({ where: { id } });
        if (!role)
            throw new common_1.NotFoundException('Role not found.');
        if (role.isSystemRole)
            throw new common_1.BadRequestException('Cannot delete system role.');
        const userRoles = await this.prisma.userRole.count({
            where: { roleId: id },
        });
        if (userRoles > 0)
            throw new common_1.BadRequestException('Cannot delete role assigned to users. Reassign users first.');
        return this.prisma.role.delete({ where: { id } });
    }
    async updateRolePermissions(roleId, permissions) {
        const role = await this.prisma.role.findUnique({ where: { id: roleId } });
        if (!role)
            throw new common_1.NotFoundException(`Role '${roleId}' not found.`);
        return this.prisma.$transaction(async (tx) => {
            for (const perm of permissions) {
                let permissionRecord = await tx.permission.findUnique({
                    where: {
                        module_action: { module: perm.module, action: perm.action },
                    },
                });
                if (!permissionRecord) {
                    permissionRecord = await tx.permission.create({
                        data: { module: perm.module, action: perm.action },
                    });
                }
                if (perm.enabled) {
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
                }
                else {
                    await tx.rolePermission.deleteMany({
                        where: { roleId, permissionId: permissionRecord.id },
                    });
                }
            }
            return { success: true };
        });
    }
    async createStaff(dto) {
        const existingEmail = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });
        if (existingEmail)
            throw new common_1.BadRequestException('Email is already registered.');
        const existingMobile = await this.prisma.user.findUnique({
            where: { mobile: dto.mobile },
        });
        if (existingMobile)
            throw new common_1.BadRequestException('Mobile number is already registered.');
        if (dto.employeeCode && dto.employeeCode.trim()) {
            const existingCode = await this.prisma.staffProfile.findUnique({
                where: { employeeCode: dto.employeeCode },
            });
            if (existingCode)
                throw new common_1.BadRequestException('Employee code is already in use.');
        }
        const role = await this.prisma.role.findUnique({
            where: { id: dto.roleId },
        });
        if (!role)
            throw new common_1.NotFoundException('Role not found.');
        const passwordHash = await bcrypt.hash(dto.password, 10);
        return this.prisma.$transaction(async (tx) => {
            let employeeCode = '';
            if (!dto.employeeCode || !dto.employeeCode.trim()) {
                let count = await tx.staffProfile.count();
                let codeExists = true;
                while (codeExists) {
                    employeeCode = `EMP${String(count + 1).padStart(3, '0')}`;
                    const existing = await tx.staffProfile.findUnique({
                        where: { employeeCode },
                    });
                    if (!existing) {
                        codeExists = false;
                    }
                    else {
                        count++;
                    }
                }
            }
            else {
                employeeCode = dto.employeeCode;
            }
            const staffProfile = await tx.staffProfile.create({
                data: {
                    employeeCode,
                    name: dto.name,
                    mobile: dto.mobile,
                    email: dto.email,
                    designation: dto.designation || role.name,
                    department: dto.department,
                },
            });
            const user = await tx.user.create({
                data: {
                    name: dto.name,
                    email: dto.email,
                    mobile: dto.mobile,
                    passwordHash,
                    plainPassword: dto.password,
                    userType: client_1.UserType.STAFF,
                    staffId: staffProfile.id,
                    isActive: true,
                    isVerified: true,
                },
            });
            await tx.userRole.create({
                data: {
                    userId: user.id,
                    roleId: role.id,
                },
            });
            await this.emailService
                .sendStaffCredentials(dto.email, dto.name, employeeCode, dto.password)
                .catch((err) => {
                console.error('Failed to send staff email:', err);
            });
            return staffProfile;
        });
    }
    async findAllStaff(page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [staff, total, activeCount, disabledCount] = await Promise.all([
            this.prisma.staffProfile.findMany({
                where: {
                    users: {
                        none: {
                            userType: client_1.UserType.SUPER_ADMIN,
                        },
                    },
                },
                skip,
                take: limit,
                orderBy: { name: 'asc' },
                include: {
                    users: {
                        select: {
                            id: true,
                            email: true,
                            mobile: true,
                            isActive: true,
                            userType: true,
                            lastLoginAt: true,
                            userRoles: {
                                include: {
                                    role: true,
                                },
                            },
                        },
                    },
                },
            }),
            this.prisma.staffProfile.count({
                where: {
                    users: {
                        none: {
                            userType: client_1.UserType.SUPER_ADMIN,
                        },
                    },
                },
            }),
            this.prisma.staffProfile.count({
                where: {
                    isActive: true,
                    users: {
                        none: {
                            userType: client_1.UserType.SUPER_ADMIN,
                        },
                    },
                },
            }),
            this.prisma.staffProfile.count({
                where: {
                    isActive: false,
                    users: {
                        none: {
                            userType: client_1.UserType.SUPER_ADMIN,
                        },
                    },
                },
            }),
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
    async findOneStaff(staffId) {
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
                        userRoles: {
                            include: {
                                role: true,
                            },
                        },
                    },
                },
            },
        });
        if (!staff)
            throw new common_1.NotFoundException(`Staff with ID '${staffId}' not found.`);
        return staff;
    }
    async updateStaff(staffId, dto) {
        const staff = await this.findOneStaff(staffId);
        if (dto.email && dto.email !== staff.email) {
            const existingEmail = await this.prisma.user.findFirst({
                where: { email: dto.email, NOT: { staffId } },
            });
            if (existingEmail) {
                throw new common_1.BadRequestException('Email is already registered.');
            }
        }
        if (dto.mobile && dto.mobile !== staff.mobile) {
            const existingMobile = await this.prisma.user.findFirst({
                where: { mobile: dto.mobile, NOT: { staffId } },
            });
            if (existingMobile) {
                throw new common_1.BadRequestException('Mobile number is already registered.');
            }
        }
        if (dto.mobile) {
            dto.mobile = dto.mobile.startsWith('+') ? dto.mobile.slice(1) : dto.mobile;
        }
        let resolvedDesignation = dto.designation;
        let targetRole = null;
        if (dto.roleId) {
            targetRole = await this.prisma.role.findUnique({
                where: { id: dto.roleId },
            });
            if (!targetRole)
                throw new common_1.NotFoundException('Role not found.');
            if (!dto.designation) {
                resolvedDesignation = targetRole.name;
            }
        }
        return this.prisma.$transaction(async (tx) => {
            const updatedStaff = await tx.staffProfile.update({
                where: { id: staffId },
                data: {
                    name: dto.name,
                    designation: resolvedDesignation,
                    department: dto.department,
                    photoUrl: dto.photoUrl,
                    salary: dto.salary !== undefined ? Number(dto.salary) : undefined,
                    mobile: dto.mobile,
                    email: dto.email,
                },
            });
            const linkedUsers = await tx.user.findMany({ where: { staffId } });
            for (const user of linkedUsers) {
                let updatedUserType = user.userType;
                if (targetRole) {
                    const isSuperAdminRole = targetRole.name.toLowerCase().includes('super administrator') ||
                        targetRole.name.toLowerCase().includes('super admin');
                    updatedUserType = isSuperAdminRole
                        ? client_1.UserType.SUPER_ADMIN
                        : client_1.UserType.STAFF;
                }
                await tx.user.update({
                    where: { id: user.id },
                    data: {
                        name: dto.name,
                        email: dto.email,
                        mobile: dto.mobile,
                        userType: updatedUserType,
                    },
                });
                if (dto.roleId) {
                    await tx.userRole.deleteMany({
                        where: { userId: user.id },
                    });
                    await tx.userRole.create({
                        data: {
                            userId: user.id,
                            roleId: dto.roleId,
                        },
                    });
                }
            }
            return updatedStaff;
        });
    }
    async deactivateStaff(staffId) {
        await this.findOneStaff(staffId);
        await this.prisma.staffProfile.update({
            where: { id: staffId },
            data: { isActive: false },
        });
        await this.prisma.user.updateMany({
            where: { staffId },
            data: { isActive: false },
        });
        return {
            message: `Staff '${staffId}' and linked user accounts deactivated.`,
        };
    }
    async activateStaff(staffId) {
        await this.findOneStaff(staffId);
        await this.prisma.staffProfile.update({
            where: { id: staffId },
            data: { isActive: true },
        });
        await this.prisma.user.updateMany({
            where: { staffId },
            data: { isActive: true },
        });
        return {
            message: `Staff '${staffId}' and linked user accounts activated.`,
        };
    }
    async deleteStaff(staffId) {
        await this.findOneStaff(staffId);
        try {
            return await this.prisma.$transaction(async (tx) => {
                const linkedUsers = await tx.user.findMany({ where: { staffId } });
                for (const user of linkedUsers) {
                    await tx.userRole.deleteMany({ where: { userId: user.id } });
                    await tx.userSession.deleteMany({ where: { userId: user.id } });
                    await tx.passwordResetToken.deleteMany({
                        where: { userId: user.id },
                    });
                    await tx.notification.deleteMany({ where: { userId: user.id } });
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
                    const catalogImports = await tx.catalogImport.findMany({
                        where: { uploadedBy: user.id },
                        select: { id: true },
                    });
                    const importIds = catalogImports.map((c) => c.id);
                    await tx.catalogImportRow.deleteMany({
                        where: { catalogImportId: { in: importIds } },
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
                    await tx.user.delete({ where: { id: user.id } });
                }
                await tx.attendanceRecord.deleteMany({ where: { staffId } });
                await tx.leaveRequest.deleteMany({ where: { staffId } });
                await tx.payroll.deleteMany({ where: { staffId } });
                return await tx.staffProfile.delete({
                    where: { id: staffId },
                });
            });
        }
        catch (error) {
            if (error.code === 'P2003') {
                throw new common_1.BadRequestException('Cannot delete staff member because they have linked records (e.g., orders, customers, categories). Please reassign or delete those records first.');
            }
            throw new common_1.BadRequestException(`Failed to delete staff member: ${error.message}`);
        }
    }
    async assignCustomer(dto) {
        const staffUser = await this.prisma.user.findUnique({
            where: { id: dto.salesStaffId },
        });
        if (!staffUser)
            throw new common_1.NotFoundException(`Staff user '${dto.salesStaffId}' not found.`);
        if (staffUser.userType !== client_1.UserType.STAFF &&
            staffUser.userType !== client_1.UserType.SUPER_ADMIN) {
            throw new common_1.BadRequestException('User must be STAFF or SUPER_ADMIN.');
        }
        const customer = await this.prisma.customer.findUnique({
            where: { id: dto.customerId },
        });
        if (!customer)
            throw new common_1.NotFoundException(`Customer '${dto.customerId}' not found.`);
        return this.prisma.customer.update({
            where: { id: dto.customerId },
            data: { assignedSalesStaffId: dto.salesStaffId },
            include: {
                assignedSalesStaff: { select: { id: true, name: true, email: true } },
            },
        });
    }
    async getStaffPerformance(salesStaffId) {
        const staffUser = await this.prisma.user.findUnique({
            where: { id: salesStaffId },
            include: { staff: true },
        });
        if (!staffUser)
            throw new common_1.NotFoundException(`Staff user '${salesStaffId}' not found.`);
        if (staffUser.userType !== client_1.UserType.STAFF &&
            staffUser.userType !== client_1.UserType.SUPER_ADMIN) {
            throw new common_1.BadRequestException('Requested user is not a staff member.');
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
        let totalSalesVolume = 0;
        for (const order of salesOrders)
            totalSalesVolume = totalSalesVolume + Number(order.grandTotal);
        const averageOrderValue = totalOrdersCount > 0 ? totalSalesVolume / totalOrdersCount : 0;
        const commissionRatePercent = 2.5;
        const commissionEarned = totalSalesVolume * (commissionRatePercent / 100);
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
                userType: { in: [client_1.UserType.STAFF, client_1.UserType.SUPER_ADMIN] },
                isActive: true,
            },
            select: { id: true },
        });
        const results = await Promise.all(staffUsers.map((u) => this.getStaffPerformance(u.id).catch(() => null)));
        const valid = results.filter(Boolean);
        return valid.sort((a, b) => {
            const volA = Number(a?.totalSalesVolume || 0);
            const volB = Number(b?.totalSalesVolume || 0);
            return volA > volB ? -1 : volA < volB ? 1 : 0;
        });
    }
    async findAssignedCustomers(salesStaffId) {
        return this.prisma.customer.findMany({
            where: { assignedSalesStaffId: salesStaffId },
            include: { contacts: true },
        });
    }
    async autoCheckoutPreviousDays(staffId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const where = {
            checkInTime: { not: null },
            checkOutTime: null,
            attendanceDate: {
                lt: today,
            },
        };
        if (staffId) {
            where.staffId = staffId;
        }
        const openRecords = await this.prisma.attendanceRecord.findMany({
            where,
        });
        if (openRecords.length === 0)
            return;
        const updates = [];
        for (const record of openRecords) {
            if (!record.checkInTime)
                continue;
            const checkOutTime = new Date(record.attendanceDate);
            checkOutTime.setHours(23, 59, 59, 999);
            const sessionMinutes = Math.floor((checkOutTime.getTime() - record.checkInTime.getTime()) / 60000);
            updates.push(this.prisma.attendanceRecord.update({
                where: { id: record.id },
                data: {
                    checkOutTime,
                    totalWorkMinutes: (record.totalWorkMinutes || 0) + sessionMinutes,
                },
            }));
        }
        if (updates.length > 0) {
            await Promise.all(updates);
        }
    }
    async getAttendanceHistory(staffId, startDate, endDate, page = 1, limit = 30) {
        await this.autoCheckoutPreviousDays(staffId);
        const skip = (page - 1) * limit;
        const where = {};
        if (staffId)
            where.staffId = staffId;
        if (startDate || endDate) {
            where.attendanceDate = {};
            if (startDate)
                where.attendanceDate.gte = new Date(startDate);
            if (endDate)
                where.attendanceDate.lte = new Date(endDate);
        }
        const [records, total] = await Promise.all([
            this.prisma.attendanceRecord.findMany({
                where,
                skip,
                take: limit,
                orderBy: { attendanceDate: 'desc' },
                include: {
                    staff: {
                        select: { name: true, employeeCode: true, designation: true },
                    },
                },
            }),
            this.prisma.attendanceRecord.count({ where }),
        ]);
        return {
            records,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    }
    async markAttendanceAdmin(dto, approvedById) {
        const staff = await this.prisma.staffProfile.findUnique({
            where: { id: dto.staffId },
        });
        if (!staff)
            throw new common_1.NotFoundException(`Staff with ID '${dto.staffId}' not found.`);
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
    async checkInAttendance(userId, note) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { staffId: true },
        });
        if (!user?.staffId)
            throw new common_1.BadRequestException('User is not linked to a staff profile.');
        await this.autoCheckoutPreviousDays(user.staffId);
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
        if (existing?.checkInTime && !existing?.checkOutTime)
            throw new common_1.BadRequestException('Already checked in. Please check out first.');
        if (existing) {
            return this.prisma.attendanceRecord.update({
                where: { id: existing.id },
                data: {
                    checkInTime: new Date(),
                    checkOutTime: null,
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
    async checkOutAttendance(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { staffId: true },
        });
        if (!user?.staffId)
            throw new common_1.BadRequestException('User is not linked to a staff profile.');
        await this.autoCheckoutPreviousDays(user.staffId);
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
            throw new common_1.BadRequestException('Must check in before checking out.');
        if (existing.checkOutTime)
            throw new common_1.BadRequestException('Already checked out. Please check in first.');
        const checkOutTime = new Date();
        const sessionMinutes = Math.floor((checkOutTime.getTime() - existing.checkInTime.getTime()) / 60000);
        const totalWorkMinutes = (existing.totalWorkMinutes || 0) + sessionMinutes;
        return this.prisma.attendanceRecord.update({
            where: { id: existing.id },
            data: { checkOutTime, totalWorkMinutes },
        });
    }
    async createLeaveRequest(dto, userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { staffId: true },
        });
        if (!user?.staffId)
            throw new common_1.BadRequestException('User is not linked to a staff profile.');
        const start = new Date(dto.startDate);
        const end = new Date(dto.endDate);
        if (end < start)
            throw new common_1.BadRequestException('End date must be on or after start date.');
        const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        return this.prisma.leaveRequest.create({
            data: {
                staffId: user.staffId,
                leaveType: dto.leaveType,
                startDate: start,
                endDate: end,
                totalDays: diffDays,
                reason: dto.reason,
                status: 'PENDING',
            },
        });
    }
    async getLeaveRequests(userId, userType, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const where = {};
        if (userType === client_1.UserType.STAFF) {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { staffId: true },
            });
            if (user?.staffId)
                where.staffId = user.staffId;
        }
        const [requests, total] = await Promise.all([
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
    async approveLeave(leaveId, userId) {
        const leave = await this.prisma.leaveRequest.findUnique({
            where: { id: leaveId },
        });
        if (!leave)
            throw new common_1.NotFoundException(`Leave request '${leaveId}' not found.`);
        if (leave.status !== 'PENDING')
            throw new common_1.BadRequestException(`Leave is already ${leave.status}.`);
        return this.prisma.leaveRequest.update({
            where: { id: leaveId },
            data: { status: 'APPROVED', approvedBy: userId, approvedAt: new Date() },
        });
    }
    async rejectLeave(leaveId, userId) {
        const leave = await this.prisma.leaveRequest.findUnique({
            where: { id: leaveId },
        });
        if (!leave)
            throw new common_1.NotFoundException(`Leave request '${leaveId}' not found.`);
        if (leave.status !== 'PENDING')
            throw new common_1.BadRequestException(`Leave is already ${leave.status}.`);
        return this.prisma.leaveRequest.update({
            where: { id: leaveId },
            data: { status: 'REJECTED', approvedBy: userId, approvedAt: new Date() },
        });
    }
    async getPayrolls(staffId, month, year, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const where = {};
        if (staffId)
            where.staffId = staffId;
        if (month)
            where.salaryMonth = month;
        if (year)
            where.salaryYear = year;
        const [payrolls, total] = await Promise.all([
            this.prisma.payroll.findMany({
                where,
                skip,
                take: limit,
                orderBy: [{ salaryYear: 'desc' }, { salaryMonth: 'desc' }],
                include: {
                    staff: {
                        select: { name: true, employeeCode: true, designation: true },
                    },
                },
            }),
            this.prisma.payroll.count({ where }),
        ]);
        return {
            payrolls,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    }
    async markPayrollPaid(payrollId, userId) {
        const payroll = await this.prisma.payroll.findUnique({
            where: { id: payrollId },
        });
        if (!payroll)
            throw new common_1.NotFoundException(`Payroll '${payrollId}' not found.`);
        if (payroll.paymentStatus === 'PAID')
            throw new common_1.BadRequestException('Payroll already marked as paid.');
        return this.prisma.payroll.update({
            where: { id: payrollId },
            data: { paymentStatus: 'PAID', paidAt: new Date(), paidBy: userId },
        });
    }
    async calculatePayroll(staffId, salaryMonth, salaryYear, userId, dto) {
        const staff = await this.prisma.staffProfile.findUnique({
            where: { id: staffId },
        });
        if (!staff)
            throw new common_1.NotFoundException(`Staff Profile '${staffId}' not found.`);
        const basicSalary = dto?.basicSalary !== undefined && dto?.basicSalary !== ""
            ? Number(dto.basicSalary)
            : Number(staff.salary || 0);
        const startDate = new Date(Number(salaryYear), Number(salaryMonth) - 1, 1);
        const endDate = new Date(Number(salaryYear), Number(salaryMonth), 0);
        let daysWorked = 0;
        if (dto?.daysWorked !== undefined && dto?.daysWorked !== "") {
            daysWorked = Number(dto.daysWorked);
        }
        else {
            const attendances = await this.prisma.attendanceRecord.findMany({
                where: { staffId, attendanceDate: { gte: startDate, lte: endDate } },
            });
            attendances.forEach((a) => {
                if (a.status === 'PRESENT')
                    daysWorked++;
                if (a.status === 'HALF_DAY')
                    daysWorked += 0.5;
            });
            if (daysWorked === 0)
                daysWorked = 30;
        }
        const overtimeAmount = dto?.overtimeAmount !== undefined && dto?.overtimeAmount !== ""
            ? Number(dto.overtimeAmount)
            : 0;
        const deductions = dto?.deductions !== undefined && dto?.deductions !== ""
            ? Number(dto.deductions)
            : 0;
        const bonus = dto?.bonus !== undefined && dto?.bonus !== "" ? Number(dto.bonus) : 0;
        const paymentStatus = dto?.paymentStatus || 'PENDING';
        const payableSalary = basicSalary + overtimeAmount + bonus - deductions;
        return this.prisma.payroll.upsert({
            where: {
                staffId_salaryMonth_salaryYear: {
                    staffId,
                    salaryMonth: Number(salaryMonth),
                    salaryYear: Number(salaryYear),
                },
            },
            update: {
                basicSalary,
                overtimeAmount,
                deductions,
                bonus,
                daysWorked,
                payableSalary,
                paymentStatus,
                ...(paymentStatus === 'PAID' && { paidAt: new Date(), paidBy: userId }),
            },
            create: {
                staffId,
                salaryMonth: Number(salaryMonth),
                salaryYear: Number(salaryYear),
                basicSalary,
                overtimeAmount,
                deductions,
                bonus,
                daysWorked,
                payableSalary,
                paymentStatus,
                ...(paymentStatus === 'PAID' && { paidAt: new Date(), paidBy: userId }),
            },
        });
    }
    async updatePayroll(id, dto, userId) {
        const payroll = await this.prisma.payroll.findUnique({ where: { id } });
        if (!payroll)
            throw new common_1.NotFoundException(`Payroll '${id}' not found.`);
        const basicSalary = dto.basicSalary !== undefined
            ? Number(dto.basicSalary)
            : Number(payroll.basicSalary || 0);
        const overtimeAmount = dto.overtimeAmount !== undefined
            ? Number(dto.overtimeAmount)
            : Number(payroll.overtimeAmount || 0);
        const deductions = dto.deductions !== undefined
            ? Number(dto.deductions)
            : Number(payroll.deductions || 0);
        const bonus = dto.bonus !== undefined
            ? Number(dto.bonus)
            : Number(payroll.bonus || 0);
        const daysWorked = dto.daysWorked !== undefined
            ? Number(dto.daysWorked)
            : Number(payroll.daysWorked || 0);
        const salaryMonth = dto.salaryMonth !== undefined
            ? Number(dto.salaryMonth)
            : payroll.salaryMonth;
        const salaryYear = dto.salaryYear !== undefined
            ? Number(dto.salaryYear)
            : payroll.salaryYear;
        const payableSalary = basicSalary + overtimeAmount + bonus - deductions;
        return this.prisma.payroll.update({
            where: { id },
            data: {
                ...(dto.basicSalary !== undefined && { basicSalary }),
                ...(dto.overtimeAmount !== undefined && { overtimeAmount }),
                ...(dto.deductions !== undefined && { deductions }),
                ...(dto.bonus !== undefined && { bonus }),
                ...(dto.daysWorked !== undefined && { daysWorked }),
                ...(dto.salaryMonth !== undefined && { salaryMonth }),
                ...(dto.salaryYear !== undefined && { salaryYear }),
                payableSalary,
                ...(dto.paymentStatus && { paymentStatus: dto.paymentStatus }),
                ...(dto.paymentStatus === 'PAID' &&
                    payroll.paymentStatus !== 'PAID' && {
                    paidAt: new Date(),
                    paidBy: userId,
                }),
            },
        });
    }
    async deletePayroll(id) {
        const payroll = await this.prisma.payroll.findUnique({ where: { id } });
        if (!payroll)
            throw new common_1.NotFoundException(`Payroll '${id}' not found.`);
        return this.prisma.payroll.delete({ where: { id } });
    }
};
exports.StaffService = StaffService;
exports.StaffService = StaffService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        email_service_1.EmailService])
], StaffService);
//# sourceMappingURL=staff.service.js.map