import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { UserType } from '@prisma/client';
import { Response } from 'express';
import * as zlib from 'zlib';

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

  async exportBackup(res: Response) {
    const backupData: any = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      data: {},
    };

    const prismaModels = [
      'user',
      'passwordResetToken',
      'userSession',
      'staffProfile',
      'role',
      'permission',
      'rolePermission',
      'userRole',
      'pricingGroup',
      'customer',
      'customerContact',
      'category',
      'product',
      'productImage',
      'imageCleaningTask',
      'productCatalogFile',
      'productVideo',
      'banner',
      'productPricing',
      'catalogImport',
      'catalogImportRow',
      'cart',
      'cartItem',
      'order',
      'orderItem',
      'orderStatusHistory',
      'backorderApproval',
      'packingSlip',
      'shipment',
      'invoice',
      'invoiceItem',
      'payment',
      'ledgerEntry',
      'creditDebitNote',
      'stockMovement',
      'attendanceRecord',
      'leaveRequest',
      'payroll',
      'notification',
      'supportTicket',
      'savedReport',
      'setting',
      'auditLog',
      'eventLog',
      'catalogue',
    ];

    for (const model of prismaModels) {
      if (this.prisma[model]) {
        backupData.data[model] = await this.prisma[model].findMany();
      }
    }

    const jsonString = JSON.stringify(backupData, null, 2);
    const gzipBuffer = zlib.gzipSync(jsonString);

    res.set({
      'Content-Type': 'application/gzip',
      'Content-Disposition': `attachment; filename="little_souls_backup_${new Date().toISOString().split('T')[0]}.json.gz"`,
      'Content-Length': gzipBuffer.length,
    });
    res.end(gzipBuffer);
  }

  async restoreBackup(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    let jsonString: string;
    try {
      if (
        file.originalname.endsWith('.gz') ||
        file.mimetype === 'application/gzip' ||
        file.mimetype === 'application/x-gzip'
      ) {
        jsonString = zlib.gunzipSync(file.buffer).toString('utf-8');
      } else {
        jsonString = file.buffer.toString('utf-8');
      }
    } catch (err) {
      throw new BadRequestException(
        'Failed to decompress or read backup file: ' + err.message,
      );
    }

    let backupData: any;
    try {
      backupData = JSON.parse(jsonString);
    } catch (err) {
      throw new BadRequestException('Invalid JSON content in backup file');
    }

    if (!backupData || typeof backupData !== 'object') {
      throw new BadRequestException('Invalid backup data format');
    }

    if (
      backupData.version !== '1.0' ||
      !backupData.data ||
      typeof backupData.data !== 'object'
    ) {
      throw new BadRequestException(
        'Unsupported backup version or invalid structure',
      );
    }

    const users = backupData.data.user;
    if (!Array.isArray(users) || users.length === 0) {
      throw new BadRequestException(
        'Backup data must contain at least one user record to prevent lockout',
      );
    }

    // Revive date objects recursively
    const revivedData = this.reviveDates(backupData.data);

    const prismaModels = [
      'user',
      'passwordResetToken',
      'userSession',
      'staffProfile',
      'role',
      'permission',
      'rolePermission',
      'userRole',
      'pricingGroup',
      'customer',
      'customerContact',
      'category',
      'product',
      'productImage',
      'imageCleaningTask',
      'productCatalogFile',
      'productVideo',
      'banner',
      'productPricing',
      'catalogImport',
      'catalogImportRow',
      'cart',
      'cartItem',
      'order',
      'orderItem',
      'orderStatusHistory',
      'backorderApproval',
      'packingSlip',
      'shipment',
      'invoice',
      'invoiceItem',
      'payment',
      'ledgerEntry',
      'creditDebitNote',
      'stockMovement',
      'attendanceRecord',
      'leaveRequest',
      'payroll',
      'notification',
      'supportTicket',
      'savedReport',
      'setting',
      'auditLog',
      'eventLog',
      'catalogue',
    ];

    // Clear all models
    for (const model of prismaModels) {
      if (this.prisma[model]) {
        try {
          await this.prisma[model].deleteMany();
        } catch (err) {
          console.error(`Failed to delete records for model ${model}:`, err);
        }
      }
    }

    // Restore all models
    for (const model of prismaModels) {
      const records = revivedData[model];
      if (
        records &&
        Array.isArray(records) &&
        records.length > 0 &&
        this.prisma[model]
      ) {
        try {
          await this.prisma[model].createMany({
            data: records,
          });
        } catch (err) {
          console.error(`Failed to restore records for model ${model}:`, err);
          // Fallback single inserts
          for (const record of records) {
            try {
              await this.prisma[model].create({
                data: record,
              });
            } catch (err2) {
              console.error(`Failed single insert for model ${model}:`, err2);
            }
          }
        }
      }
    }

    return {
      success: true,
      message: 'Backup restored successfully',
      timestamp: new Date().toISOString(),
    };
  }

  private reviveDates(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') {
      const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
      if (isoDateRegex.test(obj)) {
        const date = new Date(obj);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => this.reviveDates(item));
    }
    if (typeof obj === 'object') {
      const revived: any = {};
      for (const key of Object.keys(obj)) {
        revived[key] = this.reviveDates(obj[key]);
      }
      return revived;
    }
    return obj;
  }
}
