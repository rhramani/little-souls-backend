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
    setTimeout(() => this.processImport(catalogImport.id, dto.importType, dto.rows, userId), 0);

    return catalogImport;
  }

  async processImport(importId: string, importType: string, rows: any[], userId: string) {
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
                where: { name: { equals: rowData.categoryName, mode: 'insensitive' } },
              });
              if (category) {
                categoryId = category.id;
              }
            }

            if (!categoryId) {
              throw new Error('A valid categoryId or categoryName must be provided.');
            }

            // Generate slug
            const slug = rowData.slug || this.slugify(rowData.name) + '-' + Math.floor(100 + Math.random() * 900);

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
                weight: rowData.weight ? new Prisma.Decimal(rowData.weight) : null,
                taxPercent: rowData.taxPercent ? new Prisma.Decimal(rowData.taxPercent) : null,
                stockQuantity: rowData.stockQuantity ? parseInt(rowData.stockQuantity) : 0,
                stockStatus: rowData.stockQuantity && parseInt(rowData.stockQuantity) > 0 ? StockStatus.IN_STOCK : StockStatus.OUT_OF_STOCK,
                allowBackorder: rowData.allowBackorder === true || rowData.allowBackorder === 'true',
                createdBy: userId,
              },
            });

            // Create optional initial B2B pricing group map
            if (rowData.pricingGroupId && rowData.price) {
              await this.prisma.productPricing.create({
                data: {
                  productId: product.id,
                  pricingGroupId: rowData.pricingGroupId,
                  price: new Prisma.Decimal(rowData.price),
                  mrp: rowData.mrp ? new Prisma.Decimal(rowData.mrp) : null,
                  discountPercent: rowData.discountPercent ? new Prisma.Decimal(rowData.discountPercent) : null,
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
                weight: rowData.weight ? new Prisma.Decimal(rowData.weight) : undefined,
                taxPercent: rowData.taxPercent ? new Prisma.Decimal(rowData.taxPercent) : undefined,
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

            if (rowData.stockQuantity === undefined || rowData.stockQuantity === null) {
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
              throw new Error('pricingGroupCode is required for price updates.');
            }

            if (!rowData.price) {
              throw new Error('price is required for price updates.');
            }

            const pricingGroup = await this.prisma.pricingGroup.findUnique({
              where: { code: rowData.pricingGroupCode.toString().toUpperCase() },
            });

            if (!pricingGroup) {
              throw new Error(`Pricing Group with code '${rowData.pricingGroupCode}' not found.`);
            }

            const price = new Prisma.Decimal(rowData.price);
            const mrp = rowData.mrp ? new Prisma.Decimal(rowData.mrp) : null;
            const discountPercent = rowData.discountPercent ? new Prisma.Decimal(rowData.discountPercent) : null;

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
}
