import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePricingGroupDto } from './dto/create-pricing-group.dto';
import { UpdatePricingGroupDto } from './dto/update-pricing-group.dto';
import { SetProductPricingDto } from './dto/set-product-pricing.dto';
import { Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async createGroup(dto: CreatePricingGroupDto) {
    const code = dto.code.trim().toUpperCase();

    // 1. Verify code uniqueness
    const existing = await this.prisma.pricingGroup.findUnique({
      where: { code },
    });
    if (existing) {
      throw new ConflictException(
        `Pricing Group with code '${code}' already exists.`,
      );
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

  async findOneGroup(id: string) {
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
      throw new NotFoundException(`Pricing Group with ID '${id}' not found.`);
    }

    return group;
  }

  async updateGroup(id: string, dto: UpdatePricingGroupDto) {
    const group = await this.findOneGroup(id);

    let code = group.code;
    if (dto.code) {
      code = dto.code.trim().toUpperCase();
      if (code !== group.code) {
        const existing = await this.prisma.pricingGroup.findUnique({
          where: { code },
        });
        if (existing) {
          throw new ConflictException(
            `Pricing Group with code '${code}' already exists.`,
          );
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

  async removeGroup(id: string) {
    const group = await this.findOneGroup(id);

    // 1. Decouple group from assigned customers (reset pricingGroupId to null)
    await this.prisma.customer.updateMany({
      where: { pricingGroupId: id },
      data: { pricingGroupId: null },
    });

    // 2. Delete all related product price definitions
    await this.prisma.productPricing.deleteMany({
      where: { pricingGroupId: id },
    });

    // 3. Finally, delete the pricing group
    await this.prisma.pricingGroup.delete({
      where: { id },
    });

    return { message: 'Pricing Group deleted successfully' };
  }

  async setProductPrice(dto: SetProductPricingDto, userId: string) {
    // 1. Verify Product exists
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) {
      throw new NotFoundException(
        `Product with ID '${dto.productId}' not found.`,
      );
    }

    // 2. Verify Pricing Group exists
    const group = await this.prisma.pricingGroup.findUnique({
      where: { id: dto.pricingGroupId },
    });
    if (!group) {
      throw new NotFoundException(
        `Pricing Group with ID '${dto.pricingGroupId}' not found.`,
      );
    }

    const price = parseFloat(dto.price);
    const mrp = dto.mrp ? parseFloat(dto.mrp) : null;
    const discountPercent = dto.discountPercent
      ? parseFloat(dto.discountPercent)
      : null;

    // 3. Upsert Product Pricing record
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

  async removeProductPrice(productId: string, pricingGroupId: string) {
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
    } catch (e) {
      throw new NotFoundException('Pricing record not found.');
    }
  }

  async bulkUploadPricing(buffer: Buffer, userId: string) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new BadRequestException('Excel file has no worksheets.');
    }

    // 1. Read header row
    const headerRow = worksheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      headers[colNumber] = String(cell.value || '').trim();
    });

    // 2. Find SKU column (must be first non-empty or labeled "SKU")
    const skuColIndex = headers.findIndex((h) => h?.toLowerCase() === 'sku');
    if (skuColIndex === -1) {
      throw new BadRequestException(
        'Excel must have a column header named "SKU".',
      );
    }

    // 3. Map tier column names to pricing group IDs (case-insensitive)
    const allGroups = await this.prisma.pricingGroup.findMany();
    const tierColumns: { colIndex: number; groupId: string; name: string }[] =
      [];

    headers.forEach((header, colIndex) => {
      if (colIndex === skuColIndex) return;
      if (!header) return;
      const match = allGroups.find(
        (g) => g.name.toLowerCase() === header.toLowerCase(),
      );
      if (match) {
        tierColumns.push({
          colIndex,
          groupId: match.id,
          name: match.name,
        });
      }
    });

    if (tierColumns.length === 0) {
      throw new BadRequestException(
        `No matching pricing tier columns found in Excel. Available tiers: ${allGroups.map((g) => g.name).join(', ')}`,
      );
    }

    // 4. Process data rows
    const errors: { row: number; sku: string; reason: string }[] = [];
    let successCount = 0;
    let skippedCount = 0;

    const dataRows: {
      row: number;
      sku: string;
      prices: { groupId: string; price: number }[];
    }[] = [];

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return; // skip header

      const sku = String(row.getCell(skuColIndex).value || '').trim();
      if (!sku) {
        skippedCount++;
        return;
      }

      const prices: { groupId: string; price: number }[] = [];
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

    // 5. Look up all SKUs in one query with existing pricing
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

    // 6. Process each row
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
        // Check if price already exists and is the same
        const existingPricing = product.pricing.find(
          (p) => p.pricingGroupId === priceEntry.groupId,
        );
        if (
          existingPricing &&
          Number(existingPricing.price) === priceEntry.price
        ) {
          skippedCount++; // count as skipped because price hasn't changed
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
        } catch (err) {
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
      errors: errors.slice(0, 50), // limit error details
      tiersMatched: tierColumns.map((tc) => tc.name),
    };
  }

  async generateTemplate(
    catalogueId?: string,
  ): Promise<{ buffer: ExcelJS.Buffer; filename: string }> {
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

    // 1. Get all tiers
    const groups = await this.prisma.pricingGroup.findMany({
      orderBy: { code: 'asc' },
    });

    // 2. Get all products with existing pricing (filtered by catalog if provided)
    const where: any = { isActive: true };
    if (catalogueId) {
      where.catalogueId = catalogueId;
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

    // 3. Build headers: SKU, Product Name, then each tier
    const headers = ['SKU', 'Product Name', ...groups.map((g) => g.name)];
    const headerRow = worksheet.addRow(headers);

    // Style header row
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

    // 4. Add product rows with existing prices pre-filled
    for (const product of products) {
      const row: (string | number)[] = [product.sku, product.name];
      for (const group of groups) {
        const pricing = product.pricing.find(
          (p) => p.pricingGroupId === group.id,
        );
        row.push(pricing ? Number(pricing.price) : '');
      }
      worksheet.addRow(row);
    }

    // Auto-width columns
    worksheet.columns.forEach((column) => {
      let maxLength = 10;
      if (column.eachCell) {
        column.eachCell({ includeEmpty: true }, (cell) => {
          const cellLength = cell.value ? String(cell.value).length : 0;
          if (cellLength > maxLength) maxLength = cellLength;
        });
      }
      column.width = Math.min(maxLength + 2, 30);
    });

    // 5. Return buffer and filename
    const buffer = await workbook.xlsx.writeBuffer();
    return { buffer, filename };
  }
}
