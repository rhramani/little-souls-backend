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
exports.UpdateCategoryDto = void 0;
const class_validator_1 = require("class-validator");
const is_r2_url_decorator_1 = require("../../upload/decorators/is-r2-url.decorator");
class UpdateCategoryDto {
    name;
    slug;
    description;
    parentCategoryId;
    imageUrl;
    bannerUrl;
    isActive;
    sortOrder;
}
exports.UpdateCategoryDto = UpdateCategoryDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateCategoryDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateCategoryDto.prototype, "slug", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateCategoryDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsMongoId)({ message: 'Parent Category ID must be a valid Mongo ID' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateCategoryDto.prototype, "parentCategoryId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, is_r2_url_decorator_1.IsR2Url)(),
    __metadata("design:type", String)
], UpdateCategoryDto.prototype, "imageUrl", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, is_r2_url_decorator_1.IsR2Url)(),
    __metadata("design:type", String)
], UpdateCategoryDto.prototype, "bannerUrl", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], UpdateCategoryDto.prototype, "isActive", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], UpdateCategoryDto.prototype, "sortOrder", void 0);
//# sourceMappingURL=update-category.dto.js.map