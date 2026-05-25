import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings() {
    let settings = await this.prisma.setting.findFirst();
    if (!settings) {
      // Auto-create default settings on first access
      settings = await this.prisma.setting.create({
        data: {
          businessName: 'Little Souls',
          currency: 'INR',
          taxEnabled: true,
          defaultTaxPercent: new Prisma.Decimal(18),
          lowStockThreshold: 10,
          orderPrefix: 'LS',
          invoicePrefix: 'INV',
          paymentPrefix: 'PAY',
          purchaseOrderPrefix: 'PO',
        },
      });
    }
    return settings;
  }

  async getPublicSettings() {
    const settings = await this.getSettings();
    return {
      businessName: settings.businessName,
      businessLogoUrl: settings.businessLogoUrl,
      faviconUrl: settings.faviconUrl,
      contactEmail: settings.contactEmail,
      contactPhone: settings.contactPhone,
      companyAddress: settings.companyAddress,
      whatsappOrderNumber: settings.whatsappOrderNumber,
    };
  }

  async updateSettings(dto: UpdateSettingsDto) {
    let settings = await this.prisma.setting.findFirst();
    if (!settings) {
      return this.prisma.setting.create({
        data: {
          ...dto,
          defaultTaxPercent: dto.defaultTaxPercent !== undefined
            ? new Prisma.Decimal(dto.defaultTaxPercent)
            : undefined,
        },
      });
    }

    return this.prisma.setting.update({
      where: { id: settings.id },
      data: {
        ...dto,
        defaultTaxPercent: dto.defaultTaxPercent !== undefined
          ? new Prisma.Decimal(dto.defaultTaxPercent)
          : undefined,
      },
    });
  }
}
