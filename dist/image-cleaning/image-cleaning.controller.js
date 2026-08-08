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
exports.ImageCleaningController = void 0;
const common_1 = require("@nestjs/common");
const image_cleaning_service_1 = require("./image-cleaning.service");
const submit_task_dto_1 = require("./dto/submit-task.dto");
const webhook_callback_dto_1 = require("./dto/webhook-callback.dto");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const client_1 = require("@prisma/client");
let ImageCleaningController = class ImageCleaningController {
    imageCleaningService;
    constructor(imageCleaningService) {
        this.imageCleaningService = imageCleaningService;
    }
    async submitTask(dto, userId) {
        return this.imageCleaningService.submitTask(dto, userId);
    }
    async handleWebhook(dto) {
        return this.imageCleaningService.handleWebhook(dto);
    }
};
exports.ImageCleaningController = ImageCleaningController;
__decorate([
    (0, common_1.Post)('submit'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, get_user_decorator_1.GetUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [submit_task_dto_1.SubmitTaskDto, String]),
    __metadata("design:returntype", Promise)
], ImageCleaningController.prototype, "submitTask", null);
__decorate([
    (0, common_1.Post)('webhook'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [webhook_callback_dto_1.WebhookCallbackDto]),
    __metadata("design:returntype", Promise)
], ImageCleaningController.prototype, "handleWebhook", null);
exports.ImageCleaningController = ImageCleaningController = __decorate([
    (0, common_1.Controller)('image-cleaning'),
    __metadata("design:paramtypes", [image_cleaning_service_1.ImageCleaningService])
], ImageCleaningController);
//# sourceMappingURL=image-cleaning.controller.js.map