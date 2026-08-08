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
exports.OrderController = void 0;
const common_1 = require("@nestjs/common");
const order_service_1 = require("./order.service");
const checkout_dto_1 = require("./dto/checkout.dto");
const query_order_dto_1 = require("./dto/query-order.dto");
const update_order_status_dto_1 = require("./dto/update-order-status.dto");
const update_order_items_dto_1 = require("./dto/update-order-items.dto");
const pos_checkout_dto_1 = require("./dto/pos-checkout.dto");
const cancel_order_dto_1 = require("./dto/cancel-order.dto");
const create_shipment_dto_1 = require("./dto/create-shipment.dto");
const create_packing_slip_dto_1 = require("./dto/create-packing-slip.dto");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const client_1 = require("@prisma/client");
let OrderController = class OrderController {
    orderService;
    constructor(orderService) {
        this.orderService = orderService;
    }
    async checkout(customerId, contactId, dto) {
        return this.orderService.checkout(customerId, contactId, dto);
    }
    async posCheckout(dto, userId, req) {
        console.log('[OrderController] posCheckout hit, user:', req.user, 'userId:', userId, 'headers:', req.headers);
        return this.orderService.posCheckout(dto, userId);
    }
    async findAll(query, user) {
        const customerId = user.userType === client_1.UserType.CUSTOMER ? user.customerId : undefined;
        return this.orderService.findAll(query, customerId);
    }
    async findOne(id, user) {
        const customerId = user.userType === client_1.UserType.CUSTOMER ? user.customerId : undefined;
        return this.orderService.findOne(id, customerId);
    }
    async bulkUpdateStatus(dto, userId) {
        return this.orderService.bulkUpdateStatus(dto.ids, dto.status, userId);
    }
    async updateStatus(id, dto, userId) {
        return this.orderService.updateStatus(id, dto.status, userId);
    }
    async updateItems(id, dto, userId) {
        return this.orderService.updateOrderItems(id, dto, userId);
    }
    async cancel(id, dto, userId, user) {
        const customerId = user.userType === client_1.UserType.CUSTOMER ? user.customerId : undefined;
        return this.orderService.cancel(id, dto.reason, userId, customerId);
    }
    async approveBackorder(id, userId) {
        return this.orderService.approveBackorder(id, userId);
    }
    async packOrder(id, dto, userId) {
        return this.orderService.createPackingSlip(id, dto.notes, userId);
    }
    async shipOrder(id, dto, userId) {
        return this.orderService.createShipment(id, dto, userId);
    }
    async markDelivered(id, userId) {
        return this.orderService.markDelivered(id, userId);
    }
    async removeMany(data) {
        if (!data.ids || !Array.isArray(data.ids) || data.ids.length === 0) {
            return { deletedCount: 0 };
        }
        return this.orderService.removeMany(data.ids);
    }
    async remove(id) {
        return this.orderService.remove(id);
    }
};
exports.OrderController = OrderController;
__decorate([
    (0, common_1.Post)('checkout'),
    (0, roles_decorator_1.Roles)(client_1.UserType.CUSTOMER),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, get_user_decorator_1.GetUser)('customerId')),
    __param(1, (0, get_user_decorator_1.GetUser)('contactId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, checkout_dto_1.CheckoutDto]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "checkout", null);
__decorate([
    (0, common_1.Post)('pos-checkout'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, get_user_decorator_1.GetUser)('id')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [pos_checkout_dto_1.PosCheckoutDto, String, Object]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "posCheckout", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [query_order_dto_1.QueryOrderDto, Object]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)('bulk-status'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, get_user_decorator_1.GetUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "bulkUpdateStatus", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, get_user_decorator_1.GetUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_order_status_dto_1.UpdateOrderStatusDto, String]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "updateStatus", null);
__decorate([
    (0, common_1.Patch)(':id/items'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, get_user_decorator_1.GetUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_order_items_dto_1.UpdateOrderItemsDto, String]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "updateItems", null);
__decorate([
    (0, common_1.Post)(':id/cancel'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, get_user_decorator_1.GetUser)('id')),
    __param(3, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, cancel_order_dto_1.CancelOrderDto, String, Object]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "cancel", null);
__decorate([
    (0, common_1.Patch)(':id/backorder/approve'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, get_user_decorator_1.GetUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "approveBackorder", null);
__decorate([
    (0, common_1.Post)(':id/pack'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, get_user_decorator_1.GetUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_packing_slip_dto_1.CreatePackingSlipDto, String]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "packOrder", null);
__decorate([
    (0, common_1.Post)(':id/ship'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, get_user_decorator_1.GetUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_shipment_dto_1.CreateShipmentDto, String]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "shipOrder", null);
__decorate([
    (0, common_1.Patch)(':id/deliver'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, get_user_decorator_1.GetUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "markDelivered", null);
__decorate([
    (0, common_1.Post)('bulk-delete'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "removeMany", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "remove", null);
exports.OrderController = OrderController = __decorate([
    (0, common_1.Controller)('order'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [order_service_1.OrderService])
], OrderController);
//# sourceMappingURL=order.controller.js.map