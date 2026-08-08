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
exports.SupportController = void 0;
const common_1 = require("@nestjs/common");
const support_service_1 = require("./support.service");
const create_ticket_dto_1 = require("./dto/create-ticket.dto");
const query_ticket_dto_1 = require("./dto/query-ticket.dto");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const client_1 = require("@prisma/client");
let SupportController = class SupportController {
    supportService;
    constructor(supportService) {
        this.supportService = supportService;
    }
    async createTicket(dto, user) {
        return this.supportService.createTicket(dto, user);
    }
    async findAll(query, user) {
        return this.supportService.findAll(query, user);
    }
    async findOne(id, user) {
        return this.supportService.findOne(id, user);
    }
    async assignTicket(id, assignedTo) {
        return this.supportService.assignTicket(id, assignedTo);
    }
    async transitionStatus(id, status) {
        return this.supportService.transitionStatus(id, status);
    }
    async updatePriority(id, priority) {
        return this.supportService.updatePriority(id, priority);
    }
};
exports.SupportController = SupportController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_ticket_dto_1.CreateTicketDto, Object]),
    __metadata("design:returntype", Promise)
], SupportController.prototype, "createTicket", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [query_ticket_dto_1.QueryTicketDto, Object]),
    __metadata("design:returntype", Promise)
], SupportController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], SupportController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id/assign'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('assignedTo')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], SupportController.prototype, "assignTicket", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], SupportController.prototype, "transitionStatus", null);
__decorate([
    (0, common_1.Patch)(':id/priority'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('priority')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], SupportController.prototype, "updatePriority", null);
exports.SupportController = SupportController = __decorate([
    (0, common_1.Controller)('support'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [support_service_1.SupportService])
], SupportController);
//# sourceMappingURL=support.controller.js.map