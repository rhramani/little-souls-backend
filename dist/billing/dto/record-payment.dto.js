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
exports.RecordPaymentDto = void 0;
const class_validator_1 = require("class-validator");
const is_r2_url_decorator_1 = require("../../upload/decorators/is-r2-url.decorator");
class RecordPaymentDto {
    customerId;
    amount;
    paymentMode;
    transactionDate;
    referenceNumber;
    attachmentUrl;
    notes;
    paymentStatus;
}
exports.RecordPaymentDto = RecordPaymentDto;
__decorate([
    (0, class_validator_1.IsMongoId)(),
    __metadata("design:type", String)
], RecordPaymentDto.prototype, "customerId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.01),
    __metadata("design:type", Number)
], RecordPaymentDto.prototype, "amount", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER']),
    __metadata("design:type", String)
], RecordPaymentDto.prototype, "paymentMode", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RecordPaymentDto.prototype, "transactionDate", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RecordPaymentDto.prototype, "referenceNumber", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, is_r2_url_decorator_1.IsR2Url)(),
    __metadata("design:type", String)
], RecordPaymentDto.prototype, "attachmentUrl", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RecordPaymentDto.prototype, "notes", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RecordPaymentDto.prototype, "paymentStatus", void 0);
//# sourceMappingURL=record-payment.dto.js.map