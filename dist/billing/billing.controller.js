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
exports.BillingController = void 0;
const common_1 = require("@nestjs/common");
const billing_service_1 = require("./billing.service");
const pdf_service_1 = require("./pdf.service");
const record_payment_dto_1 = require("./dto/record-payment.dto");
const query_billing_dto_1 = require("./dto/query-billing.dto");
const create_credit_debit_note_dto_1 = require("./dto/create-credit-debit-note.dto");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const client_1 = require("@prisma/client");
let BillingController = class BillingController {
    billingService;
    pdfService;
    constructor(billingService, pdfService) {
        this.billingService = billingService;
        this.pdfService = pdfService;
    }
    async generateInvoice(orderId, userId) {
        return this.billingService.generateInvoice(orderId, userId);
    }
    async findAllInvoices(query, user) {
        const customerId = user.userType === client_1.UserType.CUSTOMER ? user.customerId : undefined;
        return this.billingService.findAllInvoices(query, customerId);
    }
    async findOneInvoice(id, user) {
        const customerId = user.userType === client_1.UserType.CUSTOMER ? user.customerId : undefined;
        return this.billingService.findOneInvoice(id, customerId);
    }
    async downloadInvoicePdf(id, user, res) {
        const customerId = user.userType === client_1.UserType.CUSTOMER ? user.customerId : undefined;
        const invoice = await this.billingService.findOneInvoice(id, customerId);
        const pdfBuffer = await this.pdfService.generateInvoicePdf(invoice);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`,
            'Content-Length': pdfBuffer.length,
        });
        res.end(pdfBuffer);
    }
    async recordPayment(dto, user) {
        const isStaff = user.userType === client_1.UserType.SUPER_ADMIN ||
            user.userType === client_1.UserType.STAFF;
        return this.billingService.recordPayment(dto, user.id, isStaff);
    }
    async findAllPayments(query, user) {
        const customerId = user.userType === client_1.UserType.CUSTOMER ? user.customerId : undefined;
        return this.billingService.findAllPayments(query, customerId);
    }
    async createCreditNote(dto, userId) {
        return this.billingService.createCreditNote(dto, userId);
    }
    async createDebitNote(dto, userId) {
        return this.billingService.createDebitNote(dto, userId);
    }
    async verifyPayment(id, userId) {
        return this.billingService.verifyPayment(id, userId);
    }
    async rejectPayment(id, userId) {
        return this.billingService.rejectPayment(id, userId);
    }
    async updateLedgerEntry(id, body) {
        return this.billingService.updateLedgerEntry(id, body);
    }
    async deleteLedgerEntry(id) {
        return this.billingService.deleteLedgerEntry(id);
    }
    async updatePayment(id, body) {
        return this.billingService.updatePayment(id, body);
    }
    async deletePayment(id) {
        return this.billingService.deletePayment(id);
    }
    async clearAllAccountsData() {
        return this.billingService.clearAllAccountsData();
    }
    async findAllLedgerEntries(query, user) {
        const customerId = user.userType === client_1.UserType.CUSTOMER ? user.customerId : undefined;
        return this.billingService.findAllLedgerEntries(query, customerId);
    }
    async getCustomerBalance(user, queryCustomerId) {
        let customerId = user.customerId;
        if (user.userType !== client_1.UserType.CUSTOMER && queryCustomerId) {
            customerId = queryCustomerId;
        }
        return this.billingService.getCustomerBalance(customerId);
    }
    async exportLedger(customerId, res) {
        const buffer = await this.billingService.exportLedger(customerId);
        const dateStr = new Date().toISOString().split('T')[0];
        const filename = `Ledger_Export_${dateStr}.xlsx`;
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': buffer.length,
        });
        res.end(buffer);
    }
    async updateCreditDebitNote(id, body) {
        return this.billingService.updateCreditDebitNote(id, body);
    }
    async deleteCreditDebitNote(id) {
        return this.billingService.deleteCreditDebitNote(id);
    }
};
exports.BillingController = BillingController;
__decorate([
    (0, common_1.Post)('invoice/generate/:orderId'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Param)('orderId')),
    __param(1, (0, get_user_decorator_1.GetUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "generateInvoice", null);
__decorate([
    (0, common_1.Get)('invoice'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [query_billing_dto_1.QueryBillingDto, Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "findAllInvoices", null);
__decorate([
    (0, common_1.Get)('invoice/:id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "findOneInvoice", null);
__decorate([
    (0, common_1.Get)('invoice/:id/pdf'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "downloadInvoicePdf", null);
__decorate([
    (0, common_1.Post)('payment'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [record_payment_dto_1.RecordPaymentDto, Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "recordPayment", null);
__decorate([
    (0, common_1.Get)('payment'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [query_billing_dto_1.QueryBillingDto, Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "findAllPayments", null);
__decorate([
    (0, common_1.Post)('ledger/credit-note'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, get_user_decorator_1.GetUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_credit_debit_note_dto_1.CreateCreditDebitNoteDto, String]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "createCreditNote", null);
__decorate([
    (0, common_1.Post)('ledger/debit-note'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, get_user_decorator_1.GetUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_credit_debit_note_dto_1.CreateCreditDebitNoteDto, String]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "createDebitNote", null);
__decorate([
    (0, common_1.Post)('payment/:id/verify'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, get_user_decorator_1.GetUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "verifyPayment", null);
__decorate([
    (0, common_1.Post)('payment/:id/reject'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, get_user_decorator_1.GetUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "rejectPayment", null);
__decorate([
    (0, common_1.Patch)('ledger/:id'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "updateLedgerEntry", null);
__decorate([
    (0, common_1.Delete)('ledger/:id'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "deleteLedgerEntry", null);
__decorate([
    (0, common_1.Patch)('payment/:id'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "updatePayment", null);
__decorate([
    (0, common_1.Delete)('payment/:id'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "deletePayment", null);
__decorate([
    (0, common_1.Delete)('clear-all'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "clearAllAccountsData", null);
__decorate([
    (0, common_1.Get)('ledger'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [query_billing_dto_1.QueryBillingDto, Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "findAllLedgerEntries", null);
__decorate([
    (0, common_1.Get)('balance'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Query)('customerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "getCustomerBalance", null);
__decorate([
    (0, common_1.Get)('ledger/export'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Query)('customerId')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "exportLedger", null);
__decorate([
    (0, common_1.Patch)('credit-debit-note/:id'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "updateCreditDebitNote", null);
__decorate([
    (0, common_1.Delete)('credit-debit-note/:id'),
    (0, roles_decorator_1.Roles)(client_1.UserType.SUPER_ADMIN, client_1.UserType.STAFF),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "deleteCreditDebitNote", null);
exports.BillingController = BillingController = __decorate([
    (0, common_1.Controller)('billing'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [billing_service_1.BillingService,
        pdf_service_1.PdfService])
], BillingController);
//# sourceMappingURL=billing.controller.js.map