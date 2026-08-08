"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageCleaningModule = void 0;
const common_1 = require("@nestjs/common");
const image_cleaning_service_1 = require("./image-cleaning.service");
const image_cleaning_controller_1 = require("./image-cleaning.controller");
const upload_module_1 = require("../upload/upload.module");
let ImageCleaningModule = class ImageCleaningModule {
};
exports.ImageCleaningModule = ImageCleaningModule;
exports.ImageCleaningModule = ImageCleaningModule = __decorate([
    (0, common_1.Module)({
        imports: [upload_module_1.UploadModule],
        providers: [image_cleaning_service_1.ImageCleaningService],
        controllers: [image_cleaning_controller_1.ImageCleaningController],
        exports: [image_cleaning_service_1.ImageCleaningService],
    })
], ImageCleaningModule);
//# sourceMappingURL=image-cleaning.module.js.map