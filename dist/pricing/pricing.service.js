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
exports.PricingService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const ExcelJS = __importStar(require("exceljs"));
let PricingService = class PricingService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createGroup(dto) {
        const code = dto.code.trim().toUpperCase();
        const existing = await this.prisma.pricingGroup.findUnique({
            where: { code },
        });
        if (existing) {
            throw new common_1.ConflictException(`Pricing Group with code '${code}' already exists.`);
        }
        return this.prisma.pricingGroup.create({
            data: {
                name: dto.name,
                code,
                description: dto.description !== undefined ? dto.description : dto.desc,
                isActive: dto.isActive !== undefined ? dto.isActive : true,
            },
        });
    }
    async findAllGroups() {
        return this.prisma.pricingGroup.findMany({
            orderBy: { code: 'asc' },
            include: {
                _count: {
                    select: {
                        customers: true,
                        productPricing: true,
                    },
                },
            },
        });
    }
    async findOneGroup(id) {
        const group = await this.prisma.pricingGroup.findUnique({
            where: { id },
            include: {
                customers: {
                    select: {
                        id: true,
                        businessName: true,
                        customerCode: true,
                    },
                },
            },
        });
        if (!group) {
            throw new common_1.NotFoundException(`Pricing Group with ID '${id}' not found.`);
        }
        return group;
    }
    async updateGroup(id, dto) {
        const group = await this.findOneGroup(id);
        let code = group.code;
        if (dto.code) {
            code = dto.code.trim().toUpperCase();
            if (code !== group.code) {
                const existing = await this.prisma.pricingGroup.findUnique({
                    where: { code },
                });
                if (existing) {
                    throw new common_1.ConflictException(`Pricing Group with code '${code}' already exists.`);
                }
            }
        }
        return this.prisma.pricingGroup.update({
            where: { id },
            data: {
                name: dto.name,
                code,
                description: dto.description !== undefined ? dto.description : dto.desc,
                isActive: dto.isActive,
            },
        });
    }
    async removeGroup(id) {
        const group = await this.findOneGroup(id);
        await this.prisma.customer.updateMany({
            where: { pricingGroupId: id },
            data: { pricingGroupId: null },
        });
        await this.prisma.productPricing.deleteMany({
            where: { pricingGroupId: id },
        });
        await this.prisma.pricingGroup.delete({
            where: { id },
        });
        return { message: 'Pricing Group deleted successfully' };
    }
    async setProductPrice(dto, userId) {
        const product = await this.prisma.product.findUnique({
            where: { id: dto.productId },
        });
        if (!product) {
            throw new common_1.NotFoundException(`Product with ID '${dto.productId}' not found.`);
        }
        const group = await this.prisma.pricingGroup.findUnique({
            where: { id: dto.pricingGroupId },
        });
        if (!group) {
            throw new common_1.NotFoundException(`Pricing Group with ID '${dto.pricingGroupId}' not found.`);
        }
        const price = parseFloat(dto.price);
        const mrp = dto.mrp ? parseFloat(dto.mrp) : null;
        const discountPercent = dto.discountPercent
            ? parseFloat(dto.discountPercent)
            : null;
        return this.prisma.productPricing.upsert({
            where: {
                productId_pricingGroupId: {
                    productId: dto.productId,
                    pricingGroupId: dto.pricingGroupId,
                },
            },
            update: {
                price,
                mrp,
                discountPercent,
                minQuantity: dto.minQuantity,
                maxQuantity: dto.maxQuantity,
                updatedBy: userId,
            },
            create: {
                productId: dto.productId,
                pricingGroupId: dto.pricingGroupId,
                price,
                mrp,
                discountPercent,
                minQuantity: dto.minQuantity,
                maxQuantity: dto.maxQuantity,
                createdBy: userId,
            },
            include: {
                pricingGroup: true,
                product: {
                    select: {
                        id: true,
                        name: true,
                        sku: true,
                    },
                },
            },
        });
    }
    async removeProductPrice(productId, pricingGroupId) {
        try {
            await this.prisma.productPricing.delete({
                where: {
                    productId_pricingGroupId: {
                        productId,
                        pricingGroupId,
                    },
                },
            });
            return { message: 'Product pricing deleted successfully' };
        }
        catch (e) {
            throw new common_1.NotFoundException('Pricing record not found.');
        }
    }
    async bulkUploadPricing(buffer, userId) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
            throw new common_1.BadRequestException('Excel file has no worksheets.');
        }
        const headerRow = worksheet.getRow(1);
        const headers = [];
        headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
            headers[colNumber] = String(cell.value || '').trim();
        });
        const skuColIndex = headers.findIndex((h) => h?.toLowerCase() === 'sku');
        if (skuColIndex === -1) {
            throw new common_1.BadRequestException('Excel must have a column header named "SKU".');
        }
        const allGroups = await this.prisma.pricingGroup.findMany();
        const tierColumns = [];
        headers.forEach((header, colIndex) => {
            if (colIndex === skuColIndex)
                return;
            if (!header)
                return;
            const match = allGroups.find((g) => g.name.toLowerCase() === header.toLowerCase());
            if (match) {
                tierColumns.push({
                    colIndex,
                    groupId: match.id,
                    name: match.name,
                });
            }
        });
        if (tierColumns.length === 0) {
            throw new common_1.BadRequestException(`No matching pricing tier columns found in Excel. Available tiers: ${allGroups.map((g) => g.name).join(', ')}`);
        }
        const errors = [];
        let successCount = 0;
        let skippedCount = 0;
        const dataRows = [];
        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            if (rowNumber === 1)
                return;
            const sku = String(row.getCell(skuColIndex).value || '').trim();
            if (!sku) {
                skippedCount++;
                return;
            }
            const prices = [];
            for (const tc of tierColumns) {
                const cellValue = row.getCell(tc.colIndex).value;
                if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
                    const numValue = Number(cellValue);
                    if (!isNaN(numValue) && numValue >= 0) {
                        prices.push({ groupId: tc.groupId, price: numValue });
                    }
                }
            }
            if (prices.length > 0) {
                dataRows.push({ row: rowNumber, sku, prices });
            }
        });
        const allSkus = [...new Set(dataRows.map((r) => r.sku))];
        const products = await this.prisma.product.findMany({
            where: { sku: { in: allSkus } },
            select: {
                id: true,
                sku: true,
                pricing: {
                    select: {
                        pricingGroupId: true,
                        price: true,
                    },
                },
            },
        });
        const skuToProduct = new Map(products.map((p) => [p.sku, p]));
        for (const dataRow of dataRows) {
            const product = skuToProduct.get(dataRow.sku);
            if (!product) {
                errors.push({
                    row: dataRow.row,
                    sku: dataRow.sku,
                    reason: 'SKU not found in database',
                });
                skippedCount++;
                continue;
            }
            for (const priceEntry of dataRow.prices) {
                const existingPricing = product.pricing.find((p) => p.pricingGroupId === priceEntry.groupId);
                if (existingPricing &&
                    Number(existingPricing.price) === priceEntry.price) {
                    skippedCount++;
                    continue;
                }
                try {
                    await this.prisma.productPricing.upsert({
                        where: {
                            productId_pricingGroupId: {
                                productId: product.id,
                                pricingGroupId: priceEntry.groupId,
                            },
                        },
                        update: {
                            price: priceEntry.price,
                            updatedBy: userId,
                        },
                        create: {
                            productId: product.id,
                            pricingGroupId: priceEntry.groupId,
                            price: priceEntry.price,
                            createdBy: userId,
                        },
                    });
                    successCount++;
                }
                catch (err) {
                    errors.push({
                        row: dataRow.row,
                        sku: dataRow.sku,
                        reason: `Failed to set price for tier: ${err.message}`,
                    });
                }
            }
        }
        return {
            total: dataRows.length,
            success: successCount,
            skipped: skippedCount,
            errorCount: errors.length,
            errors: errors.slice(0, 50),
            tiersMatched: tierColumns.map((tc) => tc.name),
        };
    }
    async generateTemplate(catalogueId) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Pricing Template');
        let filename = 'pricing_template.xlsx';
        if (catalogueId) {
            const catalogue = await this.prisma.catalogue.findUnique({
                where: { id: catalogueId },
                select: { name: true },
            });
            if (catalogue) {
                filename = `pricing_template_${catalogue.name.toLowerCase().replace(/\s+/g, '_')}.xlsx`;
            }
        }
        const groups = await this.prisma.pricingGroup.findMany({
            orderBy: { code: 'asc' },
        });
        const where = { isActive: true };
        if (catalogueId) {
            where.catalogueIds = { has: catalogueId };
        }
        const products = await this.prisma.product.findMany({
            where,
            select: {
                id: true,
                sku: true,
                name: true,
                pricing: {
                    select: {
                        pricingGroupId: true,
                        price: true,
                    },
                },
            },
            orderBy: { sku: 'asc' },
        });
        const headers = ['SKU', 'Product Name', ...groups.map((g) => g.name)];
        const headerRow = worksheet.addRow(headers);
        headerRow.eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE2E8F0' },
            };
            cell.border = {
                bottom: { style: 'thin' },
            };
        });
        for (const product of products) {
            const row = [product.sku, product.name];
            for (const group of groups) {
                const pricing = product.pricing.find((p) => p.pricingGroupId === group.id);
                row.push(pricing ? Number(pricing.price) : '');
            }
            worksheet.addRow(row);
        }
        worksheet.columns.forEach((column) => {
            let maxLength = 10;
            if (column.eachCell) {
                column.eachCell({ includeEmpty: true }, (cell) => {
                    const cellLength = cell.value ? String(cell.value).length : 0;
                    if (cellLength > maxLength)
                        maxLength = cellLength;
                });
            }
            column.width = Math.min(maxLength + 2, 30);
        });
        const buffer = await workbook.xlsx.writeBuffer();
        return { buffer, filename };
    }
};
exports.PricingService = PricingService;
exports.PricingService = PricingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PricingService);
//# sourceMappingURL=pricing.service.js.map