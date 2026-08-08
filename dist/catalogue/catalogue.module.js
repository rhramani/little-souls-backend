"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogueModule = void 0;
const common_1 = require("@nestjs/common");
const catalogue_service_1 = require("./catalogue.service");
const catalogue_controller_1 = require("./catalogue.controller");
const prisma_module_1 = require("../prisma/prisma.module");
const auth_module_1 = require("../auth/auth.module");
const upload_module_1 = require("../upload/upload.module");
const notification_module_1 = require("../notification/notification.module");
const image_cleaning_module_1 = require("../image-cleaning/image-cleaning.module");
let CatalogueModule = class CatalogueModule {
};
exports.CatalogueModule = CatalogueModule;
exports.CatalogueModule = CatalogueModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            auth_module_1.AuthModule,
            upload_module_1.UploadModule,
            notification_module_1.NotificationModule,
            image_cleaning_module_1.ImageCleaningModule,
        ],
        providers: [catalogue_service_1.CatalogueService],
        controllers: [catalogue_controller_1.CatalogueController],
        exports: [catalogue_service_1.CatalogueService],
    })
], CatalogueModule);
//# sourceMappingURL=catalogue.module.js.map