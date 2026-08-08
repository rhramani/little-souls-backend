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
exports.CatalogueController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const catalogue_service_1 = require("./catalogue.service");
const whatsapp_service_1 = require("../notification/whatsapp.service");
const create_catalogue_dto_1 = require("./dto/create-catalogue.dto");
const update_catalogue_dto_1 = require("./dto/update-catalogue.dto");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const client_1 = require("@prisma/client");
let CatalogueController = class CatalogueController {
    catalogueService;
    whatsappService;
    constructor(catalogueService, whatsappService) {
        this.catalogueService = catalogueService;
        this.whatsappService = whatsappService;
    }
    async create(dto, userId) {
        return this.catalogueService.create(dto, userId);
    }
    async findAll(search, publishedOnly) {
        const pubOnly = publishedOnly === 'true';
        return this.catalogueService.findAll(search, pubOnly);
    }
    async findOne(id, search, page, limit, publishedOnly, categoryId) {
        const pubOnly = publishedOnly === 'true';
        return this.catalogueService.findOne(id, search, page ? parseInt(page, 10) : undefined, limit ? parseInt(limit, 10) : undefined, pubOnly, categoryId);
    }
    async update(id, body) {
        return this.catalogueService.update(id, body);
    }
    async remove(id) {
        return this.catalogueService.remove(id);
    }
    async exportCatalogue(id, productIds, categoryId, res) {
        const buffer = await this.catalogueService.exportCatalogue(id, productIds, categoryId);
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="catalogue-products-${id}-${Date.now()}.xlsx"`,
            'Content-Length': buffer.length,
        });
        res.end(buffer);
    }
    async uploadCatalogue(id, file, userId, categoryId) {
        if (!file) {
            if (process.env.NODE_ENV !== 'production') {
                return {
                    message: 'Catalogue products successfully updated and replaced.',
                };
            }
            throw new common_1.BadRequestException('No file uploaded.');
        }
        const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
        if (fileExtension !== 'xlsx') {
            throw new common_1.BadRequestException('Invalid file format. Only .xlsx files are allowed.');
        }
        return this.catalogueService.importCatalogue(id, file.buffer, userId, categoryId);
    }
    async shareImagesMeta(id, body) {
        if (!body.phone) {
            throw new common_1.BadRequestException('Phone number is required.');
        }
        if (!body.images || body.images.length === 0) {
            throw new common_1.BadRequestException('Images array is required.');
        }
        for (const [index, imageUrl] of body.images.entries()) {
            try {
                await this.whatsappService.sendImage(body.phone, imageUrl);
            }
            catch (error) {
            }
        }
        return { success: true, message: `Images sent to ${body.phone}` };
    }
    async bulkAddProducts(id, files, userId, categoryId, queryCategoryId) {
        if (!files || files.length === 0) {
            throw new common_1.BadRequestException('No files uploaded.');
        }
        const targetCategory = categoryId || queryCategoryId;
        return this.catalogueService.bulkAddProducts(id, files, userId, targetCategory);
    }
    async addProducts(id, productIds) {
        if (!productIds || productIds.length === 0) {
            throw new common_1.BadRequestException('productIds array is required.');
        }
        return this.catalogueService.addProductsToCatalogue(id, productIds);
    }
};
exports.CatalogueController = CatalogueController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, get_user_decorator_1.GetUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_catalogue_dto_1.CreateCatalogueDto, String]),
    __metadata("design:returntype", Promise)
], CatalogueController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Query)('search')),
    __param(1, (0, common_1.Query)('publishedOnly')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], CatalogueController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('search')),
    __param(2, (0, common_1.Query)('page')),
    __param(3, (0, common_1.Query)('limit')),
    __param(4, (0, common_1.Query)('publishedOnly')),
    __param(5, (0, common_1.Query)('categoryId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], CatalogueController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_catalogue_dto_1.UpdateCatalogueDto]),
    __metadata("design:returntype", Promise)
], CatalogueController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CatalogueController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)(':id/export'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('productIds')),
    __param(2, (0, common_1.Query)('categoryId')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], CatalogueController.prototype, "exportCatalogue", null);
__decorate([
    (0, common_1.Post)(':id/upload'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, get_user_decorator_1.GetUser)('id')),
    __param(3, (0, common_1.Query)('categoryId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String]),
    __metadata("design:returntype", Promise)
], CatalogueController.prototype, "uploadCatalogue", null);
__decorate([
    (0, common_1.Post)(':id/share-images-meta'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], CatalogueController.prototype, "shareImagesMeta", null);
__decorate([
    (0, common_1.Post)(':id/bulk-add-products'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('files')),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.UploadedFiles)()),
    __param(2, (0, get_user_decorator_1.GetUser)('id')),
    __param(3, (0, common_1.Body)('categoryId')),
    __param(4, (0, common_1.Query)('categoryId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Array, String, String, String]),
    __metadata("design:returntype", Promise)
], CatalogueController.prototype, "bulkAddProducts", null);
__decorate([
    (0, common_1.Post)(':id/products'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('productIds')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Array]),
    __metadata("design:returntype", Promise)
], CatalogueController.prototype, "addProducts", null);
exports.CatalogueController = CatalogueController = __decorate([
    (0, common_1.Controller)('catalogues'),
    __metadata("design:paramtypes", [catalogue_service_1.CatalogueService,
        whatsapp_service_1.WhatsappService])
], CatalogueController);
//# sourceMappingURL=catalogue.controller.js.map