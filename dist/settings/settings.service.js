"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const zlib = __importStar(require("zlib"));
let SettingsService = class SettingsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getSettings() {
        let settings = await this.prisma.setting.findFirst();
        if (!settings) {
            const superAdmin = await this.prisma.user.findFirst({
                where: { userType: client_1.UserType.SUPER_ADMIN },
            });
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
                    companyAddress: 'Mumbai, India',
                    companyGstin: null,
                },
            });
        }
        return settings;
    }
    async getPublicSettings() {
        const settings = await this.getSettings();
        const gstin = settings.companyGstin || settings.gstin || null;
        return {
            businessName: settings.businessName,
            businessLogoUrl: settings.businessLogoUrl,
            faviconUrl: settings.faviconUrl,
            contactEmail: settings.contactEmail,
            contactPhone: settings.contactPhone,
            companyAddress: settings.companyAddress,
            whatsappOrderNumber: settings.whatsappOrderNumber,
            gstin,
            companyGstin: gstin,
            invoicePrefix: settings.invoicePrefix,
            orderPrefix: settings.orderPrefix,
            paymentPrefix: settings.paymentPrefix,
            taxEnabled: settings.taxEnabled,
            defaultTaxPercent: settings.defaultTaxPercent,
        };
    }
    async updateSettings(dto) {
        const settings = await this.prisma.setting.findFirst();
        const dataToSave = { ...dto };
        if (dto.companyGstin !== undefined) {
            dataToSave.companyGstin = dto.companyGstin || null;
        }
        if (!settings) {
            return this.prisma.setting.create({
                data: dataToSave,
            });
        }
        return this.prisma.setting.update({
            where: { id: settings.id },
            data: dataToSave,
        });
    }
    async getAuditLogs(page, limit) {
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
    async exportBackup(res) {
        const backupData = {
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
            'stockMovement',
            'attendanceRecord',
            'leaveRequest',
            'payroll',
            'notification',
            'supportTicket',
            'savedReport',
            'setting',
            'auditLog',
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
    async restoreBackup(file) {
        if (!file) {
            throw new common_1.BadRequestException('No file uploaded');
        }
        let jsonString;
        try {
            if (file.originalname.endsWith('.gz') ||
                file.mimetype === 'application/gzip' ||
                file.mimetype === 'application/x-gzip') {
                jsonString = zlib.gunzipSync(file.buffer).toString('utf-8');
            }
            else {
                jsonString = file.buffer.toString('utf-8');
            }
        }
        catch (err) {
            throw new common_1.BadRequestException('Failed to decompress or read backup file: ' + err.message);
        }
        let backupData;
        try {
            backupData = JSON.parse(jsonString);
        }
        catch (err) {
            throw new common_1.BadRequestException('Invalid JSON content in backup file');
        }
        if (!backupData || typeof backupData !== 'object') {
            throw new common_1.BadRequestException('Invalid backup data format');
        }
        if (backupData.version !== '1.0' ||
            !backupData.data ||
            typeof backupData.data !== 'object') {
            throw new common_1.BadRequestException('Unsupported backup version or invalid structure');
        }
        const users = backupData.data.user;
        if (!Array.isArray(users) || users.length === 0) {
            throw new common_1.BadRequestException('Backup data must contain at least one user record to prevent lockout');
        }
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
            'stockMovement',
            'attendanceRecord',
            'leaveRequest',
            'payroll',
            'notification',
            'supportTicket',
            'savedReport',
            'setting',
            'auditLog',
            'catalogue',
        ];
        for (const model of prismaModels) {
            if (this.prisma[model]) {
                try {
                    await this.prisma[model].deleteMany();
                }
                catch (err) {
                    console.error(`Failed to delete records for model ${model}:`, err);
                }
            }
        }
        for (const model of prismaModels) {
            const records = revivedData[model];
            if (records &&
                Array.isArray(records) &&
                records.length > 0 &&
                this.prisma[model]) {
                try {
                    await this.prisma[model].createMany({
                        data: records,
                    });
                }
                catch (err) {
                    console.error(`Failed to restore records for model ${model}:`, err);
                    for (const record of records) {
                        try {
                            await this.prisma[model].create({
                                data: record,
                            });
                        }
                        catch (err2) {
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
    reviveDates(obj) {
        if (obj === null || obj === undefined)
            return obj;
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
            const revived = {};
            for (const key of Object.keys(obj)) {
                revived[key] = this.reviveDates(obj[key]);
            }
            return revived;
        }
        return obj;
    }
};
exports.SettingsService = SettingsService;
exports.SettingsService = SettingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SettingsService);
//# sourceMappingURL=settings.service.js.map