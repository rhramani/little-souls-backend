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
exports.CustomerMeController = void 0;
const common_1 = require("@nestjs/common");
const customer_service_1 = require("./customer.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const client_1 = require("@prisma/client");
const update_customer_dto_1 = require("./dto/update-customer.dto");
const create_contact_dto_1 = require("./dto/create-contact.dto");
const update_contact_dto_1 = require("./dto/update-contact.dto");
let CustomerMeController = class CustomerMeController {
    customerService;
    constructor(customerService) {
        this.customerService = customerService;
    }
    async getMyProfile(customerId) {
        if (!customerId) {
            throw new common_1.ForbiddenException('User is not associated with a customer account');
        }
        return this.customerService.findOne(customerId);
    }
    async updateMyProfile(customerId, dto) {
        if (!customerId) {
            throw new common_1.ForbiddenException('User is not associated with a customer account');
        }
        return this.customerService.update(customerId, dto);
    }
    async addMyContact(customerId, dto) {
        if (!customerId) {
            throw new common_1.ForbiddenException('User is not associated with a customer account');
        }
        return this.customerService.addContact(customerId, dto);
    }
    async updateMyContact(customerId, contactId, dto) {
        if (!customerId) {
            throw new common_1.ForbiddenException('User is not associated with a customer account');
        }
        return this.customerService.updateContact(customerId, contactId, dto);
    }
    async removeMyContact(customerId, contactId) {
        if (!customerId) {
            throw new common_1.ForbiddenException('User is not associated with a customer account');
        }
        return this.customerService.removeContact(customerId, contactId);
    }
};
exports.CustomerMeController = CustomerMeController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, get_user_decorator_1.GetUser)('customerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CustomerMeController.prototype, "getMyProfile", null);
__decorate([
    (0, common_1.Patch)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, get_user_decorator_1.GetUser)('customerId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_customer_dto_1.UpdateCustomerDto]),
    __metadata("design:returntype", Promise)
], CustomerMeController.prototype, "updateMyProfile", null);
__decorate([
    (0, common_1.Post)('contact'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, get_user_decorator_1.GetUser)('customerId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_contact_dto_1.CreateContactDto]),
    __metadata("design:returntype", Promise)
], CustomerMeController.prototype, "addMyContact", null);
__decorate([
    (0, common_1.Patch)('contact/:contactId'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, get_user_decorator_1.GetUser)('customerId')),
    __param(1, (0, common_1.Param)('contactId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_contact_dto_1.UpdateContactDto]),
    __metadata("design:returntype", Promise)
], CustomerMeController.prototype, "updateMyContact", null);
__decorate([
    (0, common_1.Delete)('contact/:contactId'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, get_user_decorator_1.GetUser)('customerId')),
    __param(1, (0, common_1.Param)('contactId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], CustomerMeController.prototype, "removeMyContact", null);
exports.CustomerMeController = CustomerMeController = __decorate([
    (0, common_1.Controller)('customer/me'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserType.CUSTOMER),
    __metadata("design:paramtypes", [customer_service_1.CustomerService])
], CustomerMeController);
//# sourceMappingURL=customer-me.controller.js.map