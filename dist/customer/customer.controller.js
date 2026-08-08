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
exports.CustomerController = void 0;
const common_1 = require("@nestjs/common");
const customer_service_1 = require("./customer.service");
const query_customer_dto_1 = require("./dto/query-customer.dto");
const approve_customer_dto_1 = require("./dto/approve-customer.dto");
const reject_customer_dto_1 = require("./dto/reject-customer.dto");
const update_customer_dto_1 = require("./dto/update-customer.dto");
const create_customer_dto_1 = require("./dto/create-customer.dto");
const create_contact_dto_1 = require("./dto/create-contact.dto");
const update_contact_dto_1 = require("./dto/update-contact.dto");
const set_opening_balance_dto_1 = require("./dto/set-opening-balance.dto");
const provision_contact_login_dto_1 = require("./dto/provision-contact-login.dto");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const client_1 = require("@prisma/client");
let CustomerController = class CustomerController {
    customerService;
    constructor(customerService) {
        this.customerService = customerService;
    }
    async findAll(query) {
        return this.customerService.findAll(query);
    }
    async create(dto, adminId) {
        return this.customerService.create(dto, adminId);
    }
    async findOne(id) {
        return this.customerService.findOne(id);
    }
    async update(id, dto) {
        return this.customerService.update(id, dto);
    }
    async approve(id, dto, adminId) {
        return this.customerService.approve(id, dto, adminId);
    }
    async reject(id, dto, adminId) {
        return this.customerService.reject(id, dto, adminId);
    }
    async deactivate(id) {
        return this.customerService.deactivate(id);
    }
    async activate(id) {
        return this.customerService.activate(id);
    }
    async remove(id) {
        return this.customerService.remove(id);
    }
    async setOpeningBalance(id, dto, userId) {
        return this.customerService.setOpeningBalance(id, dto, userId);
    }
    async getContacts(id) {
        return this.customerService.getContacts(id);
    }
    async addContact(id, dto) {
        return this.customerService.addContact(id, dto);
    }
    async updateContact(id, contactId, dto) {
        return this.customerService.updateContact(id, contactId, dto);
    }
    async removeContact(id, contactId) {
        return this.customerService.removeContact(id, contactId);
    }
    async provisionContactLogin(id, contactId, dto) {
        return this.customerService.provisionContactLogin(id, contactId, dto);
    }
};
exports.CustomerController = CustomerController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [query_customer_dto_1.QueryCustomerDto]),
    __metadata("design:returntype", Promise)
], CustomerController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, get_user_decorator_1.GetUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_customer_dto_1.CreateCustomerDto, String]),
    __metadata("design:returntype", Promise)
], CustomerController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CustomerController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_customer_dto_1.UpdateCustomerDto]),
    __metadata("design:returntype", Promise)
], CustomerController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(':id/approve'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, get_user_decorator_1.GetUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, approve_customer_dto_1.ApproveCustomerDto, String]),
    __metadata("design:returntype", Promise)
], CustomerController.prototype, "approve", null);
__decorate([
    (0, common_1.Patch)(':id/reject'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, get_user_decorator_1.GetUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, reject_customer_dto_1.RejectCustomerDto, String]),
    __metadata("design:returntype", Promise)
], CustomerController.prototype, "reject", null);
__decorate([
    (0, common_1.Patch)(':id/deactivate'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CustomerController.prototype, "deactivate", null);
__decorate([
    (0, common_1.Patch)(':id/activate'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CustomerController.prototype, "activate", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CustomerController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/opening-balance'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, get_user_decorator_1.GetUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, set_opening_balance_dto_1.SetOpeningBalanceDto, String]),
    __metadata("design:returntype", Promise)
], CustomerController.prototype, "setOpeningBalance", null);
__decorate([
    (0, common_1.Get)(':id/contact'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CustomerController.prototype, "getContacts", null);
__decorate([
    (0, common_1.Post)(':id/contact'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_contact_dto_1.CreateContactDto]),
    __metadata("design:returntype", Promise)
], CustomerController.prototype, "addContact", null);
__decorate([
    (0, common_1.Patch)(':id/contact/:contactId'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('contactId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_contact_dto_1.UpdateContactDto]),
    __metadata("design:returntype", Promise)
], CustomerController.prototype, "updateContact", null);
__decorate([
    (0, common_1.Delete)(':id/contact/:contactId'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('contactId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], CustomerController.prototype, "removeContact", null);
__decorate([
    (0, common_1.Post)(':id/contact/:contactId/provision-login'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('contactId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, provision_contact_login_dto_1.ProvisionContactLoginDto]),
    __metadata("design:returntype", Promise)
], CustomerController.prototype, "provisionContactLogin", null);
exports.CustomerController = CustomerController = __decorate([
    (0, common_1.Controller)('customer'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    __metadata("design:paramtypes", [customer_service_1.CustomerService])
], CustomerController);
//# sourceMappingURL=customer.controller.js.map