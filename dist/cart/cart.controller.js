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
exports.CartController = void 0;
const common_1 = require("@nestjs/common");
const cart_service_1 = require("./cart.service");
const add_to_cart_dto_1 = require("./dto/add-to-cart.dto");
const update_cart_item_dto_1 = require("./dto/update-cart-item.dto");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
let CartController = class CartController {
    cartService;
    constructor(cartService) {
        this.cartService = cartService;
    }
    async getCart(customerId, contactId) {
        return this.cartService.getOrCreateCart(customerId, contactId);
    }
    async addToCart(customerId, contactId, dto) {
        return this.cartService.addToCart(customerId, contactId, dto);
    }
    async updateItemQuantity(customerId, contactId, cartItemId, dto) {
        return this.cartService.updateItemQuantity(customerId, contactId, cartItemId, dto);
    }
    async removeItem(customerId, contactId, cartItemId) {
        return this.cartService.removeItem(customerId, contactId, cartItemId);
    }
    async clearCart(customerId, contactId) {
        return this.cartService.clearCart(customerId, contactId);
    }
};
exports.CartController = CartController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, get_user_decorator_1.GetUser)('customerId')),
    __param(1, (0, get_user_decorator_1.GetUser)('contactId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], CartController.prototype, "getCart", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, get_user_decorator_1.GetUser)('customerId')),
    __param(1, (0, get_user_decorator_1.GetUser)('contactId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, add_to_cart_dto_1.AddToCartDto]),
    __metadata("design:returntype", Promise)
], CartController.prototype, "addToCart", null);
__decorate([
    (0, common_1.Patch)('item/:id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, get_user_decorator_1.GetUser)('customerId')),
    __param(1, (0, get_user_decorator_1.GetUser)('contactId')),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, update_cart_item_dto_1.UpdateCartItemDto]),
    __metadata("design:returntype", Promise)
], CartController.prototype, "updateItemQuantity", null);
__decorate([
    (0, common_1.Delete)('item/:id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, get_user_decorator_1.GetUser)('customerId')),
    __param(1, (0, get_user_decorator_1.GetUser)('contactId')),
    __param(2, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], CartController.prototype, "removeItem", null);
__decorate([
    (0, common_1.Delete)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, get_user_decorator_1.GetUser)('customerId')),
    __param(1, (0, get_user_decorator_1.GetUser)('contactId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], CartController.prototype, "clearCart", null);
exports.CartController = CartController = __decorate([
    (0, common_1.Controller)('cart'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [cart_service_1.CartService])
], CartController);
//# sourceMappingURL=cart.controller.js.map