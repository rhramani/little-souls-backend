import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StartImportDto } from './dto/start-import.dto';
import { Prisma, StockStatus } from '@prisma/client';

@Injectable()
export class ImportService {
  constructor(private readonly prisma: PrismaService) {}

  async startImport(dto: StartImportDto, userId: string) {
    // 1. Create PENDING catalog import header
    const catalogImport = await this.prisma.catalogImport.create({
      data: {
        fileUrl: dto.fileUrl,
        importType: dto.importType,
        status: 'PROCESSING',
        totalRows: dto.rows.length,
        successRows: 0,
        failedRows: 0,
        uploadedBy: userId,
      },
    });

    // 2. Trigger asynchronous background row-by-row processor
    setTimeout(
      () =>
        this.processImport(catalogImport.id, dto.importType, dto.rows, userId),
      0,
    );

    return catalogImport;
  }

  async processImport(
    importId: string,
    importType: string,
    rows: any[],
    userId: string,
  ) {
    let successCount = 0;
    let failedCount = 0;

    for (let index = 0; index < rows.length; index++) {
      const rowData = rows[index];
      const rowNumber = index + 1;
      const sku = rowData.sku ? rowData.sku.toString().trim() : null;

      try {
        if (!sku) {
          throw new Error('SKU is required and cannot be empty.');
        }

        switch (importType) {
          case 'PRODUCT_CREATE': {
            if (!rowData.name) {
              throw new Error("Product 'name' is required for creation.");
            }

            // Check SKU uniqueness
            const existingProduct = await this.prisma.product.findUnique({
              where: { sku },
            });
            if (existingProduct) {
              throw new Error(`Product with SKU '${sku}' already exists.`);
            }

            // Resolve Category
            let categoryId = rowData.categoryId;
            if (rowData.categoryName) {
              const category = await this.prisma.category.findFirst({
                where: {
                  name: { equals: rowData.categoryName, mode: 'insensitive' },
                },
              });
              if (category) {
                categoryId = category.id;
              }
            }

            if (!categoryId) {
              throw new Error(
                'A valid categoryId or categoryName must be provided.',
              );
            }

            // Generate slug
            const slug =
              rowData.slug ||
              this.slugify(rowData.name) +
                '-' +
                Math.floor(100 + Math.random() * 900);

            // Create product in database
            const product = await this.prisma.product.create({
              data: {
                sku,
                name: rowData.name,
                slug,
                description: rowData.description || null,
                categoryId,
                barcode: rowData.barcode || null,
                brand: rowData.brand || null,
                size: rowData.size || null,
                color: rowData.color || null,
                material: rowData.material || null,
                unit: rowData.unit || 'PCS',
                hsnCode: rowData.hsnCode || null,
                moq: rowData.moq ? parseInt(rowData.moq) : 1,
                wholesalerMoq: (() => {
                  const raw =
                    rowData.wholesalerMoq ??
                    rowData.wholesaler_moq ??
                    rowData['Wholesaler MOQ'] ??
                    rowData['Wholesale MOQ'] ??
                    rowData['W-MOQ'] ??
                    rowData.wmoq;
                  return raw ? parseInt(raw) : null;
                })(),
                fixQty: rowData.fixQty ? parseInt(rowData.fixQty) : null,
                weight: rowData.weight ? Number(rowData.weight) : null,
                taxType: (() => {
                  const raw =
                    rowData.taxType ||
                    rowData.gstType ||
                    rowData['Tax Type'] ||
                    rowData['GST Type'] ||
                    rowData.tax_type ||
                    rowData.gst_type;
                  if (!raw) return null;
                  const clean = String(raw).trim().toUpperCase();
                  if (clean.includes('CGST') || clean.includes('SGST')) return 'CGST_SGST';
                  if (clean.includes('IGST')) return 'IGST';
                  return null;
                })(),
                taxPercent: (() => {
                  const raw =
                    rowData.taxValue ??
                    rowData.taxPercent ??
                    rowData.gstValue ??
                    rowData.gstPercent ??
                    rowData['Tax Value'] ??
                    rowData['Tax Value (%)'] ??
                    rowData['Tax %'] ??
                    rowData['GST Value'] ??
                    rowData['GST %'];
                  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
                  const num = Number(String(raw).replace(/%/g, '').trim());
                  if (isNaN(num)) return null;
                  return num > 0 && num <= 1 ? Math.round(num * 100) : num;
                })(),
                stockQuantity: rowData.stockQuantity
                  ? parseInt(rowData.stockQuantity)
                  : 0,
                stockStatus:
                  rowData.stockQuantity && parseInt(rowData.stockQuantity) > 0
                    ? StockStatus.IN_STOCK
                    : StockStatus.OUT_OF_STOCK,
                allowBackorder:
                  rowData.allowBackorder === true ||
                  rowData.allowBackorder === 'true',
                createdBy: userId,
              },
            });

            // Create optional initial B2B pricing group map
            if (rowData.pricingGroupId && rowData.price) {
              await this.prisma.productPricing.create({
                data: {
                  productId: product.id,
                  pricingGroupId: rowData.pricingGroupId,
                  price: Number(rowData.price),
                  mrp: rowData.mrp ? Number(rowData.mrp) : null,
                  discountPercent: rowData.discountPercent
                    ? Number(rowData.discountPercent)
                    : null,
                  createdBy: userId,
                },
              });
            }
            break;
          }

          case 'PRODUCT_UPDATE': {
            const product = await this.prisma.product.findUnique({
              where: { sku },
            });
            if (!product) {
              throw new Error(`Product with SKU '${sku}' not found.`);
            }

            await this.prisma.product.update({
              where: { sku },
              data: {
                name: rowData.name || undefined,
                description: rowData.description || undefined,
                barcode: rowData.barcode || undefined,
                brand: rowData.brand || undefined,
                size: rowData.size || undefined,
                color: rowData.color || undefined,
                material: rowData.material || undefined,
                unit: rowData.unit || undefined,
                hsnCode: rowData.hsnCode || undefined,
                moq: rowData.moq ? parseInt(rowData.moq) : undefined,
                wholesalerMoq: (() => {
                  const raw =
                    rowData.wholesalerMoq ??
                    rowData.wholesaler_moq ??
                    rowData['Wholesaler MOQ'] ??
                    rowData['Wholesale MOQ'] ??
                    rowData['W-MOQ'] ??
                    rowData.wmoq;
                  if (raw === undefined) return undefined;
                  if (raw === null || String(raw).trim() === '') return null;
                  return parseInt(raw);
                })(),
                fixQty: rowData.fixQty ? parseInt(rowData.fixQty) : undefined,
                weight: rowData.weight ? Number(rowData.weight) : undefined,
                taxType: (() => {
                  const raw =
                    rowData.taxType ??
                    rowData.gstType ??
                    rowData['Tax Type'] ??
                    rowData['GST Type'] ??
                    rowData.tax_type ??
                    rowData.gst_type;
                  if (raw === undefined) return undefined;
                  if (raw === null || String(raw).trim() === '') return null;
                  const clean = String(raw).trim().toUpperCase();
                  if (clean.includes('CGST') || clean.includes('SGST')) return 'CGST_SGST';
                  if (clean.includes('IGST')) return 'IGST';
                  return null;
                })(),
                taxPercent: (() => {
                  const raw =
                    rowData.taxValue ??
                    rowData.taxPercent ??
                    rowData.gstValue ??
                    rowData.gstPercent ??
                    rowData['Tax Value'] ??
                    rowData['Tax Value (%)'] ??
                    rowData['Tax %'] ??
                    rowData['GST Value'] ??
                    rowData['GST %'];
                  if (raw === undefined) return undefined;
                  if (raw === null || String(raw).trim() === '') return null;
                  const num = Number(String(raw).replace(/%/g, '').trim());
                  if (isNaN(num)) return null;
                  return num > 0 && num <= 1 ? Math.round(num * 100) : num;
                })(),
                updatedBy: userId,
              },
            });
            break;
          }

          case 'STOCK_UPDATE': {
            const product = await this.prisma.product.findUnique({
              where: { sku },
            });
            if (!product) {
              throw new Error(`Product with SKU '${sku}' not found.`);
            }

            if (
              rowData.stockQuantity === undefined ||
              rowData.stockQuantity === null
            ) {
              throw new Error('stockQuantity is required for stock updates.');
            }

            const stockQuantity = parseInt(rowData.stockQuantity);
            let stockStatus: StockStatus = StockStatus.IN_STOCK;
            if (stockQuantity === 0) {
              stockStatus = StockStatus.OUT_OF_STOCK;
            } else if (stockQuantity <= 5) {
              stockStatus = StockStatus.LOW_STOCK;
            }

            await this.prisma.product.update({
              where: { sku },
              data: {
                stockQuantity,
                stockStatus,
                updatedBy: userId,
              },
            });
            break;
          }

          case 'PRICE_UPDATE': {
            const product = await this.prisma.product.findUnique({
              where: { sku },
            });
            if (!product) {
              throw new Error(`Product with SKU '${sku}' not found.`);
            }

            if (!rowData.pricingGroupCode) {
              throw new Error(
                'pricingGroupCode is required for price updates.',
              );
            }

            if (!rowData.price) {
              throw new Error('price is required for price updates.');
            }

            const pricingGroup = await this.prisma.pricingGroup.findUnique({
              where: {
                code: rowData.pricingGroupCode.toString().toUpperCase(),
              },
            });

            if (!pricingGroup) {
              throw new Error(
                `Pricing Group with code '${rowData.pricingGroupCode}' not found.`,
              );
            }

            const price = Number(rowData.price);
            const mrp = rowData.mrp ? Number(rowData.mrp) : null;
            const discountPercent = rowData.discountPercent
              ? Number(rowData.discountPercent)
              : null;

            await this.prisma.productPricing.upsert({
              where: {
                productId_pricingGroupId: {
                  productId: product.id,
                  pricingGroupId: pricingGroup.id,
                },
              },
              update: {
                price,
                mrp,
                discountPercent,
                updatedBy: userId,
              },
              create: {
                productId: product.id,
                pricingGroupId: pricingGroup.id,
                price,
                mrp,
                discountPercent,
                createdBy: userId,
              },
            });
            break;
          }

          default:
            throw new Error(`Unsupported importType: ${importType}`);
        }

        // Row processed successfully
        successCount++;
        await this.prisma.catalogImportRow.create({
          data: {
            catalogImportId: importId,
            rowNumber,
            sku,
            status: 'SUCCESS',
            rawData: JSON.stringify(rowData),
          },
        });
      } catch (err: any) {
        // Row processing failed
        failedCount++;
        await this.prisma.catalogImportRow.create({
          data: {
            catalogImportId: importId,
            rowNumber,
            sku: sku || 'UNKNOWN',
            status: 'FAILED',
            errorMessage: err.message,
            rawData: JSON.stringify(rowData),
          },
        });
      }
    }

    // 3. Finalize catalog import status header
    await this.prisma.catalogImport.update({
      where: { id: importId },
      data: {
        status: 'COMPLETED',
        successRows: successCount,
        failedRows: failedCount,
      },
    });
  }

  async findAll(uploadedBy?: string) {
    const where = uploadedBy ? { uploadedBy } : {};
    return this.prisma.catalogImport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const catalogImport = await this.prisma.catalogImport.findUnique({
      where: { id },
      include: {
        rows: {
          orderBy: { rowNumber: 'asc' },
        },
      },
    });

    if (!catalogImport) {
      throw new NotFoundException(`Catalog Import with ID '${id}' not found.`);
    }

    return catalogImport;
  }

  private slugify(text: string): string {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-');
  }

  private normalizeProductTax(p: any): { taxType: string; taxValue: string } {
    if (!p) return { taxType: '', taxValue: '' };

    const rawType = String(p.taxType || '').trim();
    const upperType = rawType.toUpperCase();

    let taxType = '';
    if (
      upperType === 'CGST_SGST' ||
      upperType === 'CGST + SGST' ||
      upperType === 'CGST+SGST' ||
      upperType === 'CGST/SGST' ||
      upperType === 'CGST & SGST' ||
      upperType.includes('CGST') ||
      upperType.includes('SGST')
    ) {
      taxType = 'CGST + SGST';
    } else if (upperType === 'IGST' || upperType.includes('IGST')) {
      taxType = 'IGST';
    }

    let taxValue = '';
    if (p.taxPercent !== null && p.taxPercent !== undefined && String(p.taxPercent).trim() !== '') {
      const num = Number(p.taxPercent);
      if (!isNaN(num)) {
        taxValue = num > 0 && num <= 1 ? String(Math.round(num * 100)) : String(num);
      }
    }

    // If taxValue is empty or 0 and rawType is numeric (e.g. legacy data with taxType = "0.18" or "18")
    if ((!taxValue || taxValue === '0') && rawType && !isNaN(Number(rawType))) {
      const num = Number(rawType);
      if (num > 0 && num <= 1) {
        taxValue = String(Math.round(num * 100)); // "0.18" -> "18"
      } else if (num > 0) {
        taxValue = String(num);
      }
    }

    return { taxType, taxValue };
  }

  async exportCatalog(): Promise<Buffer> {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();

    // Products Sheet
    const productsSheet = workbook.addWorksheet('Products');
    productsSheet.columns = [
      { header: 'SKU', key: 'sku', width: 20 },
      { header: 'Name', key: 'name', width: 40 },
      { header: 'Description', key: 'description', width: 50 },
      { header: 'Category ID', key: 'categoryId', width: 30 },
      { header: 'Category Name', key: 'categoryName', width: 30 },
      { header: 'MOQ', key: 'moq', width: 10 },
      { header: 'Wholesaler MOQ', key: 'wholesalerMoq', width: 16 },
      { header: 'Fix Qty', key: 'fixQty', width: 12 },
      { header: 'Barcode', key: 'barcode', width: 20 },
      { header: 'Brand', key: 'brand', width: 20 },
      { header: 'Size', key: 'size', width: 15 },
      { header: 'Color', key: 'color', width: 15 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Tax Type', key: 'taxType', width: 18 },
      { header: 'Tax Value', key: 'taxValue', width: 15 },
      { header: 'Stock Quantity', key: 'stockQuantity', width: 15 },
    ];

    const products = await this.prisma.product.findMany({
      include: { category: true },
    });

    products.forEach((p) => {
      const { taxType: exportTaxType, taxValue: exportTaxValue } =
        this.normalizeProductTax(p);
      productsSheet.addRow({
        sku: p.sku,
        name: p.name,
        description: p.description,
        categoryId: p.categoryId,
        categoryName: p.category.name,
        moq: p.moq,
        wholesalerMoq: p.wholesalerMoq ?? '',
        fixQty: p.fixQty,
        barcode: p.barcode,
        brand: p.brand,
        size: p.size,
        color: p.color,
        unit: p.unit,
        taxType: exportTaxType,
        taxValue: exportTaxValue,
        stockQuantity: p.stockQuantity,
      });
    });

    // Pricing Sheet
    const pricingSheet = workbook.addWorksheet('Pricing');
    pricingSheet.columns = [
      { header: 'SKU', key: 'sku', width: 20 },
      { header: 'Pricing Group Code', key: 'pricingGroupCode', width: 25 },
      { header: 'Price', key: 'price', width: 15 },
      { header: 'MRP', key: 'mrp', width: 15 },
      { header: 'Discount Percent', key: 'discountPercent', width: 15 },
    ];

    const pricings = await this.prisma.productPricing.findMany({
      include: { product: true, pricingGroup: true },
    });

    pricings.forEach((p) => {
      pricingSheet.addRow({
        sku: p.product.sku,
        pricingGroupCode: p.pricingGroup.code,
        price: p.price.toString(),
        mrp: p.mrp ? p.mrp.toString() : '',
        discountPercent: p.discountPercent ? p.discountPercent.toString() : '',
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as Buffer;
  }
}
