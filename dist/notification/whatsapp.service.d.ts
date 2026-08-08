import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
export declare class WhatsappService {
    private readonly httpService;
    private readonly configService;
    private readonly logger;
    private readonly apiUrl;
    private readonly phoneNumberId;
    private readonly accessToken;
    constructor(httpService: HttpService, configService: ConfigService);
    sendOrderConfirmation(toNumber: string, orderNumber: string, customerName: string): Promise<Record<string, any> | undefined>;
    sendInvoice(toNumber: string, invoiceNumber: string, pdfUrl: string): Promise<Record<string, any> | undefined>;
    sendImage(toNumber: string, imageUrl: string, caption?: string): Promise<Record<string, any> | undefined>;
}
