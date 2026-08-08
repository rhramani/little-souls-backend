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
exports.PricingController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const pricing_service_1 = require("./pricing.service");
const create_pricing_group_dto_1 = require("./dto/create-pricing-group.dto");
const update_pricing_group_dto_1 = require("./dto/update-pricing-group.dto");
const set_product_pricing_dto_1 = require("./dto/set-product-pricing.dto");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const client_1 = require("@prisma/client");
let PricingController = class PricingController {
    pricingService;
    constructor(pricingService) {
        this.pricingService = pricingService;
    }
    async createGroup(dto) {
        return this.pricingService.createGroup(dto);
    }
    async findAllGroups() {
        return this.pricingService.findAllGroups();
    }
    async findOneGroup(id) {
        return this.pricingService.findOneGroup(id);
    }
    async updateGroup(id, dto) {
        return this.pricingService.updateGroup(id, dto);
    }
    async removeGroup(id) {
        return this.pricingService.removeGroup(id);
    }
    async setProductPrice(dto, userId) {
        return this.pricingService.setProductPrice(dto, userId);
    }
    async removeProductPrice(productId, pricingGroupId) {
        return this.pricingService.removeProductPrice(productId, pricingGroupId);
    }
    async bulkUpload(file, userId) {
        if (!file) {
            return { error: 'No file uploaded' };
        }
        return this.pricingService.bulkUploadPricing(file.buffer, userId);
    }
    async downloadTemplate(catalogueId, res) {
        const { buffer, filename } = await this.pricingService.generateTemplate(catalogueId);
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${filename}"`,
        });
        return new common_1.StreamableFile(Buffer.from(buffer));
    }
};
exports.PricingController = PricingController;
__decorate([
    (0, common_1.Post)('group'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_pricing_group_dto_1.CreatePricingGroupDto]),
    __metadata("design:returntype", Promise)
], PricingController.prototype, "createGroup", null);
__decorate([
    (0, common_1.Get)('group'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PricingController.prototype, "findAllGroups", null);
__decorate([
    (0, common_1.Get)('group/:id'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PricingController.prototype, "findOneGroup", null);
__decorate([
    (0, common_1.Patch)('group/:id'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_pricing_group_dto_1.UpdatePricingGroupDto]),
    __metadata("design:returntype", Promise)
], PricingController.prototype, "updateGroup", null);
__decorate([
    (0, common_1.Delete)('group/:id'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PricingController.prototype, "removeGroup", null);
__decorate([
    (0, common_1.Post)('setup'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, get_user_decorator_1.GetUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [set_product_pricing_dto_1.SetProductPricingDto, String]),
    __metadata("design:returntype", Promise)
], PricingController.prototype, "setProductPrice", null);
__decorate([
    (0, common_1.Delete)('price/:productId/:pricingGroupId'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('productId')),
    __param(1, (0, common_1.Param)('pricingGroupId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], PricingController.prototype, "removeProductPrice", null);
__decorate([
    (0, common_1.Post)('bulk-upload'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, get_user_decorator_1.GetUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PricingController.prototype, "bulkUpload", null);
__decorate([
    (0, common_1.Get)('template'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    __param(0, (0, common_1.Query)('catalogueId')),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PricingController.prototype, "downloadTemplate", null);
exports.PricingController = PricingController = __decorate([
    (0, common_1.Controller)('pricing'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [pricing_service_1.PricingService])
], PricingController);
//# sourceMappingURL=pricing.controller.js.map