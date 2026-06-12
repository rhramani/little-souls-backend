import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly apiUrl: string;
  private readonly phoneNumberId: string;
  private readonly accessToken: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiUrl =
      this.configService.get<string>('WHATSAPP_API_URL') ||
      'https://graph.facebook.com/v17.0';
    this.phoneNumberId =
      this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID') || '';
    this.accessToken =
      this.configService.get<string>('WHATSAPP_ACCESS_TOKEN') || '';
  }

  async sendOrderConfirmation(
    toNumber: string,
    orderNumber: string,
    customerName: string,
  ) {
    if (!this.phoneNumberId || !this.accessToken) {
      this.logger.warn(
        'WhatsApp API credentials not configured. Skipping message.',
      );
      return;
    }

    try {
      const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;

      const payload = {
        messaging_product: 'whatsapp',
        to: toNumber,
        type: 'template',
        template: {
          name: 'order_confirmation', // Replace with your approved Meta template name
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

      const response = await firstValueFrom(
        this.httpService.post(url, payload, {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }),
      );

      this.logger.log(
        `WhatsApp message sent successfully to ${toNumber} for order ${orderNumber}`,
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(
        `Failed to send WhatsApp message to ${toNumber}: ${error.message}`,
      );
      // Don't throw to prevent breaking the main transaction flow
    }
  }

  async sendInvoice(toNumber: string, invoiceNumber: string, pdfUrl: string) {
    if (!this.phoneNumberId || !this.accessToken) {
      this.logger.warn(
        'WhatsApp API credentials not configured. Skipping message.',
      );
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

      const response = await firstValueFrom(
        this.httpService.post(url, payload, {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }),
      );

      this.logger.log(`WhatsApp invoice sent successfully to ${toNumber}`);
      return response.data;
    } catch (error: any) {
      this.logger.error(
        `Failed to send WhatsApp invoice to ${toNumber}: ${error.message}`,
      );
    }
  }

  async sendImage(toNumber: string, imageUrl: string, caption?: string) {
    if (!this.phoneNumberId || !this.accessToken) {
      this.logger.warn(
        'WhatsApp API credentials not configured. Skipping image message.',
      );
      return;
    }

    try {
      const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;

      const payload: any = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: toNumber,
        type: 'image',
        image: {
          link: imageUrl,
        },
      };

      if (caption) {
        payload.image.caption = caption;
      }

      const response = await firstValueFrom(
        this.httpService.post(url, payload, {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }),
      );

      this.logger.log(`WhatsApp image sent successfully to ${toNumber}`);
      return response.data;
    } catch (error: any) {
      this.logger.error(
        `Failed to send WhatsApp image to ${toNumber}: ${error.response?.data?.error?.message || error.message}`,
      );
      throw error;
    }
  }
}
