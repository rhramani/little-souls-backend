import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCatalogueDto } from './dto/create-catalogue.dto';
import { UpdateCatalogueDto } from './dto/update-catalogue.dto';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import axios from 'axios';
import * as bwipjs from 'bwip-js';
import { UploadService } from '../upload/upload.service';
function pLimit(concurrency: number) {
  const queue: (() => void)[] = [];
  let activeCount = 0;

  const next = () => {
    activeCount--;
    if (queue.length > 0) {
      const run = queue.shift()!;
      run();
    }
  };

  return <T>(fn: () => Promise<T>): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const run = async () => {
        activeCount++;
        try {
          const res = await fn();
          resolve(res);
        } catch (err) {
          reject(err);
        } finally {
          next();
        }
      };

      if (activeCount < concurrency) {
        run();
      } else {
        queue.push(run);
      }
    });
  };
}

import { ImageCleaningService } from '../image-cleaning/image-cleaning.service';

@Injectable()
export class CatalogueService {
  private readonly logger = new Logger(CatalogueService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
    private readonly imageCleaningService: ImageCleaningService,
  ) {}

  private async generateAndUploadBarcode(sku: string): Promise<string | null> {
    try {
      const buffer = await bwipjs.toBuffer({
        bcid: 'code128',
        text: sku,
        scale: 3,
        height: 10,
        includetext: true,
        textxalign: 'center',
      });
      const result = await this.uploadService.uploadBuffer(
        buffer,
        'image/png',
        `${sku}_barcode.png`,
      );
      return result.fileUrl;
    } catch (error) {
      this.logger.error(`Failed to generate barcode for SKU ${sku}`, error);
      return null;
    }
  }

  /** Generate barcode buffer in-memory (no R2 upload) — used for Excel export */
  private async generateBarcodeBuffer(sku: string): Promise<Buffer | null> {
    if (!sku) return null;
    let barcodeText = sku.trim();
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i.test(barcodeText) ||
      barcodeText.endsWith('_full') ||
      barcodeText.includes('-')
    ) {
      barcodeText = barcodeText.split('-')[0].toUpperCase();
    } else {
      barcodeText = barcodeText.toUpperCase();
    }

    try {
      return await bwipjs.toBuffer({
        bcid: 'code128',
        text: barcodeText,
        scale: 4,
        height: 14,
        includetext: true,
        textxalign: 'center',
        textsize: 12,
      });
    } catch (error) {
      this.logger.warn(`Failed to generate in-memory barcode for SKU ${sku}`);
      return null;
    }
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

  private extractCleanNameAndSkuFromFilename(rawFilename: string, fallbackId: string) {
    let clean = (rawFilename || '').replace(/^uploads\//i, '');
    // Strip R2/Multer UUID prefix if present
    clean = clean.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_?/i, '');
    clean = clean.replace(/^[0-9a-f]{24}_?/i, '');

    const extIdx = clean.lastIndexOf('.');
    if (extIdx > 0) {
      clean = clean.slice(0, extIdx);
    }

    clean = clean.replace(/_full$/i, '').trim();

    const shortHex = fallbackId.slice(0, 5).toUpperCase();

    if (
      !clean ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(clean) ||
      clean.toLowerCase() === 'full'
    ) {
      return {
        name: `Product ${fallbackId.slice(0, 8).toUpperCase()}`,
        sku: `LS-${shortHex}`, // Max 8 chars: 'LS-' (3) + 5 hex = 8 chars
      };
    }

    const name = clean.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    let sku = clean.toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9\-]/g, '');

    if (sku.length > 8) {
      sku = sku.slice(0, 8); // Enforce max 8 characters
    }

    return {
      name: name || `Product ${fallbackId.slice(0, 8).toUpperCase()}`,
      sku: sku || `LS-${shortHex}`,
    };
  }

  async create(dto: CreateCatalogueDto, userId: string) {
    const start = Date.now();

    // 1. Resolve or create default "Uncategorized" category
    let category = await this.prisma.category.findUnique({
      where: { slug: 'uncategorized' },
    });
    if (!category) {
      category = await this.prisma.category.create({
        data: {
          name: 'Uncategorized',
          slug: 'uncategorized',
          isActive: true,
          createdBy: userId,
        },
      });
    }

    // 2. Pre-generate all temp IDs synchronously — NO barcode upload here.
    const tempProductsData = (dto.images || []).map((img) => {
      const tempId = randomBytes(12).toString('hex');
      const { name, sku } = this.extractCleanNameAndSkuFromFilename(
        img.filename,
        tempId,
      );
      const tempSlug = this.slugify(sku);
      return { img, tempId, tempSku: sku, tempSlug, baseName: name };
    });

    // 3. Create catalogue + all products in ONE transaction using createMany for speed
    const result = await this.prisma.$transaction(async (tx) => {
      const catalogue = await tx.catalogue.create({
        data: {
          name: dto.name,
          description: dto.description,
          imageUrl: dto.imageUrl,
          isPublished: dto.isPublished,
        },
      });

      if (tempProductsData.length > 0) {
        // Bulk create all products at once (barcodeUrl left null — set during Excel import on real SKUs)
        await tx.product.createMany({
          data: tempProductsData.map((data) => ({
            id: data.tempId,
            sku: data.tempSku,
            name: data.baseName,
            slug: data.tempSlug,
            categoryId: category.id,
            catalogueIds: [catalogue.id],
            barcode: data.tempSku,
            moq: 1,
            stockQuantity: 0,
            stockStatus: 'OUT_OF_STOCK',
            isActive: false,
            createdBy: userId,
          })),
        });

        // Bulk create all product images at once
        await tx.productImage.createMany({
          data: tempProductsData.map((data) => ({
            productId: data.tempId,
            originalUrl: data.img.url,
            isPrimary: true,
            createdBy: userId,
          })),
        });
      }

      const cat = await tx.catalogue.findUnique({
        where: { id: catalogue.id },
      });
      if (!cat) {
        throw new NotFoundException(`Catalogue with ID '${catalogue.id}' not created.`);
      }
      const products = await tx.product.findMany({
        where: { catalogueIds: { has: catalogue.id } },
        include: { images: true },
      });
      return {
        ...cat,
        products,
      };
    });

    this.logger.log(
      `Catalogue created with ${dto.images.length} products in ${Date.now() - start}ms`,
    );

    if (result) {
      this.imageCleaningService
        .triggerBackgroundCleaningForCatalogue(result.id, userId)
        .catch(() => {});
    }

    return result;
  }

  async findAll(search?: string, publishedOnly = false) {
    const where: any = {};
    if (search) {
      where.name = { contains: search, mode: 'insensitive' as const };
    }
    if (publishedOnly) {
      where.isPublished = true;
    }
    const catalogues = await this.prisma.catalogue.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      catalogues.map(async (c) => {
        const [productsCount, categoriesCount, previewProducts] = await Promise.all([
          this.prisma.product.count({
            where: { catalogueIds: { has: c.id } },
          }),
          this.prisma.category.count({
            where: { catalogueId: c.id },
          }),
          this.prisma.product.findMany({
            where: { catalogueIds: { has: c.id } },
            take: 4,
            select: {
              productImage: true,
              images: {
                take: 1,
                orderBy: { sortOrder: 'asc' },
                select: { originalUrl: true },
              },
            },
          }),
        ]);

        const previewImages = previewProducts
          .map((p) => p.images?.[0]?.originalUrl || p.productImage)
          .filter((url): url is string => !!url);

        return {
          id: c.id,
          name: c.name,
          description: c.description,
          imageUrl: c.imageUrl,
          isPublished: c.isPublished,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          productsCount,
          categoriesCount,
          previewImages,
        };
      }),
    );
  }

  async findOne(
    id: string,
    search?: string,
    page?: number,
    limit?: number,
    publishedOnly = false,
    categoryId?: string,
  ) {
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    if (!objectIdRegex.test(id)) {
      throw new BadRequestException(`Invalid catalogue ID format: ${id}`);
    }

    const productWhere: any = {};
    if (typeof search === 'string' && search.trim()) {
      productWhere.OR = [
        { name: { contains: search, mode: 'insensitive' as const } },
        { sku: { contains: search, mode: 'insensitive' as const } },
        { barcode: { contains: search, mode: 'insensitive' as const } },
      ];
    }
    if (categoryId) {
      productWhere.categoryId = categoryId;
    }

    const validPage = typeof page === 'number' && page > 0 ? page : 1;
    const validLimit =
      typeof limit === 'number' && limit > 0 ? limit : undefined;

    const [catalogue, products, totalProductsCount] = await Promise.all([
      this.prisma.catalogue.findUnique({
        where: { id },
      }),
      this.prisma.product.findMany({
        where: {
          catalogueIds: { has: id },
          ...productWhere,
        },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          images: { orderBy: { sortOrder: 'asc' } },
          pricing: { include: { pricingGroup: true } },
        },
        orderBy: { createdAt: 'asc' },
        skip: validLimit ? (validPage - 1) * validLimit : undefined,
        take: validLimit,
      }),
      this.prisma.product.count({
        where: {
          catalogueIds: { has: id },
          ...productWhere,
        },
      }),
    ]);

    if (!catalogue || (publishedOnly && !catalogue.isPublished)) {
      throw new NotFoundException(`Catalogue with ID '${id}' not found.`);
    }

    return {
      ...catalogue,
      products,
      productsMeta: {
        total: totalProductsCount,
        page: validPage,
        limit: validLimit || totalProductsCount,
        totalPages: validLimit ? Math.ceil(totalProductsCount / validLimit) : 1,
      },
    };
  }

  async update(id: string, dto: UpdateCatalogueDto) {
    const catalogue = await this.prisma.catalogue.findUnique({ where: { id } });
    if (!catalogue) {
      throw new NotFoundException(`Catalogue with ID '${id}' not found.`);
    }

    return this.prisma.catalogue.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        imageUrl: dto.imageUrl,
        isPublished: dto.isPublished,
      },
    });
  }

  async remove(id: string) {
    const catalogue = await this.prisma.catalogue.findUnique({
      where: { id },
    });

    if (!catalogue) {
      throw new NotFoundException(`Catalogue with ID '${id}' not found.`);
    }

    await this.prisma.$transaction(async (tx) => {
      // Find all products associated with this catalogue
      const products = await tx.product.findMany({
        where: { catalogueIds: { has: id } },
      });

      for (const product of products) {
        // Check for references in OrderItem and BackorderApproval
        const orderItemCount = await tx.orderItem.count({
          where: { productId: product.id },
        });
        const backorderApprovalCount = await tx.backorderApproval.count({
          where: { productId: product.id },
        });

        const isReferenced =
          orderItemCount > 0 ||
          backorderApprovalCount > 0;

        const belongsToOtherCatalogues = product.catalogueIds.some(
          (cid) => cid !== id,
        );

        if (isReferenced || belongsToOtherCatalogues) {
          // Dissociate product from catalogue and deactivate it only if it doesn't belong to other catalogues
          await tx.product.update({
            where: { id: product.id },
            data: {
              catalogueIds: {
                set: product.catalogueIds.filter((cid) => cid !== id),
              },
              isActive: belongsToOtherCatalogues ? product.isActive : false,
            },
          });
        } else {
          // Cascade delete product relations inside the transaction
          await tx.imageCleaningTask.deleteMany({
            where: { productId: product.id },
          });
          await tx.productImage.deleteMany({
            where: { productId: product.id },
          });
          await tx.productPricing.deleteMany({
            where: { productId: product.id },
          });
          await tx.productCatalogFile.deleteMany({
            where: { productId: product.id },
          });
          await tx.productVideo.deleteMany({
            where: { productId: product.id },
          });
          await tx.cartItem.deleteMany({ where: { productId: product.id } });
          await tx.stockMovement.deleteMany({
            where: { productId: product.id },
          });
          await tx.backorderApproval.deleteMany({
            where: { productId: product.id },
          });

          // Safely delete product
          await tx.product.delete({
            where: { id: product.id },
          });
        }
      }

      // Unlink any categories associated with this catalogue
      await tx.category.updateMany({
        where: { catalogueId: id },
        data: { catalogueId: null },
      });

      // Finally delete the catalogue itself
      await tx.catalogue.delete({
        where: { id },
      });
    });

    return {
      message: 'Catalogue and its associated products deleted successfully.',
    };
  }

  async exportCatalogue(
    catalogueId: string,
    productIds?: string,
    categoryId?: string,
  ): Promise<Buffer> {
    const start = Date.now();
    const catalogue = await this.prisma.catalogue.findUnique({
      where: { id: catalogueId },
    });
    if (!catalogue) {
      throw new NotFoundException(`Catalogue with ID '${catalogueId}' not found.`);
    }

    const productWhere: any = {
      catalogueIds: { has: catalogueId },
    };

    if (categoryId) {
      productWhere.categoryId = categoryId;
    }

    if (productIds) {
      const ids = productIds.split(',').map((id) => id.trim()).filter(Boolean);
      if (ids.length > 0) {
        productWhere.id = { in: ids };
      }
    }

    const products = await this.prisma.product.findMany({
      where: productWhere,
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        pricing: { include: { pricingGroup: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Catalogue Products');

    // Fetch active pricing groups to generate dynamic pricing columns
    const pricingGroups = await this.prisma.pricingGroup.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });

    // Define main columns
    const columns = [
      { header: 'Product Image', key: 'productImage', width: 22 },
      { header: 'Barcode Image', key: 'barcodeImage', width: 30 },
      { header: 'Product ID (System ID - Do Not Edit)', key: 'id', width: 36 },
      { header: 'SKU', key: 'sku', width: 20 },
      { header: 'Product Name', key: 'name', width: 40 },
      { header: 'Product Description', key: 'description', width: 50 },
      { header: 'Product Price', key: 'productPrice', width: 15 },
      { header: 'Discounted price', key: 'discountedPrice', width: 18 },
      { header: 'Available quantity', key: 'stockQuantity', width: 18 },
      { header: 'Is Active (YES/NO)', key: 'isActive', width: 18 },
      { header: 'MOQ', key: 'moq', width: 10 },
      { header: 'Brand', key: 'brand', width: 15 },
      { header: 'Size', key: 'size', width: 12 },
      { header: 'Color', key: 'color', width: 12 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Tax "type"', key: 'taxType', width: 15 },
      { header: 'Tax percentage', key: 'taxPercent', width: 15 },
      { header: 'Weight', key: 'weight', width: 12 },
      { header: 'Parent product sku', key: 'parentProductSku', width: 20 },
      { header: 'Parent product id', key: 'parentProductId', width: 36 },
      { header: 'Private notes', key: 'privateNotes', width: 30 },
      { header: 'Set Name', key: 'setName', width: 20 },
      { header: 'Set Quantity', key: 'setQuantity', width: 15 },
      { header: 'Set Type', key: 'setType', width: 15 },
      { header: 'sizes', key: 'sizes', width: 15 },
      { header: 'Sizes Set Quantity', key: 'sizesSetQuantity', width: 18 },
      { header: 'colors', key: 'colors', width: 15 },
      { header: 'Colors Set Quantity', key: 'colorsSetQuantity', width: 18 },
      { header: 'nt11-48', key: 'nt11_48', width: 15 },
      { header: 'Nt11-48 Set Quantity', key: 'nt11_48SetQuantity', width: 20 },
      { header: '6-12 months', key: 'sixToTwelveMonths', width: 15 },
      {
        header: '6-12 months Set Quantity',
        key: 'sixToTwelveMonthsSetQuantity',
        width: 25,
      },
    ];

    // Add pricing columns for each group
    pricingGroups.forEach((group) => {
      columns.push(
        {
          header: `Price - ${group.code}`,
          key: `price_${group.code}`,
          width: 18,
        },
        { header: `MRP - ${group.code}`, key: `mrp_${group.code}`, width: 18 },
        {
          header: `Discount % - ${group.code}`,
          key: `discount_${group.code}`,
          width: 18,
        },
      );
    });

    sheet.columns = columns;

    // Set header row height
    const headerRow = sheet.getRow(1);
    headerRow.height = 30;
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    const sharp = require('sharp');
    const barcodeColIdx = columns.findIndex((c) => c.key === 'barcodeImage');

    // Concurrency limit = 10 to fetch/resize images and barcodes concurrently
    const limit = pLimit(10);
    this.logger.log(
      `Preparing ${products.length} product images & barcodes in parallel (concurrency=10)...`,
    );

    const imageResults = await Promise.all(
      products.map((p) =>
        limit(async () => {
          const primaryImageUrl = p.images[0]?.originalUrl || '';
          const imageUrl = p.productImage || primaryImageUrl;
          const result: {
            productId: string;
            productImageBuffer: Buffer | null;
            barcodeBuffer: Buffer | null;
          } = {
            productId: p.id,
            productImageBuffer: null,
            barcodeBuffer: null,
          };

          const [imgRes, barcodeRes] = await Promise.allSettled([
            imageUrl
              ? axios.get(imageUrl, {
                  responseType: 'arraybuffer',
                  timeout: 5000,
                })
              : Promise.resolve(null),
            this.generateBarcodeBuffer(p.sku),
          ]);

          if (imgRes.status === 'fulfilled' && imgRes.value) {
            try {
              const originalBuffer = Buffer.from(imgRes.value.data);
              result.productImageBuffer = await sharp(originalBuffer)
                .resize(300, 300, { fit: 'inside' })
                .jpeg({ quality: 90 })
                .toBuffer();
            } catch (err) {
              this.logger.warn(
                `Failed to resize image for product ${p.id}: ${err.message}`,
              );
            }
          }

          if (barcodeRes.status === 'fulfilled' && barcodeRes.value) {
            result.barcodeBuffer = barcodeRes.value;
          }

          return result;
        }),
      ),
    );

    const imageMap = new Map(imageResults.map((r) => [r.productId, r]));

    // Populate rows
    let rowIndex = 1; // Header is row 1
    for (const p of products) {
      rowIndex++;
      const primaryImageUrl = p.images[0]?.originalUrl || '';
      const imageUrl = p.productImage || primaryImageUrl;

      const rowData: any = {
        productImage: '',
        barcodeImage: '',
        id: p.id,
        sku: p.sku,
        name: p.name,
        description: p.description || '',
        productPrice: p.productPrice ? p.productPrice.toString() : '',
        discountedPrice: p.discountedPrice ? p.discountedPrice.toString() : '',
        stockQuantity: p.stockQuantity,
        isActive: p.isActive ? 'YES' : 'NO',
        moq: p.moq,
        brand: p.brand || '',
        size: p.size || '',
        color: p.color || '',
        unit: p.unit || 'PCS',
        taxType: p.taxType || '',
        taxPercent: p.taxPercent ? p.taxPercent.toString() : '0',
        weight: p.weight ? p.weight.toString() : '',
        parentProductSku: p.parentProductSku || '',
        parentProductId: p.parentProductId || '',
        privateNotes: p.privateNotes || '',
        setName: p.setName || '',
        setQuantity:
          p.setQuantity !== null && p.setQuantity !== undefined
            ? p.setQuantity
            : '',
        setType: p.setType || '',
        sizes: p.sizes || '',
        sizesSetQuantity:
          p.sizesSetQuantity !== null && p.sizesSetQuantity !== undefined
            ? p.sizesSetQuantity
            : '',
        colors: p.colors || '',
        colorsSetQuantity:
          p.colorsSetQuantity !== null && p.colorsSetQuantity !== undefined
            ? p.colorsSetQuantity
            : '',
        nt11_48: p.nt11_48 || '',
        nt11_48SetQuantity:
          p.nt11_48SetQuantity !== null && p.nt11_48SetQuantity !== undefined
            ? p.nt11_48SetQuantity
            : '',
        sixToTwelveMonths: p.sixToTwelveMonths || '',
        sixToTwelveMonthsSetQuantity:
          p.sixToTwelveMonthsSetQuantity !== null &&
          p.sixToTwelveMonthsSetQuantity !== undefined
            ? p.sixToTwelveMonthsSetQuantity
            : '',
      };

      pricingGroups.forEach((group) => {
        const pricing = p.pricing.find((pr) => pr.pricingGroupId === group.id);
        rowData[`price_${group.code}`] = pricing
          ? pricing.price.toString()
          : '';
        rowData[`mrp_${group.code}`] =
          pricing && pricing.mrp ? pricing.mrp.toString() : '';
        rowData[`discount_${group.code}`] =
          pricing && pricing.discountPercent
            ? pricing.discountPercent.toString()
            : '';
      });

      sheet.addRow(rowData);
      const row = sheet.getRow(rowIndex);
      row.height = 95;
      row.alignment = { vertical: 'middle' };

      // Use pre-downloaded and resized buffers
      const imgData = imageMap.get(p.id);
      if (imgData?.productImageBuffer) {
        const imageId = workbook.addImage({
          buffer: imgData.productImageBuffer,
          extension: 'jpeg',
        });
        sheet.addImage(imageId, {
          tl: { col: 0.05, row: rowIndex - 1 + 0.05 },
          ext: { width: 120, height: 110 },
          editAs: 'oneCell',
        });
      }

      if (imgData?.barcodeBuffer) {
        const imageId = workbook.addImage({
          buffer: imgData.barcodeBuffer,
          extension: 'png',
        });
        sheet.addImage(imageId, {
          tl: { col: barcodeColIdx + 0.05, row: rowIndex - 1 + 0.08 },
          ext: { width: 200, height: 100 },
          editAs: 'oneCell',
        });
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    this.logger.log(
      `Export completed for ${products.length} products in ${Date.now() - start}ms`,
    );
    return buffer as Buffer;
  }

  async importCatalogue(
    catalogueId: string,
    fileBuffer: Buffer,
    userId: string,
    targetCategoryId?: string,
  ) {
    const start = Date.now();
    const catalogue = await this.findOne(catalogueId);

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new BadRequestException('The uploaded file is empty or invalid.');
    }

    const headers: string[] = [];
    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
      headers[colNumber] = cell.value ? cell.value.toString().trim() : '';
    });

    const idHeaderKey = headers.find(
      (h) =>
        h &&
        (h.toLowerCase().includes('product id') || h.toLowerCase() === 'id'),
    );
    const skuHeaderKey = headers.find((h) => h && h.toLowerCase() === 'sku');
    const nameHeaderKey = headers.find(
      (h) =>
        h && (h.toLowerCase() === 'product name' || h.toLowerCase() === 'name'),
    );
    const descHeaderKey = headers.find(
      (h) =>
        h &&
        (h.toLowerCase() === 'product description' ||
          h.toLowerCase() === 'description'),
    );
    const productImageHeaderKey = headers.find(
      (h) => h && h.toLowerCase() === 'product image',
    );
    const productPictureUrlHeaderKey = headers.find(
      (h) => h && h.toLowerCase() === 'product picture url',
    );
    const productPriceHeaderKey = headers.find(
      (h) => h && h.toLowerCase() === 'product price',
    );
    const discountedPriceHeaderKey = headers.find(
      (h) => h && h.toLowerCase() === 'discounted price',
    );
    const stockHeaderKey = headers.find(
      (h) =>
        h &&
        (h.toLowerCase().includes('available quantity') ||
          h.toLowerCase().includes('stock quantity')),
    );
    const activeHeaderKey = headers.find(
      (h) =>
        h &&
        (h.toLowerCase().includes('is active') || h.toLowerCase() === 'active'),
    );
    const moqHeaderKey = headers.find((h) => h && h.toLowerCase() === 'moq');
    const brandHeaderKey = headers.find(
      (h) => h && h.toLowerCase() === 'brand',
    );
    const sizeHeaderKey = headers.find((h) => h && h.toLowerCase() === 'size');
    const colorHeaderKey = headers.find(
      (h) => h && h.toLowerCase() === 'color',
    );
    const unitHeaderKey = headers.find((h) => h && h.toLowerCase() === 'unit');
    const taxTypeHeaderKey = headers.find(
      (h) =>
        h &&
        (h.toLowerCase() === 'tax "type"' || h.toLowerCase() === 'tax type'),
    );
    const taxHeaderKey = headers.find(
      (h) =>
        h &&
        (h.toLowerCase() === 'tax percentage' ||
          h.toLowerCase().includes('tax percent')),
    );
    const weightHeaderKey = headers.find(
      (h) => h && h.toLowerCase() === 'weight',
    );
    const parentProductSkuHeaderKey = headers.find(
      (h) => h && h.toLowerCase() === 'parent product sku',
    );
    const parentProductIdHeaderKey = headers.find(
      (h) => h && h.toLowerCase() === 'parent product id',
    );
    const privateNotesHeaderKey = headers.find(
      (h) => h && h.toLowerCase() === 'private notes',
    );
    const setNameHeaderKey = headers.find(
      (h) => h && h.toLowerCase() === 'set name',
    );
    const setQuantityHeaderKey = headers.find(
      (h) => h && h.toLowerCase() === 'set quantity',
    );
    const setTypeHeaderKey = headers.find(
      (h) => h && h.toLowerCase() === 'set type',
    );
    const sizesHeaderKey = headers.find(
      (h) => h && h.toLowerCase() === 'sizes',
    );
    const sizesSetQuantityHeaderKey = headers.find(
      (h) => h && h.toLowerCase() === 'sizes set quantity',
    );
    const colorsHeaderKey = headers.find(
      (h) => h && h.toLowerCase() === 'colors',
    );
    const colorsSetQuantityHeaderKey = headers.find(
      (h) => h && h.toLowerCase() === 'colors set quantity',
    );
    const nt11_48HeaderKey = headers.find(
      (h) => h && h.toLowerCase() === 'nt11-48',
    );
    const nt11_48SetQuantityHeaderKey = headers.find(
      (h) => h && h.toLowerCase() === 'nt11-48 set quantity',
    );
    const sixToTwelveMonthsHeaderKey = headers.find(
      (h) => h && h.toLowerCase() === '6-12 months',
    );
    const sixToTwelveMonthsSetQuantityHeaderKey = headers.find(
      (h) => h && h.toLowerCase() === '6-12 months set quantity',
    );

    const pricingHeaderMap: {
      [colIdx: number]: {
        type: 'price' | 'mrp' | 'discount';
        groupCode: string;
      };
    } = {};
    headers.forEach((header, idx) => {
      if (!header) return;
      const priceMatch = header.match(/Price\s*-\s*(.+)/i);
      if (priceMatch) {
        pricingHeaderMap[idx] = {
          type: 'price',
          groupCode: priceMatch[1].trim().toUpperCase(),
        };
        return;
      }
      const mrpMatch = header.match(/MRP\s*-\s*(.+)/i);
      if (mrpMatch) {
        pricingHeaderMap[idx] = {
          type: 'mrp',
          groupCode: mrpMatch[1].trim().toUpperCase(),
        };
        return;
      }
      const discountMatch = header.match(/Discount\s*(?:%\s*)?-\s*(.+)/i);
      if (discountMatch) {
        pricingHeaderMap[idx] = {
          type: 'discount',
          groupCode: discountMatch[1].trim().toUpperCase(),
        };
        return;
      }
    });

    const getCellValueString = (cell: any): string | null => {
      if (!cell || cell.value === null || cell.value === undefined) return null;
      if (typeof cell.value === 'object') {
        if (cell.value.result !== undefined && cell.value.result !== null)
          return cell.value.result.toString();
        if (cell.value.text !== undefined && cell.value.text !== null)
          return cell.value.text.toString();
        return JSON.stringify(cell.value);
      }
      return cell.value.toString();
    };

    const getCellValueNumber = (cell: any): number | null => {
      if (!cell || cell.value === null || cell.value === undefined) return null;
      let val = cell.value;
      if (typeof val === 'object') {
        if (val.result !== undefined && val.result !== null) {
          val = val.result;
        } else {
          return null;
        }
      }
      const parsed = parseFloat(val);
      return isNaN(parsed) ? null : parsed;
    };

    const parsedRows: any[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const getValString = (headerKey: string | undefined) => {
        if (!headerKey) return undefined;
        const idx = headers.indexOf(headerKey);
        if (idx === -1) return undefined;
        const val = getCellValueString(row.getCell(idx));
        return val ? val.trim() : null;
      };

      const getValNumber = (headerKey: string | undefined) => {
        if (!headerKey) return undefined;
        const idx = headers.indexOf(headerKey);
        if (idx === -1) return undefined;
        return getCellValueNumber(row.getCell(idx));
      };

      const roundVal = (
        v: number | null | undefined,
        defaultValue: any = null,
      ) => {
        if (v === undefined) return undefined;
        if (v === null) return defaultValue;
        return Math.round(v);
      };

      const id = getValString(idHeaderKey);
      const sku = getValString(skuHeaderKey);
      const name = getValString(nameHeaderKey);

      // Skip the row if it has neither SKU nor Name (likely empty row)
      if (!sku && !name) return;

      const isActiveStr = getValString(activeHeaderKey);
      let isActive: boolean | undefined = undefined;
      if (activeHeaderKey) {
        if (isActiveStr !== undefined && isActiveStr !== null) {
          const cleanVal = isActiveStr.trim().toUpperCase();
          isActive =
            cleanVal === 'YES' || cleanVal === 'TRUE' || cleanVal === '1';
        } else {
          isActive = false;
        }
      }

      const pricingData: {
        [groupCode: string]: {
          price?: number;
          mrp?: number;
          discountPercent?: number;
        };
      } = {};
      Object.keys(pricingHeaderMap).forEach((colIdxStr) => {
        const colIdx = parseInt(colIdxStr);
        const mapInfo = pricingHeaderMap[colIdx];
        const cellVal = getCellValueNumber(row.getCell(colIdx));
        if (cellVal !== null && cellVal !== undefined) {
          if (!pricingData[mapInfo.groupCode])
            pricingData[mapInfo.groupCode] = {};
          if (mapInfo.type === 'price')
            pricingData[mapInfo.groupCode].price = cellVal;
          if (mapInfo.type === 'mrp')
            pricingData[mapInfo.groupCode].mrp = cellVal;
          if (mapInfo.type === 'discount')
            pricingData[mapInfo.groupCode].discountPercent = cellVal;
        }
      });

      const stockQuantity = getValNumber(stockHeaderKey);
      const moq = getValNumber(moqHeaderKey);
      const setQuantity = getValNumber(setQuantityHeaderKey);
      const sizesSetQuantity = getValNumber(sizesSetQuantityHeaderKey);
      const colorsSetQuantity = getValNumber(colorsSetQuantityHeaderKey);
      const nt11_48SetQuantity = getValNumber(nt11_48SetQuantityHeaderKey);
      const sixToTwelveMonthsSetQuantity = getValNumber(
        sixToTwelveMonthsSetQuantityHeaderKey,
      );

      parsedRows.push({
        rowNumber,
        id: id || null,
        sku: sku ? sku.trim() : null,
        name: name ? name.trim() : null,
        description: getValString(descHeaderKey)?.trim() ?? null,
        productImage: getValString(productImageHeaderKey),
        productPictureUrl: getValString(productPictureUrlHeaderKey),
        productPrice: getValNumber(productPriceHeaderKey),
        discountedPrice: getValNumber(discountedPriceHeaderKey),
        stockQuantity: roundVal(stockQuantity, 0),
        moq: roundVal(moq, 1),
        brand: getValString(brandHeaderKey),
        size: getValString(sizeHeaderKey),
        color: getValString(colorHeaderKey),
        unit: getValString(unitHeaderKey) || 'PCS',
        taxType: getValString(taxTypeHeaderKey),
        taxPercent: getValNumber(taxHeaderKey),
        weight: getValNumber(weightHeaderKey),
        parentProductSku: getValString(parentProductSkuHeaderKey),
        parentProductId: getValString(parentProductIdHeaderKey),
        privateNotes: getValString(privateNotesHeaderKey),
        setName: getValString(setNameHeaderKey),
        setQuantity: roundVal(setQuantity, null),
        setType: getValString(setTypeHeaderKey),
        sizes: getValString(sizesHeaderKey),
        sizesSetQuantity: roundVal(sizesSetQuantity, null),
        colors: getValString(colorsHeaderKey),
        colorsSetQuantity: roundVal(colorsSetQuantity, null),
        nt11_48: getValString(nt11_48HeaderKey),
        nt11_48SetQuantity: roundVal(nt11_48SetQuantity, null),
        sixToTwelveMonths: getValString(sixToTwelveMonthsHeaderKey),
        sixToTwelveMonthsSetQuantity: roundVal(
          sixToTwelveMonthsSetQuantity,
          null,
        ),
        isActive,
        pricingData,
      });
    });

    // ─── ObjectId validation helper ───────────────────────────────────────────
    const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;
    const isValidObjectId = (v: string | null) =>
      !!v && OBJECT_ID_REGEX.test(v);

    // ─── Classify rows: existing products to UPDATE vs new products to CREATE ──
    const catalogProductIds = new Set(catalogue.products.map((p) => p.id));
    const allSkusInFile = parsedRows.map((r) => r.sku).filter(Boolean);
    const validObjectIdsInFile = parsedRows
      .map((r) => r.id)
      .filter(isValidObjectId);

    const dbProducts = await this.prisma.product.findMany({
      where: {
        OR: [
          { sku: { in: allSkusInFile } },
          { id: { in: validObjectIdsInFile } },
        ],
      },
      select: { id: true, sku: true, barcodeUrl: true, catalogueIds: true },
    });

    const skuToDbProductMap = new Map(
      dbProducts.map((p) => [p.sku.toUpperCase(), p]),
    );
    const idToDbProductMap = new Map(dbProducts.map((p) => [p.id, p]));

    const barcodeLimit = pLimit(10);
    await Promise.all(
      parsedRows.map((row) =>
        barcodeLimit(async () => {
          if (!row.sku) {
            row.barcodeUrl = null;
            return;
          }
          const upperSku = row.sku.toUpperCase();
          let dbProduct = skuToDbProductMap.get(upperSku);
          if (!dbProduct && isValidObjectId(row.id)) {
            dbProduct = idToDbProductMap.get(row.id);
          }

          if (dbProduct) {
            row.id = dbProduct.id;
            row.isNew = false;
            if (upperSku === dbProduct.sku.toUpperCase() && dbProduct.barcodeUrl) {
              row.barcodeUrl = dbProduct.barcodeUrl;
            } else {
              row.barcodeUrl = await this.generateAndUploadBarcode(row.sku);
            }
          } else {
            row.isNew = true;
            row.id = randomBytes(12).toString('hex');
            row.barcodeUrl = await this.generateAndUploadBarcode(row.sku);
          }
        }),
      ),
    );

    // ─── SKU uniqueness check ───
    const skuSet = new Set<string>();
    for (const row of parsedRows) {
      if (!row.sku)
        throw new BadRequestException(`Row ${row.rowNumber}: SKU is required.`);
      if (!row.name)
        throw new BadRequestException(
          `Row ${row.rowNumber}: Product name is required.`,
        );

      const upperSku = row.sku.toUpperCase();
      if (skuSet.has(upperSku))
        throw new BadRequestException(
          `Duplicate SKU "${row.sku}" found in the uploaded Excel sheet.`,
        );
      skuSet.add(upperSku);
    }

    // --- OPTIMIZATION: Pre-fetch ALL existing product images in ONE query, build in-memory lookup ---
    const allProductIds = parsedRows.map((r) => r.id);
    const existingImages = await this.prisma.productImage.findMany({
      where: { productId: { in: allProductIds } },
      select: { productId: true, originalUrl: true, isPrimary: true },
    });
    // Map: productId -> Set of existing originalUrls
    const existingImageMap = new Map<string, Set<string>>();
    for (const img of existingImages) {
      if (!existingImageMap.has(img.productId))
        existingImageMap.set(img.productId, new Set());
      existingImageMap.get(img.productId)!.add(img.originalUrl);
    }

    // --- OPTIMIZATION: Pre-fetch all pricing groups in one query ---
    const allGroupCodes = [
      ...new Set(parsedRows.flatMap((r) => Object.keys(r.pricingData))),
    ];
    const pricingGroups = await this.prisma.pricingGroup.findMany({
      where: { code: { in: allGroupCodes } },
    });
    const pricingGroupMap = new Map(pricingGroups.map((g) => [g.code, g]));

    // Execute updates inside Transaction
    await this.prisma.$transaction(
      async (tx) => {
        // 1. Resolve target category or default "Uncategorized" category for new products
        let category: any = null;
        if (targetCategoryId) {
          category = await tx.category.findUnique({
            where: { id: targetCategoryId },
          });
        }
        if (!category) {
          category = await tx.category.findUnique({
            where: { slug: 'uncategorized' },
          });
          if (!category) {
            category = await tx.category.create({
              data: {
                name: 'Uncategorized',
                slug: 'uncategorized',
                isActive: true,
                createdBy: userId,
              },
            });
          }
        }

        // 1b. Resolve or create all missing pricing groups sequentially to avoid race conditions
        for (const groupCode of allGroupCodes) {
          let pricingGroup = pricingGroupMap.get(groupCode);
          if (!pricingGroup) {
            const dbGroup = await tx.pricingGroup.findUnique({
              where: { code: groupCode },
            });
            if (dbGroup) {
              pricingGroup = dbGroup;
            } else {
              pricingGroup = await tx.pricingGroup.create({
                data: {
                  name: groupCode.charAt(0) + groupCode.slice(1).toLowerCase(),
                  code: groupCode,
                  description: `Automatically created during catalog import`,
                  isActive: true,
                },
              });
            }
            pricingGroupMap.set(groupCode, pricingGroup);
          }
        }

        // 2. Dissociate or delete catalogue products omitted from Excel
        const uploadedExistingIds = new Set(
          parsedRows.filter((r) => !r.isNew).map((r) => r.id),
        );
        const omittedProducts = catalogue.products.filter(
          (p) => !uploadedExistingIds.has(p.id),
        );

        for (const product of omittedProducts) {
          const belongsToOtherCatalogues = product.catalogueIds.some(
            (cid) => cid !== catalogueId,
          );
          // Check for references
          const orderItemCount = await tx.orderItem.count({
            where: { productId: product.id },
          });
          const backorderApprovalCount = await tx.backorderApproval.count({
            where: { productId: product.id },
          });
          const isReferenced =
            orderItemCount > 0 ||
            backorderApprovalCount > 0;

          if (isReferenced || belongsToOtherCatalogues) {
            // Just dissociate from this catalogue
            await tx.product.update({
              where: { id: product.id },
              data: {
                catalogueIds: {
                  set: product.catalogueIds.filter(
                    (cid) => cid !== catalogueId,
                  ),
                },
                isActive: belongsToOtherCatalogues ? product.isActive : false,
              },
            });
          } else {
            // Cascade delete product relations and product itself
            await tx.imageCleaningTask.deleteMany({
              where: { productId: product.id },
            });
            await tx.productImage.deleteMany({
              where: { productId: product.id },
            });
            await tx.productPricing.deleteMany({
              where: { productId: product.id },
            });
            await tx.productCatalogFile.deleteMany({
              where: { productId: product.id },
            });
            await tx.productVideo.deleteMany({
              where: { productId: product.id },
            });
            await tx.cartItem.deleteMany({ where: { productId: product.id } });
            await tx.stockMovement.deleteMany({
              where: { productId: product.id },
            });
            await tx.backorderApproval.deleteMany({
              where: { productId: product.id },
            });
            await tx.product.delete({
              where: { id: product.id },
            });
          }
        }

        // 3. Process all rows: CREATE new rows in bulk, UPDATE existing rows in concurrency-limited batches
        const newRows = parsedRows.filter((r) => r.isNew);
        const existingRows = parsedRows.filter((r) => !r.isNew);

        // Bulk Create New Products
        if (newRows.length > 0) {
          await tx.product.createMany({
            data: newRows.map((row) => {
              const slug = `${this.slugify(row.name)}-${row.sku.toLowerCase()}`;
              return {
                id: row.id,
                sku: row.sku,
                name: row.name,
                slug,
                description: row.description,
                productImage: row.productImage,
                productPictureUrl: row.productPictureUrl,
                productPrice: row.productPrice,
                discountedPrice: row.discountedPrice,
                stockQuantity: row.stockQuantity,
                moq: row.moq,
                brand: row.brand,
                size: row.size,
                color: row.color,
                unit: row.unit || 'PCS',
                taxType: row.taxType,
                taxPercent: row.taxPercent,
                weight: row.weight,
                parentProductSku: row.parentProductSku,
                parentProductId: row.parentProductId,
                privateNotes: row.privateNotes,
                setName: row.setName,
                setQuantity: row.setQuantity,
                setType: row.setType,
                sizes: row.sizes,
                sizesSetQuantity: row.sizesSetQuantity,
                colors: row.colors,
                colorsSetQuantity: row.colorsSetQuantity,
                nt11_48: row.nt11_48,
                nt11_48SetQuantity: row.nt11_48SetQuantity,
                sixToTwelveMonths: row.sixToTwelveMonths,
                sixToTwelveMonthsSetQuantity: row.sixToTwelveMonthsSetQuantity,
                isActive: row.isActive,
                barcode: row.sku,
                barcodeUrl: row.barcodeUrl,
                stockStatus: row.stockQuantity > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
                categoryId: category.id,
                catalogueIds: [catalogueId],
                createdBy: userId,
              };
            }),
          });

          // Product Image createMany for new products
          const newProductImagesData: any[] = [];
          for (const row of newRows) {
            if (row.productImage || row.productPictureUrl) {
              const primaryUrl = row.productImage || row.productPictureUrl;
              newProductImagesData.push({
                productId: row.id,
                originalUrl: primaryUrl,
                isPrimary: true,
                createdBy: userId,
              });
            }
          }
          if (newProductImagesData.length > 0) {
            await tx.productImage.createMany({
              data: newProductImagesData,
            });
          }

          // Product Pricing createMany for new products
          const newProductPricingData: any[] = [];
          for (const row of newRows) {
            Object.keys(row.pricingData).forEach((groupCode) => {
              const groupPricing = row.pricingData[groupCode];
              if (groupPricing.price !== undefined && groupPricing.price !== null) {
                const pricingGroup = pricingGroupMap.get(groupCode)!;
                newProductPricingData.push({
                  productId: row.id,
                  pricingGroupId: pricingGroup.id,
                  price: groupPricing.price,
                  mrp: groupPricing.mrp,
                  discountPercent: groupPricing.discountPercent,
                  createdBy: userId,
                });
              }
            });
          }
          if (newProductPricingData.length > 0) {
            await tx.productPricing.createMany({
              data: newProductPricingData,
            });
          }
        }

        // Concurrency-limited Updates for Existing Products
        if (existingRows.length > 0) {
          const updateLimit = pLimit(15);
          await Promise.all(
            existingRows.map((row) =>
              updateLimit(async () => {
                const slug = `${this.slugify(row.name)}-${row.sku.toLowerCase()}`;
                const existingProduct =
                  idToDbProductMap.get(row.id) ||
                  skuToDbProductMap.get(row.sku.toUpperCase());
                const currentIds = existingProduct?.catalogueIds || [];
                const nextIds = Array.from(new Set([...currentIds, catalogueId]));

                await tx.product.update({
                  where: { id: row.id },
                  data: {
                    sku: row.sku,
                    name: row.name,
                    slug,
                    description: row.description,
                    productImage: row.productImage,
                    productPictureUrl: row.productPictureUrl,
                    productPrice: row.productPrice,
                    discountedPrice: row.discountedPrice,
                    stockQuantity: row.stockQuantity,
                    moq: row.moq,
                    brand: row.brand,
                    size: row.size,
                    color: row.color,
                    unit: row.unit,
                    taxType: row.taxType,
                    taxPercent: row.taxPercent,
                    weight: row.weight,
                    parentProductSku: row.parentProductSku,
                    parentProductId: row.parentProductId,
                    privateNotes: row.privateNotes,
                    setName: row.setName,
                    setQuantity: row.setQuantity,
                    setType: row.setType,
                    sizes: row.sizes,
                    sizesSetQuantity: row.sizesSetQuantity,
                    colors: row.colors,
                    colorsSetQuantity: row.colorsSetQuantity,
                    nt11_48: row.nt11_48,
                    nt11_48SetQuantity: row.nt11_48SetQuantity,
                    sixToTwelveMonths: row.sixToTwelveMonths,
                    sixToTwelveMonthsSetQuantity: row.sixToTwelveMonthsSetQuantity,
                    isActive: row.isActive,
                    barcode: row.sku,
                    barcodeUrl: row.barcodeUrl,
                    stockStatus: row.stockQuantity > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
                    catalogueIds: {
                      set: nextIds,
                    },
                    updatedBy: userId,
                  },
                });

                // Smart Image Sync
                const urlsToSync = [
                  row.productImage,
                  row.productPictureUrl,
                ].filter((url): url is string => !!url && url.trim().length > 0);
                const knownUrls = existingImageMap.get(row.id) ?? new Set<string>();
                const newUrls = urlsToSync
                  .map((u) => u.trim())
                  .filter((u) => !knownUrls.has(u));

                if (newUrls.length > 0) {
                  await tx.productImage.updateMany({
                    where: { productId: row.id, isPrimary: true },
                    data: { isPrimary: false },
                  });
                  await tx.productImage.create({
                    data: {
                      productId: row.id,
                      originalUrl: newUrls[0],
                      isPrimary: true,
                      createdBy: userId,
                    },
                  });
                  if (newUrls.length > 1) {
                    await tx.productImage.createMany({
                      data: newUrls.slice(1).map((u) => ({
                        productId: row.id,
                        originalUrl: u,
                        isPrimary: false,
                        createdBy: userId,
                      })),
                    });
                  }
                }

                // Pricing upserts
                await Promise.all(
                  Object.keys(row.pricingData).map(async (groupCode) => {
                    const groupPricing = row.pricingData[groupCode];
                    if (groupPricing.price === undefined || groupPricing.price === null)
                      return;

                    const pricingGroup = pricingGroupMap.get(groupCode)!;
                    await tx.productPricing.upsert({
                      where: {
                        productId_pricingGroupId: {
                          productId: row.id,
                          pricingGroupId: pricingGroup.id,
                        },
                      },
                      update: {
                        price: groupPricing.price,
                        mrp: groupPricing.mrp,
                        discountPercent: groupPricing.discountPercent,
                        updatedBy: userId,
                      },
                      create: {
                        productId: row.id,
                        pricingGroupId: pricingGroup.id,
                        price: groupPricing.price,
                        mrp: groupPricing.mrp,
                        discountPercent: groupPricing.discountPercent,
                        createdBy: userId,
                      },
                    });
                  })
                );
              })
            )
          );
        }
      },
      { timeout: 60000 },
    ); // Extended timeout for large catalogues

    this.logger.log(
      `Import completed for ${parsedRows.length} products in ${Date.now() - start}ms`,
    );

    this.imageCleaningService
      .triggerBackgroundCleaningForCatalogue(catalogueId, userId)
      .catch(() => {});

    return { message: 'Catalogue products successfully updated and replaced.' };
  }

  async bulkAddProducts(
    catalogueId: string,
    files: Express.Multer.File[],
    userId: string,
    targetCategoryId?: string,
  ) {
    const start = Date.now();
    const catalogue = await this.prisma.catalogue.findUnique({
      where: { id: catalogueId },
    });
    if (!catalogue) {
      throw new NotFoundException(`Catalogue with ID '${catalogueId}' not found.`);
    }

    // 1. Resolve category: check targetCategoryId first, fallback to "Uncategorized"
    let category: any = null;
    if (targetCategoryId) {
      category = await this.prisma.category.findUnique({
        where: { id: targetCategoryId },
      });
    }
    if (!category) {
      category = await this.prisma.category.findUnique({
        where: { slug: 'uncategorized' },
      });
    }
    if (!category) {
      category = await this.prisma.category.create({
        data: {
          name: 'Uncategorized',
          slug: 'uncategorized',
          isActive: true,
          createdBy: userId,
        },
      });
    }

    // 2. Upload files in parallel batches to R2
    const limit = pLimit(10);
    const uploadPromises = files.map((file) =>
      limit(async () => {
        const result = await this.uploadService.uploadDirectFile(file);
        return {
          url: result.fileUrl,
          filename: file.originalname,
        };
      }),
    );
    const uploadedImages = await Promise.all(uploadPromises);

    // 3. Extract SKUs from filenames
    const uploadedSkus = uploadedImages.map((img, idx) => {
      const { sku } = this.extractCleanNameAndSkuFromFilename(
        img.filename,
        `temp-${idx}`,
      );
      return sku;
    });

    // Fetch all existing products with the matching SKUs to update or skip
    const existingProducts = await this.prisma.product.findMany({
      where: {
        sku: { in: uploadedSkus },
      },
      include: {
        images: true,
      },
    });
    const existingProductsMap = new Map(
      existingProducts.map((p) => [p.sku.toUpperCase(), p]),
    );

    // Identify which SKUs need barcode generated/uploaded
    const barcodeMap = new Map<string, string | null>();
    const barcodeLimit = pLimit(10);
    await Promise.all(
      uploadedSkus.map((sku) =>
        barcodeLimit(async () => {
          const upperSku = sku.toUpperCase();
          const existing = existingProductsMap.get(upperSku);
          if (existing && existing.barcodeUrl) {
            barcodeMap.set(upperSku, existing.barcodeUrl);
          } else {
            const url = await this.generateAndUploadBarcode(sku);
            barcodeMap.set(upperSku, url);
          }
        }),
      ),
    );

    const newProductsData: any[] = [];
    const newProductImagesData: any[] = [];
    const productsToUpdate: { id: string; catalogueIds: string[]; productImage: string; barcode: string; barcodeUrl: string | null }[] = [];
    const newImagesForExistingProducts: { productId: string; originalUrl: string; isPrimary: boolean; createdBy: string }[] = [];

    for (const img of uploadedImages) {
      if (!img.url) continue;
      const productId = randomBytes(12).toString('hex');
      const { name, sku } = this.extractCleanNameAndSkuFromFilename(
        img.filename,
        productId,
      );

      const existingProduct = existingProductsMap.get(sku.toUpperCase());
      if (existingProduct) {
        // Product already exists: add it to this catalogue and update product image
        const updatedCatalogueIds = Array.from(
          new Set([...existingProduct.catalogueIds, catalogueId]),
        );
        productsToUpdate.push({
          id: existingProduct.id,
          catalogueIds: updatedCatalogueIds,
          productImage: img.url,
          barcode: sku,
          barcodeUrl: barcodeMap.get(sku.toUpperCase()) || null,
        });

        const hasPrimaryImage = existingProduct.images.some((i) => i.isPrimary);
        if (!hasPrimaryImage) {
          newImagesForExistingProducts.push({
            productId: existingProduct.id,
            originalUrl: img.url,
            isPrimary: true,
            createdBy: userId,
          });
        }
      } else {
        const slug = this.slugify(sku);

        newProductsData.push({
          id: productId,
          sku: sku,
          name: name,
          slug: slug,
          categoryId: category.id,
          catalogueIds: [catalogueId],
          moq: 1,
          stockQuantity: 0,
          stockStatus: 'OUT_OF_STOCK',
          isActive: true,
          createdBy: userId,
          productImage: img.url,
          barcode: sku,
          barcodeUrl: barcodeMap.get(sku.toUpperCase()) || null,
        });

        newProductImagesData.push({
          productId: productId,
          originalUrl: img.url,
          isPrimary: true,
          createdBy: userId,
        });
      }
    }

    // Transaction for reliability and database integrity
    await this.prisma.$transaction(
      async (tx) => {
        // 1. Create new products
        if (newProductsData.length > 0) {
          await tx.product.createMany({
            data: newProductsData,
          });

          await tx.productImage.createMany({
            data: newProductImagesData,
          });
        }

        // 2. Update existing products
        for (const prod of productsToUpdate) {
          await tx.product.update({
            where: { id: prod.id },
            data: {
              catalogueIds: prod.catalogueIds,
              productImage: prod.productImage,
              barcode: prod.barcode,
              barcodeUrl: prod.barcodeUrl,
            },
          });
        }

        // 3. Create images for existing products if needed
        if (newImagesForExistingProducts.length > 0) {
          await tx.productImage.createMany({
            data: newImagesForExistingProducts,
          });
        }
      },
      { timeout: 60000 },
    );

    this.logger.log(
      `Bulk added ${newProductsData.length} new and updated ${productsToUpdate.length} existing products in catalogue ${catalogueId} in ${Date.now() - start}ms`,
    );

    // Trigger background cleaning (if required)
    this.imageCleaningService
      .triggerBackgroundCleaningForCatalogue(catalogueId, userId)
      .catch(() => {});

    return {
      message: `${newProductsData.length} new products created and ${productsToUpdate.length} existing products updated.`,
      addedCount: newProductsData.length,
      updatedCount: productsToUpdate.length,
    };
  }

  async addProductsToCatalogue(catalogueId: string, productIds: string[]) {
    const catalogue = await this.prisma.catalogue.findUnique({
      where: { id: catalogueId },
    });
    if (!catalogue) {
      throw new NotFoundException(`Catalogue with ID '${catalogueId}' not found.`);
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Update Catalogue's productIds (union of current productIds and new productIds)
      const updatedProductIds = Array.from(new Set([...catalogue.productIds, ...productIds]));
      await tx.catalogue.update({
        where: { id: catalogueId },
        data: { productIds: updatedProductIds },
      });

      // 2. For each product, add catalogueId to its catalogueIds array
      for (const productId of productIds) {
        const product = await tx.product.findUnique({
          where: { id: productId },
        });
        if (product) {
          const updatedCatalogueIds = Array.from(new Set([...product.catalogueIds, catalogueId]));
          await tx.product.update({
            where: { id: productId },
            data: { catalogueIds: updatedCatalogueIds },
          });
        }
      }

      return { success: true };
    });
  }
}
