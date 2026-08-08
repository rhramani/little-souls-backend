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
exports.PurchaseController = void 0;
const common_1 = require("@nestjs/common");
const purchase_service_1 = require("./purchase.service");
const purchase_dto_1 = require("./dto/purchase.dto");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const client_1 = require("@prisma/client");
let PurchaseController = class PurchaseController {
    purchaseService;
    constructor(purchaseService) {
        this.purchaseService = purchaseService;
    }
    async findAllSuppliers() {
        return this.purchaseService.findAllSuppliers();
    }
    async findOneSupplier(id) {
        return this.purchaseService.findOneSupplier(id);
    }
    async createSupplier(dto) {
        return this.purchaseService.createSupplier(dto);
    }
    async updateSupplier(id, dto) {
        return this.purchaseService.updateSupplier(id, dto);
    }
    async removeSupplier(id) {
        return this.purchaseService.removeSupplier(id);
    }
    async findAllPurchasedProducts() {
        return this.purchaseService.findAllPurchasedProducts();
    }
    async findOnePurchasedProduct(id) {
        return this.purchaseService.findOnePurchasedProduct(id);
    }
    async createPurchasedProduct(dto) {
        return this.purchaseService.createPurchasedProduct(dto);
    }
    async updatePurchasedProduct(id, dto) {
        return this.purchaseService.updatePurchasedProduct(id, dto);
    }
    async removePurchasedProduct(id) {
        return this.purchaseService.removePurchasedProduct(id);
    }
    async findAllPurchaseInvoices() {
        return this.purchaseService.findAllPurchaseInvoices();
    }
    async createPurchaseInvoice(dto) {
        return this.purchaseService.createPurchaseInvoice(dto);
    }
    async findAllSupplierPayments() {
        return this.purchaseService.findAllSupplierPayments();
    }
    async createSupplierPayment(dto) {
        return this.purchaseService.createSupplierPayment(dto);
    }
    async removeSupplierPayment(id) {
        return this.purchaseService.removeSupplierPayment(id);
    }
};
exports.PurchaseController = PurchaseController;
__decorate([
    (0, common_1.Get)('suppliers'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PurchaseController.prototype, "findAllSuppliers", null);
__decorate([
    (0, common_1.Get)('suppliers/:id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PurchaseController.prototype, "findOneSupplier", null);
__decorate([
    (0, common_1.Post)('suppliers'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [purchase_dto_1.CreateSupplierDto]),
    __metadata("design:returntype", Promise)
], PurchaseController.prototype, "createSupplier", null);
__decorate([
    (0, common_1.Patch)('suppliers/:id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, purchase_dto_1.UpdateSupplierDto]),
    __metadata("design:returntype", Promise)
], PurchaseController.prototype, "updateSupplier", null);
__decorate([
    (0, common_1.Delete)('suppliers/:id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PurchaseController.prototype, "removeSupplier", null);
__decorate([
    (0, common_1.Get)('products'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PurchaseController.prototype, "findAllPurchasedProducts", null);
__decorate([
    (0, common_1.Get)('products/:id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PurchaseController.prototype, "findOnePurchasedProduct", null);
__decorate([
    (0, common_1.Post)('products'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [purchase_dto_1.CreatePurchasedProductDto]),
    __metadata("design:returntype", Promise)
], PurchaseController.prototype, "createPurchasedProduct", null);
__decorate([
    (0, common_1.Patch)('products/:id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, purchase_dto_1.UpdatePurchasedProductDto]),
    __metadata("design:returntype", Promise)
], PurchaseController.prototype, "updatePurchasedProduct", null);
__decorate([
    (0, common_1.Delete)('products/:id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PurchaseController.prototype, "removePurchasedProduct", null);
__decorate([
    (0, common_1.Get)('invoices'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PurchaseController.prototype, "findAllPurchaseInvoices", null);
__decorate([
    (0, common_1.Post)('invoices'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [purchase_dto_1.CreatePurchaseInvoiceDto]),
    __metadata("design:returntype", Promise)
], PurchaseController.prototype, "createPurchaseInvoice", null);
__decorate([
    (0, common_1.Get)('payments'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PurchaseController.prototype, "findAllSupplierPayments", null);
__decorate([
    (0, common_1.Post)('payments'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [purchase_dto_1.CreateSupplierPaymentDto]),
    __metadata("design:returntype", Promise)
], PurchaseController.prototype, "createSupplierPayment", null);
__decorate([
    (0, common_1.Delete)('payments/:id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PurchaseController.prototype, "removeSupplierPayment", null);
exports.PurchaseController = PurchaseController = __decorate([
    (0, common_1.Controller)('purchase'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    __metadata("design:paramtypes", [purchase_service_1.PurchaseService])
], PurchaseController);
//# sourceMappingURL=purchase.controller.js.map