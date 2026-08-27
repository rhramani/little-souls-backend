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

@Injectable()
export class CatalogueService {
  private readonly logger = new Logger(CatalogueService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
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
    const barcodeText = sku.trim().replace(/_full$/i, '');

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

  private formatSku(rawSku: string | null | undefined, fallbackId: string): string;
  private formatSku(rawSku?: string | null, fallbackId?: string): string | null;
  private formatSku(rawSku?: string | null, fallbackId?: string): string | null {
    const fallback = fallbackId ? `LS-${fallbackId.slice(0, 5).toUpperCase()}` : null;
    if (!rawSku || !rawSku.trim()) {
      return fallback;
    }
    const trimmed = rawSku.trim();
    // If it looks like a WhatsApp or raw filename string (contains spaces or starts with WhatsApp/IMG)
    if (/\s/.test(trimmed) || /^(WhatsApp|IMG|DSC|PXL|Photo|Picture)/i.test(trimmed)) {
      let clean = trimmed.toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9\-]/g, '');
      if (clean.length > 8) {
        clean = clean.slice(0, 8).replace(/-+$/, '');
      }
      if (clean) return clean;
    }

    // Clean valid custom SKU (uppercase, sanitize non-alphanumeric/hyphen, max 30 chars)
    let sku = trimmed.toUpperCase().replace(/[^A-Z0-9\-]/g, '');
    if (sku.length > 30) {
      sku = sku.slice(0, 30).replace(/-+$/, '');
    }
    return sku || fallback;
  }

  private getUniqueSku(
    rawSku: string | null | undefined,
    usedSkus: Set<string>,
    fallbackId?: string,
  ): string {
    const baseSku =
      this.formatSku(rawSku, fallbackId!) ||
      `LS-${randomBytes(3).toString('hex').toUpperCase()}`;
    let finalSku = baseSku;
    let counter = 1;
    while (usedSkus.has(finalSku.toUpperCase())) {
      const suffix = counter.toString();
      const maxLen = baseSku.length > 8 ? 30 : 8;
      const head = baseSku
        .slice(0, Math.max(1, maxLen - suffix.length))
        .replace(/-+$/, '');
      finalSku = `${head}${suffix}`;
      counter++;
    }
    usedSkus.add(finalSku.toUpperCase());
    return finalSku;
  }

  private extractCleanNameAndSkuFromFilename(
    rawFilename: string,
    fallbackId: string,
    usedSkus?: Set<string>,
  ): { name: string; sku: string } {
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
      const sku = usedSkus
        ? this.getUniqueSku(`LS-${shortHex}`, usedSkus, fallbackId)
        : `LS-${shortHex}`;
      return {
        name: `Product ${fallbackId.slice(0, 8).toUpperCase()}`,
        sku,
      };
    }

    const name = clean.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    const rawBaseSku = clean.toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9\-]/g, '');

    const sku = usedSkus
      ? this.getUniqueSku(rawBaseSku || `LS-${shortHex}`, usedSkus, fallbackId)
      : this.formatSku(rawBaseSku || `LS-${shortHex}`, fallbackId);

    return {
      name: name || `Product ${fallbackId.slice(0, 8).toUpperCase()}`,
      sku,
    };
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
    const existingDbProducts = await this.prisma.product.findMany({
      select: { sku: true },
    });
    const usedSkus = new Set(existingDbProducts.map((p) => p.sku.toUpperCase()));

    const tempProductsData = (dto.images || []).map((img) => {
      const tempId = randomBytes(12).toString('hex');
      const { name, sku } = this.extractCleanNameAndSkuFromFilename(
        img.filename,
        tempId,
        usedSkus,
      );
      const tempSlug = `${this.slugify(name)}-${sku.toLowerCase()}`;
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
            productImage: data.img.url,
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
      `Catalogue created with ${dto.images?.length || 0} products in ${Date.now() - start}ms`,
    );

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
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    if (catalogues.length === 0) {
      return [];
    }

    const catalogueIds = catalogues.map((c) => c.id);

    // 1. Fetch all categories belonging to these catalogues in ONE query
    const categories = await this.prisma.category.findMany({
      where: { catalogueId: { in: catalogueIds } },
      select: { id: true, catalogueId: true },
    });

    const categoryCountByCatalogueId = new Map<string, number>();
    const categoryIdToCatalogueId = new Map<string, string>();
    const categoryIds: string[] = [];

    for (const cat of categories) {
      categoryIds.push(cat.id);
      if (cat.catalogueId) {
        categoryIdToCatalogueId.set(cat.id, cat.catalogueId);
        categoryCountByCatalogueId.set(
          cat.catalogueId,
          (categoryCountByCatalogueId.get(cat.catalogueId) || 0) + 1,
        );
      }
    }

    // 2. Fetch all products associated with these catalogues/categories in ONE batch query
    const productOrConditions: any[] = [
      { catalogueIds: { hasSome: catalogueIds } },
    ];
    if (categoryIds.length > 0) {
      productOrConditions.push({ categoryId: { in: categoryIds } });
    }

    const products = await this.prisma.product.findMany({
      where: {
        OR: productOrConditions,
      },
      select: {
        id: true,
        catalogueIds: true,
        categoryId: true,
        productImage: true,
        productPictureUrl: true,
        images: {
          take: 1,
          orderBy: { sortOrder: 'asc' },
          select: { originalUrl: true, cleanedUrl: true, thumbnailUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 3. Aggregate product counts and preview images in-memory
    const productCountByCatalogueId = new Map<string, number>();
    const previewImagesByCatalogueId = new Map<string, string[]>();

    for (const p of products) {
      const imgUrl =
        p.images?.[0]?.originalUrl ||
        p.images?.[0]?.cleanedUrl ||
        p.images?.[0]?.thumbnailUrl ||
        p.productImage ||
        p.productPictureUrl;

      // Find all catalogues this product belongs to
      const matchedCatalogueIds = new Set<string>();
      if (Array.isArray(p.catalogueIds)) {
        for (const cid of p.catalogueIds) {
          if (cid) matchedCatalogueIds.add(cid);
        }
      }
      if (p.categoryId && categoryIdToCatalogueId.has(p.categoryId)) {
        matchedCatalogueIds.add(categoryIdToCatalogueId.get(p.categoryId)!);
      }

      for (const cid of matchedCatalogueIds) {
        productCountByCatalogueId.set(
          cid,
          (productCountByCatalogueId.get(cid) || 0) + 1,
        );

        if (imgUrl) {
          const existingImages = previewImagesByCatalogueId.get(cid) || [];
          if (existingImages.length < 4) {
            existingImages.push(imgUrl);
            previewImagesByCatalogueId.set(cid, existingImages);
          }
        }
      }
    }

    // 4. Return formatted catalogue response
    return catalogues.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      imageUrl: c.imageUrl,
      isPublished: c.isPublished,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      productsCount: productCountByCatalogueId.get(c.id) || 0,
      categoriesCount: categoryCountByCatalogueId.get(c.id) || 0,
      previewImages: previewImagesByCatalogueId.get(c.id) || [],
    }));
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

    const andConditions: any[] = [
      {
        OR: [
          { catalogueIds: { has: id } },
          { category: { catalogueId: id } },
        ],
      },
    ];

    if (typeof search === 'string' && search.trim()) {
      andConditions.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { sku: { contains: search, mode: 'insensitive' as const } },
          { barcode: { contains: search, mode: 'insensitive' as const } },
        ],
      });
    }

    if (categoryId) {
      if (
        categoryId.toLowerCase() === 'uncategorized' ||
        categoryId.toLowerCase() === 'direct'
      ) {
        andConditions.push({
          OR: [
            { category: { slug: 'uncategorized' } },
            { category: { name: { equals: 'Uncategorized', mode: 'insensitive' as const } } },
          ],
        });
      } else {
        const objectIdRegex = /^[0-9a-fA-F]{24}$/;
        if (objectIdRegex.test(categoryId)) {
          andConditions.push({
            OR: [
              { categoryId: categoryId },
              { category: { id: categoryId } },
            ],
          });
        } else {
          andConditions.push({
            OR: [
              { category: { slug: categoryId } },
              { category: { name: { equals: categoryId, mode: 'insensitive' as const } } },
            ],
          });
        }
      }
    }

    if (publishedOnly) {
      andConditions.push({ isActive: true });
    }

    const whereClause: any = {
      AND: andConditions,
    };

    const validPage = typeof page === 'number' && page > 0 ? page : 1;
    const validLimit =
      typeof limit === 'number' && limit > 0 ? limit : undefined;

    const [catalogue, products, totalProductsCount] = await Promise.all([
      this.prisma.catalogue.findUnique({
        where: { id },
      }),
      this.prisma.product.findMany({
        where: whereClause,
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
        where: whereClause,
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

    const updatedCatalogue = await this.prisma.catalogue.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        imageUrl: dto.imageUrl,
        isPublished: dto.isPublished,
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });

    // Cascade isPublished changes to categories and products
    if (dto.isPublished !== undefined) {
      // 1. Find all categories linked to this catalogue
      const directCategories = await this.prisma.category.findMany({
        where: { catalogueId: id },
        select: { id: true },
      });
      const directCategoryIds = directCategories.map((c) => c.id);

      // Find all descendant categories of those categories
      const allCategoryIds = [...directCategoryIds];
      let currentLevel = [...directCategoryIds];
      while (currentLevel.length > 0) {
        const children = await this.prisma.category.findMany({
          where: { parentCategoryId: { in: currentLevel } },
          select: { id: true },
        });
        const childIds = children.map((c) => c.id);
        if (childIds.length === 0) break;
        allCategoryIds.push(...childIds);
        currentLevel = childIds;
      }

      // Update all categories under this catalogue
      if (allCategoryIds.length > 0) {
        await this.prisma.category.updateMany({
          where: { id: { in: allCategoryIds } },
          data: { isActive: dto.isPublished },
        });
      }

      // Update all products in this catalogue (both directly via catalogueIds and via categoryId)
      const productOrConditions: any[] = [{ catalogueIds: { has: id } }];
      if (allCategoryIds.length > 0) {
        productOrConditions.push({ categoryId: { in: allCategoryIds } });
      }

      await this.prisma.product.updateMany({
        where: { OR: productOrConditions },
        data: { isActive: dto.isPublished },
      });
    }

    return updatedCatalogue;
  }

  async remove(id: string) {
    const catalogue = await this.prisma.catalogue.findUnique({
      where: { id },
    });

    if (!catalogue) {
      throw new NotFoundException(`Catalogue with ID '${id}' not found.`);
    }

    await this.prisma.$transaction(
      async (tx) => {
        // Find all products associated with this catalogue
        const products = await tx.product.findMany({
          where: { catalogueIds: { has: id } },
        });

        const productIdsToDelete: string[] = [];

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
            productIdsToDelete.push(product.id);
          }
        }

        if (productIdsToDelete.length > 0) {
          // Cascade delete product relations inside the transaction in batches
          await tx.imageCleaningTask.deleteMany({
            where: { productId: { in: productIdsToDelete } },
          });
          await tx.productImage.deleteMany({
            where: { productId: { in: productIdsToDelete } },
          });
          await tx.productPricing.deleteMany({
            where: { productId: { in: productIdsToDelete } },
          });
          await tx.productCatalogFile.deleteMany({
            where: { productId: { in: productIdsToDelete } },
          });
          await tx.productVideo.deleteMany({
            where: { productId: { in: productIdsToDelete } },
          });
          await tx.cartItem.deleteMany({
            where: { productId: { in: productIdsToDelete } },
          });
          await tx.stockMovement.deleteMany({
            where: { productId: { in: productIdsToDelete } },
          });
          await tx.backorderApproval.deleteMany({
            where: { productId: { in: productIdsToDelete } },
          });

          // Safely delete products
          await tx.product.deleteMany({
            where: { id: { in: productIdsToDelete } },
          });
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
      },
      { timeout: 60000 },
    );

    return {
      message: 'Catalogue and its associated products deleted successfully.',
    };
  }

  async exportCatalogue(
    catalogueId: string,
    productIds?: string,
    categoryId?: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
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
        category: true,
        images: { orderBy: { sortOrder: 'asc' } },
        pricing: { include: { pricingGroup: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Catalogue Products');

    // Fetch active pricing groups to generate dynamic pricing columns matching the live Pricing Tiers order
    const pricingGroups = await this.prisma.pricingGroup.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });

    // Define main columns matching Product Master fields
    const columns: any[] = [
      { header: 'Product Image', key: 'productImage', width: 22 },
      { header: 'Barcode Image', key: 'barcodeImage', width: 35 },
      { header: 'Product ID (System ID - Do Not Edit)', key: 'id', width: 36 },
      { header: 'SKU', key: 'sku', width: 20 },
      { header: 'Product Name', key: 'name', width: 40 },
      { header: 'Category', key: 'categoryName', width: 20 },
      { header: 'Product Description', key: 'description', width: 50 },
      { header: 'Product Price', key: 'productPrice', width: 15 },
      { header: 'Tax Type', key: 'taxType', width: 18 },
      { header: 'Tax Value', key: 'taxValue', width: 15 },
      { header: 'Available quantity', key: 'stockQuantity', width: 18 },
      { header: 'Is Active (YES/NO)', key: 'isActive', width: 18 },
      { header: 'MOQ', key: 'moq', width: 10 },
      { header: 'Fix Qty', key: 'fixQty', width: 12 },
      { header: 'Unit', key: 'unit', width: 10 },
    ];

    // Add pricing columns for each active group and place Wholesaler MOQ next to WHOLESALER pricing
    let addedWholesalerMoq = false;
    pricingGroups.forEach((group) => {
      const groupDisplayName = group.name || group.code;
      columns.push({
        header: `Price - ${groupDisplayName}`,
        key: `price_${group.id}`,
        width: 18,
      });

      const isWholesaler =
        group.name?.trim().toUpperCase() === 'WHOLESALER' ||
        group.code?.trim().toUpperCase() === 'WHOLESALER' ||
        group.name?.trim().toUpperCase()?.includes('WHOLESALE');

      if (isWholesaler && !addedWholesalerMoq) {
        columns.push({
          header: 'Wholesaler MOQ',
          key: 'wholesalerMoq',
          width: 16,
        });
        addedWholesalerMoq = true;
      }
    });

    if (!addedWholesalerMoq) {
      columns.push({
        header: 'Wholesaler MOQ',
        key: 'wholesalerMoq',
        width: 16,
      });
    }

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

          const formattedSku = this.formatSku(p.sku, p.id);
          const [imgRes, barcodeRes] = await Promise.allSettled([
            imageUrl
              ? axios.get(imageUrl, {
                  responseType: 'arraybuffer',
                  timeout: 5000,
                })
              : Promise.resolve(null),
            this.generateBarcodeBuffer(formattedSku),
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
      const formattedSku = this.formatSku(p.sku, p.id);

      if (p.sku !== formattedSku) {
        this.prisma.product
          .update({
            where: { id: p.id },
            data: { sku: formattedSku, barcode: formattedSku },
          })
          .catch((err) =>
            this.logger.warn(
              `Failed to auto-clean SKU for product ${p.id}: ${err.message}`,
            ),
          );
      }

      const { taxType: exportTaxType, taxValue: exportTaxValue } =
        this.normalizeProductTax(p);

      // Auto-clean legacy product in DB if taxType was a numeric string
      if (p.taxType && !isNaN(Number(p.taxType))) {
        const num = Number(p.taxType);
        const correctedTaxPercent =
          num > 0 && num <= 1 ? Math.round(num * 100) : num;
        this.prisma.product
          .update({
            where: { id: p.id },
            data: {
              taxType: null,
              taxPercent: correctedTaxPercent,
            },
          })
          .catch((err) =>
            this.logger.warn(
              `Failed to auto-clean legacy tax for product ${p.id}: ${err.message}`,
            ),
          );
      }

      const rowData: any = {
        productImage: '',
        barcodeImage: '',
        id: p.id,
        sku: formattedSku,
        name: p.name,
        categoryName: p.category?.name || '',
        description: p.description || '',
        productPrice: p.productPrice ? p.productPrice.toString() : '',
        taxType: exportTaxType,
        taxValue: exportTaxValue,
        stockQuantity: p.stockQuantity,
        isActive: p.isActive ? 'YES' : 'NO',
        moq: p.moq,
        wholesalerMoq:
          p.wholesalerMoq !== null && p.wholesalerMoq !== undefined
            ? p.wholesalerMoq
            : '',
        fixQty:
          p.fixQty !== null && p.fixQty !== undefined
            ? p.fixQty
            : '',
        unit: p.unit || 'PCS',
      };

      pricingGroups.forEach((group) => {
        const pricing = p.pricing.find((pr) => pr.pricingGroupId === group.id);
        rowData[`price_${group.id}`] = pricing
          ? pricing.price.toString()
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

    let categoryName = '';
    if (categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: categoryId },
      });
      if (category) categoryName = category.name;
    }

    const cleanCatalogueName = (catalogue.name || 'Catalogue')
      .replace(/[^\w\s-]/gi, '')
      .trim()
      .replace(/\s+/g, '_');
    const cleanCategoryName = categoryName
      ? categoryName.replace(/[^\w\s-]/gi, '').trim().replace(/\s+/g, '_')
      : '';
    const filename = cleanCategoryName
      ? `${cleanCatalogueName}_${cleanCategoryName}.xlsx`
      : `${cleanCatalogueName}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();
    this.logger.log(
      `Export completed for ${products.length} products in ${Date.now() - start}ms`,
    );
    return { buffer: Buffer.from(buffer), filename };
  }

  async importCatalogue(
    catalogueId: string,
    fileBuffer: Buffer,
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
    const categoryHeaderKey = headers.find(
      (h) =>
        h &&
        (h.toLowerCase() === 'category' ||
          h.toLowerCase() === 'category name' ||
          h.toLowerCase() === 'categoryname' ||
          h.toLowerCase() === 'category id' ||
          h.toLowerCase() === 'categoryid'),
    );
    const descHeaderKey = headers.find(
      (h) =>
        h &&
        (h.toLowerCase() === 'product description' ||
          h.toLowerCase() === 'description'),
    );
    const productImageHeaderKey = headers.find(
      (h) =>
        h &&
        (h.toLowerCase() === 'product image' ||
          h.toLowerCase() === 'product image url' ||
          h.toLowerCase() === 'image' ||
          h.toLowerCase() === 'image url' ||
          h.toLowerCase() === 'product picture' ||
          h.toLowerCase() === 'picture' ||
          h.toLowerCase() === 'picture url' ||
          h.toLowerCase() === 'photo' ||
          h.toLowerCase() === 'photo url' ||
          h.toLowerCase() === 'media' ||
          h.toLowerCase() === 'media url' ||
          h.toLowerCase() === 'img' ||
          h.toLowerCase() === 'img url' ||
          h.toLowerCase().includes('product image') ||
          h.toLowerCase().includes('image') ||
          h.toLowerCase().includes('picture')),
    );
    const productPictureUrlHeaderKey = headers.find(
      (h) =>
        h &&
        (h.toLowerCase() === 'product picture url' ||
          h.toLowerCase() === 'picture url' ||
          h.toLowerCase() === 'photo url' ||
          h.toLowerCase().includes('picture url')),
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
    const wholesalerMoqHeaderKey = headers.find(
      (h) =>
        h &&
        (h.toLowerCase() === 'wholesaler moq' ||
          h.toLowerCase() === 'wholesalermoq' ||
          h.toLowerCase() === 'wholesaler_moq' ||
          h.toLowerCase() === 'wholesale moq' ||
          h.toLowerCase() === 'wholesale_moq' ||
          h.toLowerCase() === 'w-moq' ||
          h.toLowerCase() === 'w_moq' ||
          h.toLowerCase() === 'wmoq'),
    );
    const fixQtyHeaderKey = headers.find(
      (h) =>
        h &&
        (h.toLowerCase() === 'fix qty' ||
          h.toLowerCase() === 'fix_qty' ||
          h.toLowerCase() === 'fixqty' ||
          h.toLowerCase() === 'fixed qty' ||
          h.toLowerCase() === 'fix quantity' ||
          h.toLowerCase() === 'fixed quantity'),
    );
    const unitHeaderKey = headers.find((h) => h && h.toLowerCase() === 'unit');
    const taxTypeHeaderKey = headers.find(
      (h) =>
        h &&
        (h.toLowerCase() === 'tax type' ||
          h.toLowerCase() === 'tax "type"' ||
          h.toLowerCase() === 'taxtype' ||
          h.toLowerCase() === 'tax_type' ||
          h.toLowerCase() === 'gst type' ||
          h.toLowerCase() === 'gsttype' ||
          h.toLowerCase() === 'gst_type' ||
          h.toLowerCase() === 'tax category' ||
          h.toLowerCase() === 'tax' ||
          h.toLowerCase() === 'gst'),
    );
    const taxHeaderKey = headers.find(
      (h) =>
        h &&
        (h.toLowerCase() === 'tax value' ||
          h.toLowerCase() === 'tax percentage' ||
          h.toLowerCase() === 'taxvalue' ||
          h.toLowerCase() === 'tax_value' ||
          h.toLowerCase() === 'tax percent' ||
          h.toLowerCase() === 'taxpercent' ||
          h.toLowerCase() === 'tax_percent' ||
          h.toLowerCase() === 'tax %' ||
          h.toLowerCase() === 'gst value' ||
          h.toLowerCase() === 'gstvalue' ||
          h.toLowerCase() === 'gst_value' ||
          h.toLowerCase() === 'gst percent' ||
          h.toLowerCase() === 'gstpercent' ||
          h.toLowerCase() === 'gst_percent' ||
          h.toLowerCase() === 'gst %' ||
          h.toLowerCase() === 'gst percentage' ||
          h.toLowerCase() === 'tax rate' ||
          h.toLowerCase() === 'gst rate' ||
          h.toLowerCase().includes('tax value') ||
          h.toLowerCase().includes('tax percent') ||
          h.toLowerCase().includes('tax percentage') ||
          h.toLowerCase().includes('gst value') ||
          h.toLowerCase().includes('gst percent')),
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

    // Extract and upload embedded images from sheet to Cloudflare R2
    const embeddedImageUrlMap = new Map<number, string>();
    try {
      const sheetImages = sheet.getImages();
      if (sheetImages && sheetImages.length > 0) {
        this.logger.log(
          `Found ${sheetImages.length} embedded images in uploaded Excel sheet. Uploading to Cloudflare R2...`,
        );
        const uploadLimit = pLimit(10);
        const prodImgHeaderIdx = productImageHeaderKey ? headers.indexOf(productImageHeaderKey) : 0;
        const barcodeHeaderIdx = headers.findIndex((h) => h && h.toLowerCase().includes('barcode'));

        await Promise.all(
          sheetImages.map((img: any) =>
            uploadLimit(async () => {
              const tl = img.range?.tl;
              if (!tl) return;
              const rIdx = tl.nativeRow !== undefined ? tl.nativeRow : tl.row;
              const cIdx = tl.nativeCol !== undefined ? tl.nativeCol : tl.col;

              // Strictly match ONLY Product Image column and EXCLUDE Barcode Image column (Column B / index 1)
              const isBarcodeCol = cIdx === 1 || (barcodeHeaderIdx !== -1 && cIdx === barcodeHeaderIdx);
              const isProductImgCol = !isBarcodeCol && (cIdx === 0 || (prodImgHeaderIdx !== -1 && cIdx === prodImgHeaderIdx));

              if (rIdx !== undefined && isProductImgCol) {
                const excelRowNumber = rIdx + 1; // 1-indexed row number matching sheet.eachRow
                const imageMedia = workbook.getImage(img.imageId);
                if (imageMedia && imageMedia.buffer) {
                  const ext = imageMedia.extension || 'jpeg';
                  const mimeType =
                    ext === 'jpg' || ext === 'jpeg'
                      ? 'image/jpeg'
                      : `image/${ext}`;
                  try {
                    const uploadRes = await this.uploadService.uploadBuffer(
                      Buffer.from(imageMedia.buffer),
                      mimeType,
                      `excel_import_row${excelRowNumber}_${Date.now()}.${ext}`,
                    );
                    embeddedImageUrlMap.set(excelRowNumber, uploadRes.fileUrl);
                  } catch (uploadErr: any) {
                    this.logger.error(
                      `Failed to upload embedded image for row ${excelRowNumber} to R2: ${uploadErr.message}`,
                    );
                  }
                }
              }
            }),
          ),
        );
      }
    } catch (err: any) {
      this.logger.warn(
        `Could not parse embedded images from Excel sheet: ${err.message}`,
      );
    }

    // Pre-fetch all categories for mapping
    const allDbCategories = await this.prisma.category.findMany({
      select: { id: true, name: true, slug: true },
    });
    const categoryByNameMap = new Map<string, string>();
    const categoryByIdMap = new Map<string, string>();
    for (const cat of allDbCategories) {
      if (cat.name) categoryByNameMap.set(cat.name.trim().toLowerCase(), cat.id);
      categoryByIdMap.set(cat.id, cat.id);
    }

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
      const rawSku = getValString(skuHeaderKey);
      const name = getValString(nameHeaderKey);

      // Skip the row if it has neither SKU nor Name (likely empty row)
      if (!rawSku && !name) return;

      const formattedSku = rawSku ? this.formatSku(rawSku, id || undefined) : null;

      const rawCategory = getValString(categoryHeaderKey);
      let resolvedCategoryId: string | undefined = undefined;
      if (rawCategory) {
        const cleanCat = rawCategory.trim();
        if (categoryByIdMap.has(cleanCat)) {
          resolvedCategoryId = cleanCat;
        } else if (categoryByNameMap.has(cleanCat.toLowerCase())) {
          resolvedCategoryId = categoryByNameMap.get(cleanCat.toLowerCase());
        }
      }

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
      const wholesalerMoq = getValNumber(wholesalerMoqHeaderKey);
      const fixQty = getValNumber(fixQtyHeaderKey);

      const rawProdImg = getValString(productImageHeaderKey);
      const rawProdPic = getValString(productPictureUrlHeaderKey);
      const embeddedImgUrl = embeddedImageUrlMap.get(rowNumber);

      const finalImgUrl = (rawProdImg && rawProdImg.trim().length > 0 ? rawProdImg.trim() : null) || (rawProdPic && rawProdPic.trim().length > 0 ? rawProdPic.trim() : null) || embeddedImgUrl || null;
      const finalPicUrl = (rawProdPic && rawProdPic.trim().length > 0 ? rawProdPic.trim() : null) || (rawProdImg && rawProdImg.trim().length > 0 ? rawProdImg.trim() : null) || embeddedImgUrl || null;

      let parsedTaxType: string | null = getValString(taxTypeHeaderKey) || null;
      let parsedTaxPercent: number | null = null;
      if (taxHeaderKey) {
        const taxCellIdx = headers.indexOf(taxHeaderKey);
        if (taxCellIdx !== -1) {
          const rawTaxStr = getCellValueString(row.getCell(taxCellIdx));
          if (rawTaxStr !== null && rawTaxStr !== undefined && rawTaxStr.trim() !== '') {
            const cleaned = rawTaxStr.replace(/%/g, '').trim();
            const num = parseFloat(cleaned);
            if (!isNaN(num)) {
              if (num > 0 && num <= 1) {
                parsedTaxPercent = Math.round(num * 100);
              } else {
                parsedTaxPercent = num;
              }
            }
          }
        }
      }

      if (parsedTaxType) {
        const cleanType = parsedTaxType.trim().toUpperCase();
        if (
          cleanType === 'CGST_SGST' ||
          cleanType === 'CGST + SGST' ||
          cleanType === 'CGST+SGST' ||
          cleanType === 'CGST/SGST' ||
          cleanType === 'CGST & SGST' ||
          cleanType.includes('CGST') ||
          cleanType.includes('SGST')
        ) {
          parsedTaxType = 'CGST_SGST';
        } else if (cleanType === 'IGST' || cleanType.includes('IGST')) {
          parsedTaxType = 'IGST';
        } else if (!isNaN(Number(cleanType))) {
          // User or legacy file placed tax rate into Tax Type column
          const num = Number(cleanType);
          if (parsedTaxPercent === null || parsedTaxPercent === 0) {
            parsedTaxPercent = num > 0 && num <= 1 ? Math.round(num * 100) : num;
          }
          parsedTaxType = null;
        } else {
          parsedTaxType = null;
        }
      }

      parsedRows.push({
        rowNumber,
        id: id || null,
        rawSku: rawSku || null,
        sku: formattedSku,
        name: name ? name.trim() : null,
        resolvedCategoryId,
        description: getValString(descHeaderKey)?.trim() ?? null,
        productImage: finalImgUrl,
        productPictureUrl: finalPicUrl,
        productPrice: getValNumber(productPriceHeaderKey),
        discountedPrice: getValNumber(discountedPriceHeaderKey),
        stockQuantity: roundVal(stockQuantity, 0),
        moq: roundVal(moq, 1),
        wholesalerMoq: roundVal(wholesalerMoq, null),
        fixQty: roundVal(fixQty, null),
        unit: getValString(unitHeaderKey) || 'PCS',
        taxType: parsedTaxType || null,
        taxPercent: parsedTaxPercent,
        weight: getValNumber(weightHeaderKey),
        parentProductSku: getValString(parentProductSkuHeaderKey),
        parentProductId: getValString(parentProductIdHeaderKey),
        privateNotes: getValString(privateNotesHeaderKey),
        isActive,
        pricingData,
      });
    });

    // ─── ObjectId validation helper ───────────────────────────────────────────
    const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;
    const isValidObjectId = (v: string | null) =>
      !!v && OBJECT_ID_REGEX.test(v);

    // ─── Classify rows: existing products to UPDATE vs new products to CREATE ──
    const allDbProducts = await this.prisma.product.findMany({
      select: { id: true, sku: true, barcodeUrl: true, catalogueIds: true, productImage: true, productPictureUrl: true },
    });

    const skuToDbProductMap = new Map(
      allDbProducts.map((p) => [p.sku.toUpperCase(), p]),
    );
    const idToDbProductMap = new Map(allDbProducts.map((p) => [p.id, p]));
    const usedSkus = new Set(allDbProducts.map((p) => p.sku.toUpperCase()));

    const barcodeLimit = pLimit(10);
    await Promise.all(
      parsedRows.map((row) =>
        barcodeLimit(async () => {
          let dbProduct: any = null;
          if (isValidObjectId(row.id)) {
            dbProduct = idToDbProductMap.get(row.id);
          }
          if (!dbProduct && row.sku) {
            dbProduct = skuToDbProductMap.get(row.sku.toUpperCase());
          }

          if (dbProduct) {
            row.id = dbProduct.id;
            row.isNew = false;
            row.sku = this.formatSku(row.rawSku || row.sku) || this.formatSku(dbProduct.sku);
            if (row.sku) usedSkus.add(row.sku.toUpperCase());

            if (row.sku && row.sku.toUpperCase() === dbProduct.sku.toUpperCase() && dbProduct.barcodeUrl) {
              row.barcodeUrl = dbProduct.barcodeUrl;
            } else if (row.sku) {
              row.barcodeUrl = await this.generateAndUploadBarcode(row.sku);
            } else {
              row.barcodeUrl = null;
            }
          } else {
            row.isNew = true;
            row.id = row.id && isValidObjectId(row.id) ? row.id : randomBytes(12).toString('hex');
            row.sku = row.rawSku || row.sku ? this.getUniqueSku(row.rawSku || row.sku, usedSkus, row.id) : null;
            if (row.sku) {
              row.barcodeUrl = await this.generateAndUploadBarcode(row.sku);
            } else {
              row.barcodeUrl = null;
            }
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
    const allGroupIdentifiers = [
      ...new Set(parsedRows.flatMap((r) => Object.keys(r.pricingData))),
    ];
    const allDbPricingGroups = await this.prisma.pricingGroup.findMany();
    const pricingGroupMap = new Map<string, any>();
    for (const g of allDbPricingGroups) {
      if (g.name) pricingGroupMap.set(g.name.trim().toUpperCase(), g);
      if (g.code) pricingGroupMap.set(g.code.trim().toUpperCase(), g);
    }

    // Execute updates inside Transaction
    await this.prisma.$transaction(
      async (tx) => {
        // 1. Resolve default category (from targetCategoryId or Uncategorized fallback)
        let defaultCategory: any = null;
        if (targetCategoryId) {
          defaultCategory = await tx.category.findUnique({
            where: { id: targetCategoryId },
          });
        }
        if (!defaultCategory) {
          defaultCategory = await tx.category.findUnique({
            where: { slug: 'uncategorized' },
          });
          if (!defaultCategory) {
            defaultCategory = await tx.category.create({
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
        for (const identifier of allGroupIdentifiers) {
          const upperIdentifier = identifier.toUpperCase();
          let pricingGroup = pricingGroupMap.get(upperIdentifier);
          if (!pricingGroup) {
            const dbGroup = await tx.pricingGroup.findFirst({
              where: {
                OR: [
                  { name: { equals: identifier, mode: 'insensitive' } },
                  { code: { equals: identifier, mode: 'insensitive' } },
                ],
              },
            });
            if (dbGroup) {
              pricingGroup = dbGroup;
            } else {
              const code = identifier
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, '_')
                .slice(0, 10);
              pricingGroup = await tx.pricingGroup.create({
                data: {
                  name: identifier,
                  code: code || `PG_${Date.now().toString().slice(-4)}`,
                  description: `Automatically created during catalog import`,
                  isActive: true,
                },
              });
            }
            pricingGroupMap.set(upperIdentifier, pricingGroup);
            if (pricingGroup.name)
              pricingGroupMap.set(
                pricingGroup.name.trim().toUpperCase(),
                pricingGroup,
              );
            if (pricingGroup.code)
              pricingGroupMap.set(
                pricingGroup.code.trim().toUpperCase(),
                pricingGroup,
              );
          }
        }

        // 2. Process all rows: CREATE new rows in bulk, UPDATE existing rows in concurrency-limited batches
        // (NOTE: We deliberately DO NOT delete or dissociate omitted products to ensure products from other categories remain safe and untouched)
        const newRows = parsedRows.filter((r) => r.isNew);
        const existingRows = parsedRows.filter((r) => !r.isNew);

        // Bulk Create New Products
        if (newRows.length > 0) {
          await tx.product.createMany({
            data: newRows.map((row) => {
              const slug = `${this.slugify(row.name)}-${row.sku.toLowerCase()}`;
              const assignedCategoryId = row.resolvedCategoryId || defaultCategory.id;
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
                wholesalerMoq: row.wholesalerMoq,
                fixQty: row.fixQty,
                unit: row.unit || 'PCS',
                taxType: row.taxType,
                taxPercent: row.taxPercent,
                weight: row.weight,
                parentProductSku: row.parentProductSku,
                parentProductId: row.parentProductId,
                privateNotes: row.privateNotes,
                isActive: row.isActive !== undefined ? row.isActive : true,
                barcode: row.sku,
                barcodeUrl: row.barcodeUrl,
                stockStatus: row.stockQuantity > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
                categoryId: assignedCategoryId,
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
            Object.keys(row.pricingData).forEach((groupIdentifier) => {
              const groupPricing = row.pricingData[groupIdentifier];
              if (groupPricing.price !== undefined && groupPricing.price !== null) {
                const pricingGroup = pricingGroupMap.get(groupIdentifier.toUpperCase())!;
                if (pricingGroup) {
                  newProductPricingData.push({
                    productId: row.id,
                    pricingGroupId: pricingGroup.id,
                    price: groupPricing.price,
                    mrp: groupPricing.mrp,
                    discountPercent: groupPricing.discountPercent,
                    createdBy: userId,
                  });
                }
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
                    productImage: row.productImage || existingProduct?.productImage || null,
                    productPictureUrl: row.productPictureUrl || existingProduct?.productPictureUrl || null,
                    productPrice: row.productPrice,
                    discountedPrice: row.discountedPrice,
                    stockQuantity: row.stockQuantity,
                    moq: row.moq,
                    wholesalerMoq: wholesalerMoqHeaderKey ? row.wholesalerMoq : undefined,
                    fixQty: row.fixQty,
                    unit: row.unit,
                    taxType: taxTypeHeaderKey ? row.taxType : undefined,
                    taxPercent: taxHeaderKey ? row.taxPercent : undefined,
                    weight: row.weight,
                    parentProductSku: row.parentProductSku,
                    parentProductId: row.parentProductId,
                    privateNotes: row.privateNotes,
                    isActive: row.isActive !== undefined ? row.isActive : undefined,
                    barcode: row.sku,
                    barcodeUrl: row.barcodeUrl,
                    stockStatus: row.stockQuantity !== undefined && row.stockQuantity !== null
                      ? (row.stockQuantity > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK')
                      : undefined,
                    categoryId: row.resolvedCategoryId || undefined,
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
                  Object.keys(row.pricingData).map(async (groupIdentifier) => {
                    const groupPricing = row.pricingData[groupIdentifier];
                    if (groupPricing.price === undefined || groupPricing.price === null)
                      return;

                    const pricingGroup = pricingGroupMap.get(groupIdentifier.toUpperCase())!;
                    if (!pricingGroup) return;

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

    return {
      message: `Catalogue products successfully imported: ${parsedRows.filter((r) => r.isNew).length} created, ${parsedRows.filter((r) => !r.isNew).length} updated.`,
      createdCount: parsedRows.filter((r) => r.isNew).length,
      updatedCount: parsedRows.filter((r) => !r.isNew).length,
    };
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

    const allDbProducts = await this.prisma.product.findMany({
      select: { sku: true },
    });
    const usedSkus = new Set(allDbProducts.map((p) => p.sku.toUpperCase()));

    // 3. Extract unique SKUs and names for each uploaded image once
    const processedImages = uploadedImages
      .filter((img) => !!img.url)
      .map((img) => {
        const productId = randomBytes(12).toString('hex');
        const { name, sku } = this.extractCleanNameAndSkuFromFilename(
          img.filename,
          productId,
          usedSkus,
        );
        return {
          ...img,
          productId,
          name,
          sku,
        };
      });

    const uploadedSkus = processedImages.map((img) => img.sku);

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

    for (const item of processedImages) {
      const existingProduct = existingProductsMap.get(item.sku.toUpperCase());
      if (existingProduct) {
        // Product already exists: add it to this catalogue and update product image
        const updatedCatalogueIds = Array.from(
          new Set([...existingProduct.catalogueIds, catalogueId]),
        );
        productsToUpdate.push({
          id: existingProduct.id,
          catalogueIds: updatedCatalogueIds,
          productImage: item.url,
          barcode: item.sku,
          barcodeUrl: barcodeMap.get(item.sku.toUpperCase()) || null,
        });

        const hasPrimaryImage = existingProduct.images.some((i) => i.isPrimary);
        if (!hasPrimaryImage) {
          newImagesForExistingProducts.push({
            productId: existingProduct.id,
            originalUrl: item.url,
            isPrimary: true,
            createdBy: userId,
          });
        }
      } else {
        const slug = this.slugify(item.sku);

        newProductsData.push({
          id: item.productId,
          sku: item.sku,
          name: item.name,
          slug: slug,
          categoryId: category.id,
          catalogueIds: [catalogueId],
          moq: 1,
          stockQuantity: 0,
          stockStatus: 'OUT_OF_STOCK',
          isActive: true,
          createdBy: userId,
          productImage: item.url,
          barcode: item.sku,
          barcodeUrl: barcodeMap.get(item.sku.toUpperCase()) || null,
        });

        newProductImagesData.push({
          productId: item.productId,
          originalUrl: item.url,
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

        // 4. Ensure catalogue productIds list includes all new and updated products
        const allAssociatedIds = [
          ...newProductsData.map((p) => p.id),
          ...productsToUpdate.map((p) => p.id),
        ];
        if (allAssociatedIds.length > 0) {
          const currentCat = await tx.catalogue.findUnique({
            where: { id: catalogueId },
            select: { productIds: true },
          });
          const mergedProductIds = Array.from(
            new Set([...(currentCat?.productIds || []), ...allAssociatedIds]),
          );
          await tx.catalogue.update({
            where: { id: catalogueId },
            data: { productIds: mergedProductIds },
          });
        }
      },
      { timeout: 60000 },
    );

    this.logger.log(
      `Bulk added ${newProductsData.length} new and updated ${productsToUpdate.length} existing products in catalogue ${catalogueId} in ${Date.now() - start}ms`,
    );

    return {
      message: `${newProductsData.length} new products created and ${productsToUpdate.length} existing products updated.`,
      addedCount: newProductsData.length,
      updatedCount: productsToUpdate.length,
      products: newProductsData.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        categoryId: p.categoryId,
      })),
      createdProducts: newProductsData.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        categoryId: p.categoryId,
      })),
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

  async moveAsCategory(
    sourceCatalogueId: string,
    targetCatalogueId: string,
    userId: string,
  ) {
    if (sourceCatalogueId === targetCatalogueId) {
      throw new BadRequestException('Cannot move a catalogue into itself.');
    }

    const [sourceCatalogue, targetCatalogue] = await Promise.all([
      this.prisma.catalogue.findUnique({ where: { id: sourceCatalogueId } }),
      this.prisma.catalogue.findUnique({ where: { id: targetCatalogueId } }),
    ]);

    if (!sourceCatalogue) {
      throw new NotFoundException(
        `Source catalogue with ID '${sourceCatalogueId}' not found.`,
      );
    }
    if (!targetCatalogue) {
      throw new NotFoundException(
        `Target catalogue with ID '${targetCatalogueId}' not found.`,
      );
    }

    return this.prisma.$transaction(
      async (tx) => {
        // 1. Generate unique slug for category
        let slug = this.slugify(sourceCatalogue.name);
        const existingSlug = await tx.category.findUnique({ where: { slug } });
        if (existingSlug) {
          slug = `${slug}-${Date.now()}`;
        }

        // 2. Create category under target catalogue
        const newCategory = await tx.category.create({
          data: {
            name: sourceCatalogue.name,
            slug,
            description: sourceCatalogue.description,
            catalogueId: targetCatalogueId,
            imageUrl: sourceCatalogue.imageUrl,
            isActive: sourceCatalogue.isPublished,
            createdBy: userId,
          },
        });

        // 3. Move existing categories under source catalogue
        const existingCategories = await tx.category.findMany({
          where: { catalogueId: sourceCatalogueId },
          select: { id: true },
        });
        const existingCategoryIds = existingCategories.map((c) => c.id);

        if (existingCategoryIds.length > 0) {
          await tx.category.updateMany({
            where: { id: { in: existingCategoryIds } },
            data: {
              catalogueId: targetCatalogueId,
            },
          });
        }

        // 4. Find all products associated with source catalogue
        const products = await tx.product.findMany({
          where: {
            OR: [
              { catalogueIds: { has: sourceCatalogueId } },
              ...(existingCategoryIds.length > 0
                ? [{ categoryId: { in: existingCategoryIds } }]
                : []),
            ],
          },
        });

        const movedProductIds: string[] = [];

        for (const product of products) {
          movedProductIds.push(product.id);
          const shouldUpdateCategory = !existingCategoryIds.includes(product.categoryId);
          const nextCategoryId = shouldUpdateCategory ? newCategory.id : product.categoryId;

          const nextCatalogueIds = Array.from(
            new Set([
              ...product.catalogueIds.filter((cid) => cid !== sourceCatalogueId),
              targetCatalogueId,
            ]),
          );

          await tx.product.update({
            where: { id: product.id },
            data: {
              categoryId: nextCategoryId,
              catalogueIds: nextCatalogueIds,
            },
          });
        }

        // 5. Update target catalogue's productIds
        const updatedTargetProductIds = Array.from(
          new Set([...(targetCatalogue.productIds || []), ...movedProductIds]),
        );
        await tx.catalogue.update({
          where: { id: targetCatalogueId },
          data: {
            productIds: updatedTargetProductIds,
          },
        });

        // 6. Delete source catalogue
        await tx.catalogue.delete({
          where: { id: sourceCatalogueId },
        });

        return {
          success: true,
          category: newCategory,
          message: `Catalogue "${sourceCatalogue.name}" successfully moved to "${targetCatalogue.name}" as a category.`,
        };
      },
      { timeout: 60000 },
    );
  }
}

