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
Object.defineProperty(exports, "__esModule", { value: true });
exports.StartImportDto = void 0;
const class_validator_1 = require("class-validator");
const is_r2_url_decorator_1 = require("../../upload/decorators/is-r2-url.decorator");
class StartImportDto {
    fileUrl;
    importType;
    rows;
}
exports.StartImportDto = StartImportDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, is_r2_url_decorator_1.IsR2Url)(),
    __metadata("design:type", String)
], StartImportDto.prototype, "fileUrl", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(['PRODUCT_CREATE', 'PRODUCT_UPDATE', 'PRICE_UPDATE', 'STOCK_UPDATE']),
    __metadata("design:type", String)
], StartImportDto.prototype, "importType", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", Array)
], StartImportDto.prototype, "rows", void 0);
//# sourceMappingURL=start-import.dto.js.map