"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaffController = void 0;
const common_1 = require("@nestjs/common");
const staff_service_1 = require("./staff.service");
const create_staff_dto_1 = require("./dto/create-staff.dto");
const assign_customer_dto_1 = require("./dto/assign-customer.dto");
const update_staff_dto_1 = require("./dto/update-staff.dto");
const mark_attendance_dto_1 = require("./dto/mark-attendance.dto");
const create_leave_request_dto_1 = require("./dto/create-leave-request.dto");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const client_1 = require("@prisma/client");
let StaffController = class StaffController {
    staffService;
    constructor(staffService) {
        this.staffService = staffService;
    }
    async getRoles() {
        return this.staffService.getRoles();
    }
    async updateRolePermissions(roleId, permissions) {
        return this.staffService.updateRolePermissions(roleId, permissions);
    }
    async createRole(data) {
        return this.staffService.createRole(data);
    }
    async updateRole(roleId, data) {
        return this.staffService.updateRole(roleId, data);
    }
    async deleteRole(roleId) {
        return this.staffService.deleteRole(roleId);
    }
    async createStaff(dto) {
        return this.staffService.createStaff(dto);
    }
    async findAll(page, limit) {
        return this.staffService.findAllStaff(Number(page) || 1, Number(limit) || 20);
    }
    async findOneStaff(staffId) {
        return this.staffService.findOneStaff(staffId);
    }
    async updateStaff(staffId, dto) {
        return this.staffService.updateStaff(staffId, dto);
    }
    async deactivateStaff(staffId) {
        return this.staffService.deactivateStaff(staffId);
    }
    async activateStaff(staffId) {
        return this.staffService.activateStaff(staffId);
    }
    async deleteStaff(staffId) {
        return this.staffService.deleteStaff(staffId);
    }
    async assignCustomer(dto) {
        return this.staffService.assignCustomer(dto);
    }
    async getMyCustomers(userId) {
        return this.staffService.findAssignedCustomers(userId);
    }
    async getMyPerformance(userId) {
        return this.staffService.getStaffPerformance(userId);
    }
    async getStaffPerformance(staffId) {
        return this.staffService.getStaffPerformance(staffId);
    }
    async getLeaderboard() {
        return this.staffService.getStaffLeaderboard();
    }
    async getAttendance(user, staffId, startDate, endDate, page, limit) {
        const resolvedStaffId = user.userType === client_1.UserType.STAFF ? user.staffId : staffId;
        return this.staffService.getAttendanceHistory(resolvedStaffId, startDate, endDate, Number(page) || 1, Number(limit) || 30);
    }
    async markAttendance(dto, userId) {
        return this.staffService.markAttendanceAdmin(dto, userId);
    }
    async checkIn(userId, note) {
        return this.staffService.checkInAttendance(userId, note);
    }
    async checkOut(userId) {
        return this.staffService.checkOutAttendance(userId);
    }
    async createLeave(dto, userId) {
        return this.staffService.createLeaveRequest(dto, userId);
    }
    async getLeaveRequests(user, page, limit) {
        return this.staffService.getLeaveRequests(user.id, user.userType, Number(page) || 1, Number(limit) || 20);
    }
    async approveLeave(id, userId) {
        return this.staffService.approveLeave(id, userId);
    }
    async rejectLeave(id, userId) {
        return this.staffService.rejectLeave(id, userId);
    }
    async getPayrolls(staffId, month, year, page, limit) {
        return this.staffService.getPayrolls(staffId, Number(month) || undefined, Number(year) || undefined, Number(page) || 1, Number(limit) || 20);
    }
    async markPayrollPaid(id, userId) {
        return this.staffService.markPayrollPaid(id, userId);
    }
    async calculatePayroll(staffId, dto, userId) {
        const month = dto?.month || new Date().getMonth() + 1;
        const year = dto?.year || new Date().getFullYear();
        return this.staffService.calculatePayroll(staffId, month, year, userId, dto);
    }
    async updatePayroll(id, dto, userId) {
        return this.staffService.updatePayroll(id, dto, userId);
    }
    async deletePayroll(id) {
        return this.staffService.deletePayroll(id);
    }
};
exports.StaffController = StaffController;
__decorate([
    (0, common_1.Get)('roles'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StaffController.prototype, "getRoles", null);
__decorate([
    (0, common_1.Patch)('roles/:id/permissions'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('permissions')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Array]),
    __metadata("design:returntype", Promise)
], StaffController.prototype, "updateRolePermissions", null);
__decorate([
    (0, common_1.Post)('roles'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], StaffController.prototype, "createRole", null);
__decorate([
    (0, common_1.Patch)('roles/:id'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], StaffController.prototype, "updateRole", null);
__decorate([
    (0, common_1.Delete)('roles/:id'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StaffController.prototype, "deleteRole", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_staff_dto_1.CreateStaffDto]),
    __metadata("design:returntype", Promise)
], StaffController.prototype, "createStaff", null);
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", Promise)
], StaffController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('profile/:staffId'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('staffId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StaffController.prototype, "findOneStaff", null);
__decorate([
    (0, common_1.Patch)('profile/:staffId'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('staffId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_staff_dto_1.UpdateStaffDto]),
    __metadata("design:returntype", Promise)
], StaffController.prototype, "updateStaff", null);
__decorate([
    (0, common_1.Patch)('profile/:staffId/deactivate'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('staffId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StaffController.prototype, "deactivateStaff", null);
__decorate([
    (0, common_1.Patch)('profile/:staffId/activate'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('staffId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StaffController.prototype, "activateStaff", null);
__decorate([
    (0, common_1.Delete)('profile/:staffId'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('staffId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StaffController.prototype, "deleteStaff", null);
__decorate([
    (0, common_1.Post)('assign-customer'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [assign_customer_dto_1.AssignCustomerDto]),
    __metadata("design:returntype", Promise)
], StaffController.prototype, "assignCustomer", null);
__decorate([
    (0, common_1.Get)('my-customers'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, get_user_decorator_1.GetUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StaffController.prototype, "getMyCustomers", null);
__decorate([
    (0, common_1.Get)('performance'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, get_user_decorator_1.GetUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StaffController.prototype, "getMyPerformance", null);
__decorate([
    (0, common_1.Get)('performance/:id'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StaffController.prototype, "getStaffPerformance", null);
__decorate([
    (0, common_1.Get)('leaderboard'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StaffController.prototype, "getLeaderboard", null);
__decorate([
    (0, common_1.Get)('attendance'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Query)('staffId')),
    __param(2, (0, common_1.Query)('startDate')),
    __param(3, (0, common_1.Query)('endDate')),
    __param(4, (0, common_1.Query)('page')),
    __param(5, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, Number, Number]),
    __metadata("design:returntype", Promise)
], StaffController.prototype, "getAttendance", null);
__decorate([
    (0, common_1.Post)('attendance/mark'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, get_user_decorator_1.GetUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [mark_attendance_dto_1.MarkAttendanceDto, String]),
    __metadata("design:returntype", Promise)
], StaffController.prototype, "markAttendance", null);
__decorate([
    (0, common_1.Post)('attendance/check-in'),
    (0, roles_decorator_1.Roles)(client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, get_user_decorator_1.GetUser)('id')),
    __param(1, (0, common_1.Body)('note')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], StaffController.prototype, "checkIn", null);
__decorate([
    (0, common_1.Post)('attendance/check-out'),
    (0, roles_decorator_1.Roles)(client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, get_user_decorator_1.GetUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StaffController.prototype, "checkOut", null);
__decorate([
    (0, common_1.Post)('leave/request'),
    (0, roles_decorator_1.Roles)(client_1.UserType.STAFF, client_1.UserType.SUPER_ADMIN),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, get_user_decorator_1.GetUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_leave_request_dto_1.CreateLeaveRequestDto, String]),
    __metadata("design:returntype", Promise)
], StaffController.prototype, "createLeave", null);
__decorate([
    (0, common_1.Get)('leave'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number]),
    __metadata("design:returntype", Promise)
], StaffController.prototype, "getLeaveRequests", null);
__decorate([
    (0, common_1.Patch)('leave/:id/approve'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, get_user_decorator_1.GetUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], StaffController.prototype, "approveLeave", null);
__decorate([
    (0, common_1.Patch)('leave/:id/reject'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, get_user_decorator_1.GetUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], StaffController.prototype, "rejectLeave", null);
__decorate([
    (0, common_1.Get)('payroll'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Query)('staffId')),
    __param(1, (0, common_1.Query)('month')),
    __param(2, (0, common_1.Query)('year')),
    __param(3, (0, common_1.Query)('page')),
    __param(4, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, Number, Number, Number]),
    __metadata("design:returntype", Promise)
], StaffController.prototype, "getPayrolls", null);
__decorate([
    (0, common_1.Patch)('payroll/:id/mark-paid'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, get_user_decorator_1.GetUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], StaffController.prototype, "markPayrollPaid", null);
__decorate([
    (0, common_1.Post)('payroll/calculate/:staffId'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('staffId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, get_user_decorator_1.GetUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], StaffController.prototype, "calculatePayroll", null);
__decorate([
    (0, common_1.Patch)('payroll/:id'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, get_user_decorator_1.GetUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], StaffController.prototype, "updatePayroll", null);
__decorate([
    (0, common_1.Delete)('payroll/:id'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StaffController.prototype, "deletePayroll", null);
exports.StaffController = StaffController = __decorate([
    (0, common_1.Controller)('staff'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [staff_service_1.StaffService])
], StaffController);
//# sourceMappingURL=staff.controller.js.map