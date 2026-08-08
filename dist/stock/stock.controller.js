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
exports.StockController = void 0;
const common_1 = require("@nestjs/common");
const stock_service_1 = require("./stock.service");
const adjust_stock_dto_1 = require("./dto/adjust-stock.dto");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const client_1 = require("@prisma/client");
let StockController = class StockController {
    stockService;
    constructor(stockService) {
        this.stockService = stockService;
    }
    async adjust(dto, userId) {
        return this.stockService.adjustStock(dto, userId);
    }
    async setOpening(dto, userId) {
        return this.stockService.setOpeningStock(dto, userId);
    }
    async getMovements(productId, movementType, startDate, endDate, page, limit) {
        return this.stockService.getMovements(productId, movementType, startDate, endDate, Number(page) || 1, Number(limit) || 20);
    }
};
exports.StockController = StockController;
__decorate([
    (0, common_1.Post)('adjust'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, get_user_decorator_1.GetUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [adjust_stock_dto_1.AdjustStockDto, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "adjust", null);
__decorate([
    (0, common_1.Post)('opening'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, get_user_decorator_1.GetUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [adjust_stock_dto_1.OpeningStockDto, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "setOpening", null);
__decorate([
    (0, common_1.Get)('movements'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Query)('productId')),
    __param(1, (0, common_1.Query)('movementType')),
    __param(2, (0, common_1.Query)('startDate')),
    __param(3, (0, common_1.Query)('endDate')),
    __param(4, (0, common_1.Query)('page')),
    __param(5, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, Number, Number]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "getMovements", null);
exports.StockController = StockController = __decorate([
    (0, common_1.Controller)('stock'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    __metadata("design:paramtypes", [stock_service_1.StockService])
], StockController);
//# sourceMappingURL=stock.controller.js.map