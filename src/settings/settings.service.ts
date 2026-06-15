import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { UserType } from '@prisma/client';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings() {
    let settings = await this.prisma.setting.findFirst();
    if (!settings) {
      // Find Super Admin to use as default contact
      const superAdmin = await this.prisma.user.findFirst({
        where: { userType: UserType.SUPER_ADMIN },
      });

      // Auto-create default settings on first access
      settings = await this.prisma.setting.create({
        data: {
          businessName: 'Little Souls',
          currency: 'INR',
          taxEnabled: true,
          defaultTaxPercent: 18,
          lowStockThreshold: 10,
          orderPrefix: 'LS',
          invoicePrefix: 'INV',
          paymentPrefix: 'PAY',
          purchaseOrderPrefix: 'PO',
          businessLogoUrl: '/logo.png',
          faviconUrl: '/favicon.png',
          contactEmail: superAdmin?.email || null,
          contactPhone: superAdmin?.mobile || null,
          whatsappOrderNumber: superAdmin?.mobile || null,
          companyAddress: 'Rajkot, Gujarat, India',
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
    const settings = await this.prisma.setting.findFirst();
    if (!settings) {
      return this.prisma.setting.create({
        data: {
          ...dto,
          defaultTaxPercent: dto.defaultTaxPercent,
        },
      });
    }

    return this.prisma.setting.update({
      where: { id: settings.id },
      data: {
        ...dto,
        defaultTaxPercent: dto.defaultTaxPercent,
      },
    });
  }

  async getAuditLogs(page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              name: true,
              userType: true,
              staff: {
                select: { designation: true },
              },
            },
          },
        },
      }),
      this.prisma.auditLog.count(),
    ]);

    return {
      logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
