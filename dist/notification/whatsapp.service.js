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
var WhatsappService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsappService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const config_1 = require("@nestjs/config");
const rxjs_1 = require("rxjs");
const axios_2 = require("axios");
let WhatsappService = WhatsappService_1 = class WhatsappService {
    httpService;
    configService;
    logger = new common_1.Logger(WhatsappService_1.name);
    apiUrl;
    phoneNumberId;
    accessToken;
    constructor(httpService, configService) {
        this.httpService = httpService;
        this.configService = configService;
        this.apiUrl =
            this.configService.get('WHATSAPP_API_URL') ||
                'https://graph.facebook.com/v17.0';
        this.phoneNumberId =
            this.configService.get('WHATSAPP_PHONE_NUMBER_ID') || '';
        this.accessToken =
            this.configService.get('WHATSAPP_ACCESS_TOKEN') || '';
    }
    async sendOrderConfirmation(toNumber, orderNumber, customerName) {
        if (!this.phoneNumberId || !this.accessToken) {
            this.logger.warn('WhatsApp API credentials not configured. Skipping message.');
            return;
        }
        try {
            const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;
            const payload = {
                messaging_product: 'whatsapp',
                to: toNumber,
                type: 'template',
                template: {
                    name: 'order_confirmation',
                    language: { code: 'en' },
                    components: [
                        {
                            type: 'body',
                            parameters: [
                                { type: 'text', text: customerName },
                                { type: 'text', text: orderNumber },
                            ],
                        },
                    ],
                },
            };
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.post(url, payload, {
                headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json',
                },
            }));
            this.logger.log(`WhatsApp message sent successfully to ${toNumber} for order ${orderNumber}`);
            return response.data;
        }
        catch (error) {
            let errMsg = 'Unknown error';
            if ((0, axios_2.isAxiosError)(error)) {
                const errorData = error.response?.data;
                errMsg = errorData?.error?.message || error.message;
            }
            else if (error instanceof Error) {
                errMsg = error.message;
            }
            this.logger.error(`Failed to send WhatsApp message to ${toNumber}: ${errMsg}`);
        }
    }
    async sendInvoice(toNumber, invoiceNumber, pdfUrl) {
        if (!this.phoneNumberId || !this.accessToken) {
            this.logger.warn('WhatsApp API credentials not configured. Skipping message.');
            return;
        }
        try {
            const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;
            const payload = {
                messaging_product: 'whatsapp',
                to: toNumber,
                type: 'document',
                document: {
                    link: pdfUrl,
                    filename: `Invoice_${invoiceNumber}.pdf`,
                },
            };
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.post(url, payload, {
                headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json',
                },
            }));
            this.logger.log(`WhatsApp invoice sent successfully to ${toNumber}`);
            return response.data;
        }
        catch (error) {
            let errMsg = 'Unknown error';
            if ((0, axios_2.isAxiosError)(error)) {
                const errorData = error.response?.data;
                errMsg = errorData?.error?.message || error.message;
            }
            else if (error instanceof Error) {
                errMsg = error.message;
            }
            this.logger.error(`Failed to send WhatsApp invoice to ${toNumber}: ${errMsg}`);
        }
    }
    async sendImage(toNumber, imageUrl, caption) {
        if (!this.phoneNumberId || !this.accessToken) {
            this.logger.warn('WhatsApp API credentials not configured. Skipping image message.');
            return;
        }
        try {
            const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;
            const payload = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: toNumber,
                type: 'image',
                image: {
                    link: imageUrl,
                    ...(caption ? { caption } : {}),
                },
            };
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.post(url, payload, {
                headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json',
                },
            }));
            this.logger.log(`WhatsApp image sent successfully to ${toNumber}`);
            return response.data;
        }
        catch (error) {
            let errMsg = 'Unknown error';
            if ((0, axios_2.isAxiosError)(error)) {
                const errorData = error.response?.data;
                errMsg = errorData?.error?.message || error.message;
            }
            else if (error instanceof Error) {
                errMsg = error.message;
            }
            this.logger.error(`Failed to send WhatsApp image to ${toNumber}: ${errMsg}`);
            throw error;
        }
    }
};
exports.WhatsappService = WhatsappService;
exports.WhatsappService = WhatsappService = WhatsappService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService,
        config_1.ConfigService])
], WhatsappService);
//# sourceMappingURL=whatsapp.service.js.map