import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCatalogueDto } from './dto/create-catalogue.dto';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import axios from 'axios';
import * as bwipjs from 'bwip-js';
import { UploadService } from '../upload/upload.service';
import pLimit from 'p-limit';

@Injectable()
export class CatalogueService {
  private readonly logger = new Logger(CatalogueService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
  ) { }

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
      const result = await this.uploadService.uploadBuffer(buffer, 'image/png', `${sku}_barcode.png`);
      return result.fileUrl;
    } catch (error) {
      this.logger.error(`Failed to generate barcode for SKU ${sku}`, error);
      return null;
    }
  }

  /** Generate barcode buffer in-memory (no R2 upload) — used for Excel export */
  private async generateBarcodeBuffer(sku: string): Promise<Buffer | null> {
    try {
      return await bwipjs.toBuffer({
        bcid: 'code128',
        text: sku,
        scale: 3,
        height: 10,
        includetext: true,
        textxalign: 'center',
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
    //    These are TEMP SKUs that get replaced during Excel import, so barcodes
    //    are generated there (on real SKUs) instead.
    const tempProductsData = dto.images.map((img) => {
      const tempId = randomUUID();
      const tempSku = `TEMP-SKU-${tempId}`;
      const tempSlug = `temp-sku-${tempId}`;
      const baseName = img.filename.split('.').slice(0, -1).join('.') || img.filename;
      return { img, tempId, tempSku, tempSlug, baseName };
    });

    // 3. Create catalogue + all products in ONE transaction using createMany for speed
    const result = await this.prisma.$transaction(async (tx) => {
      const catalogue = await tx.catalogue.create({
        data: { name: dto.name },
      });

      // Bulk create all products at once (barcodeUrl left null — set during Excel import on real SKUs)
      await tx.product.createMany({
        data: tempProductsData.map((data) => ({
          id: data.tempId,
          sku: data.tempSku,
          name: data.baseName,
          slug: data.tempSlug,
          categoryId: category.id,
          catalogueId: catalogue.id,
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

      return tx.catalogue.findUnique({
        where: { id: catalogue.id },
        include: {
          products: {
            include: { images: true },
          },
        },
      });
    });

    this.logger.log(`Catalogue created with ${dto.images.length} products in ${Date.now() - start}ms`);
    return result;
  }

  async findAll(search?: string) {
    const where = search ? { name: { contains: search, mode: 'insensitive' as const } } : {};
    const catalogues = await this.prisma.catalogue.findMany({
      where,
      include: {
        _count: {
          select: { products: true },
        },
        products: {
          take: 4,
          select: {
            productImage: true,
            images: {
              take: 1,
              orderBy: { sortOrder: 'asc' },
              select: { originalUrl: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    return catalogues.map((c) => {
      const previewImages = c.products
        .map(p => p.images?.[0]?.originalUrl || p.productImage)
        .filter(url => !!url);

      return {
        id: c.id,
        name: c.name,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        productsCount: c._count.products,
        previewImages,
      };
    });
  }

  async findOne(id: string, search?: string) {
    const productWhere = search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { sku: { contains: search, mode: 'insensitive' as const } },
        { barcode: { contains: search, mode: 'insensitive' as const } },
      ]
    } : {};

    const catalogue = await this.prisma.catalogue.findUnique({
      where: { id },
      include: {
        products: {
          where: productWhere,
          include: {
            images: { orderBy: { sortOrder: 'asc' } },
            pricing: { include: { pricingGroup: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!catalogue) {
      throw new NotFoundException(`Catalogue with ID '${id}' not found.`);
    }

    return catalogue;
  }

  async update(id: string, name: string) {
    const catalogue = await this.prisma.catalogue.findUnique({ where: { id } });
    if (!catalogue) {
      throw new NotFoundException(`Catalogue with ID '${id}' not found.`);
    }

    return this.prisma.catalogue.update({
      where: { id },
      data: { name },
    });
  }

  async remove(id: string) {
    const catalogue = await this.prisma.catalogue.findUnique({
      where: { id },
    });
    if (!catalogue) {
      throw new NotFoundException(`Catalogue with ID '${id}' not found.`);
    }

    await this.prisma.catalogue.delete({
      where: { id },
    });

    return { message: 'Catalogue and its associated products deleted successfully.' };
  }

  async exportCatalogue(catalogueId: string): Promise<Buffer> {
    const start = Date.now();
    const catalogue = await this.findOne(catalogueId);

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
      { header: 'Product Image', key: 'productImage', width: 18 },
      { header: 'Barcode Image', key: 'barcodeImage', width: 25 },
      { header: 'Product ID (System ID - Do Not Edit)', key: 'id', width: 36 },
      { header: 'SKU', key: 'sku', width: 20 },
      { header: 'Product Name', key: 'name', width: 40 },
      { header: 'Product Description', key: 'description', width: 50 },
      { header: 'Product Picture url', key: 'productPictureUrl', width: 30 },
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
      { header: '6-12 months Set Quantity', key: 'sixToTwelveMonthsSetQuantity', width: 25 },
    ];

    // Add pricing columns for each group
    pricingGroups.forEach((group) => {
      columns.push(
        { header: `Price - ${group.code}`, key: `price_${group.code}`, width: 18 },
        { header: `MRP - ${group.code}`, key: `mrp_${group.code}`, width: 18 },
        { header: `Discount % - ${group.code}`, key: `discount_${group.code}`, width: 18 },
      );
    });

    sheet.columns = columns;

    // Set header row height
    const headerRow = sheet.getRow(1);
    headerRow.height = 30;
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    const barcodeColIdx = columns.findIndex(c => c.key === 'barcodeImage');

    // --- OPTIMIZATION: Download product images + generate barcodes in-memory (no R2 download)
    //     Concurrency capped at 10 to avoid overwhelming the network ---
    const limit = pLimit(10);
    this.logger.log(`Preparing ${catalogue.products.length} product images & barcodes in parallel (concurrency=10)...`);

    const imageDownloadResults = await Promise.all(
      catalogue.products.map((p) =>
        limit(async () => {
          const primaryImageUrl = p.images[0]?.originalUrl || '';
          const imageUrl = p.productImage || primaryImageUrl;
          const result: {
            productId: string;
            productImageBuffer: Buffer | null;
            productImageExtension: 'png' | 'jpeg' | 'gif';
            barcodeBuffer: Buffer | null;
          } = {
            productId: p.id,
            productImageBuffer: null,
            productImageExtension: 'jpeg',
            barcodeBuffer: null,
          };

          // Download product image and generate barcode in-memory — both in parallel
          const [imgResult, barcodeResult] = await Promise.allSettled([
            imageUrl
              ? axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 5000 })
              : Promise.resolve(null),
            // Generate barcode directly in memory instead of downloading from R2
            this.generateBarcodeBuffer(p.sku),
          ]);

          if (imgResult.status === 'fulfilled' && imgResult.value) {
            result.productImageBuffer = Buffer.from(imgResult.value.data);
            const ct = String(imgResult.value.headers['content-type'] || '');
            if (ct.includes('png')) result.productImageExtension = 'png';
            else if (ct.includes('gif')) result.productImageExtension = 'gif';
            else if (imageUrl.toLowerCase().endsWith('.png')) result.productImageExtension = 'png';
          } else if (imgResult.status === 'rejected') {
            this.logger.warn(`Failed to download image for product ${p.id}: ${imgResult.reason?.message}`);
          }

          if (barcodeResult.status === 'fulfilled' && barcodeResult.value) {
            result.barcodeBuffer = barcodeResult.value as Buffer;
          } else if (barcodeResult.status === 'rejected') {
            this.logger.warn(`Failed to generate barcode for SKU ${p.sku}: ${barcodeResult.reason?.message}`);
          }

          return result;
        }),
      ),
    );

    // Build a lookup map for fast access
    const imageMap = new Map(imageDownloadResults.map(r => [r.productId, r]));

    // Populate rows
    let rowIndex = 1; // Header is row 1
    for (const p of catalogue.products) {
      rowIndex++;
      const primaryImageUrl = p.images[0]?.originalUrl || '';
      const imageUrl = p.productImage || primaryImageUrl;

      const rowData: any = {
        productImage: imageUrl,
        barcodeImage: '',
        id: p.id,
        sku: p.sku,
        name: p.name,
        description: p.description || '',
        productPictureUrl: p.productPictureUrl || primaryImageUrl,
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
        setQuantity: p.setQuantity !== null && p.setQuantity !== undefined ? p.setQuantity : '',
        setType: p.setType || '',
        sizes: p.sizes || '',
        sizesSetQuantity: p.sizesSetQuantity !== null && p.sizesSetQuantity !== undefined ? p.sizesSetQuantity : '',
        colors: p.colors || '',
        colorsSetQuantity: p.colorsSetQuantity !== null && p.colorsSetQuantity !== undefined ? p.colorsSetQuantity : '',
        nt11_48: p.nt11_48 || '',
        nt11_48SetQuantity: p.nt11_48SetQuantity !== null && p.nt11_48SetQuantity !== undefined ? p.nt11_48SetQuantity : '',
        sixToTwelveMonths: p.sixToTwelveMonths || '',
        sixToTwelveMonthsSetQuantity: p.sixToTwelveMonthsSetQuantity !== null && p.sixToTwelveMonthsSetQuantity !== undefined ? p.sixToTwelveMonthsSetQuantity : '',
      };

      pricingGroups.forEach((group) => {
        const pricing = p.pricing.find((pr) => pr.pricingGroupId === group.id);
        rowData[`price_${group.code}`] = pricing ? pricing.price.toString() : '';
        rowData[`mrp_${group.code}`] = pricing && pricing.mrp ? pricing.mrp.toString() : '';
        rowData[`discount_${group.code}`] = pricing && pricing.discountPercent ? pricing.discountPercent.toString() : '';
      });

      sheet.addRow(rowData);
      const row = sheet.getRow(rowIndex);
      row.height = 80;
      row.alignment = { vertical: 'middle' };

      // Use pre-downloaded buffers
      const imgData = imageMap.get(p.id);
      if (imgData?.productImageBuffer) {
        const imageId = workbook.addImage({ buffer: imgData.productImageBuffer, extension: imgData.productImageExtension });
        sheet.addImage(imageId, {
          tl: { col: 0, row: rowIndex - 1 },
          br: { col: 1, row: rowIndex },
          editAs: 'oneCell',
        });
      }

      if (imgData?.barcodeBuffer) {
        const imageId = workbook.addImage({ buffer: imgData.barcodeBuffer, extension: 'png' });
        sheet.addImage(imageId, {
          tl: { col: barcodeColIdx, row: rowIndex - 1 },
          br: { col: barcodeColIdx + 1, row: rowIndex },
          editAs: 'oneCell',
        });
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    this.logger.log(`Export completed for ${catalogue.products.length} products in ${Date.now() - start}ms`);
    return buffer as Buffer;
  }

  async importCatalogue(catalogueId: string, fileBuffer: Buffer, userId: string) {
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

    const idHeaderKey = headers.find((h) => h && (h.toLowerCase().includes('product id') || h.toLowerCase() === 'id'));
    const skuHeaderKey = headers.find((h) => h && h.toLowerCase() === 'sku');
    const nameHeaderKey = headers.find((h) => h && (h.toLowerCase() === 'product name' || h.toLowerCase() === 'name'));
    const descHeaderKey = headers.find((h) => h && (h.toLowerCase() === 'product description' || h.toLowerCase() === 'description'));
    const productImageHeaderKey = headers.find((h) => h && h.toLowerCase() === 'product image');
    const productPictureUrlHeaderKey = headers.find((h) => h && h.toLowerCase() === 'product picture url');
    const productPriceHeaderKey = headers.find((h) => h && h.toLowerCase() === 'product price');
    const discountedPriceHeaderKey = headers.find((h) => h && h.toLowerCase() === 'discounted price');
    const stockHeaderKey = headers.find((h) => h && (h.toLowerCase().includes('available quantity') || h.toLowerCase().includes('stock quantity')));
    const activeHeaderKey = headers.find((h) => h && (h.toLowerCase().includes('is active') || h.toLowerCase() === 'active'));
    const moqHeaderKey = headers.find((h) => h && h.toLowerCase() === 'moq');
    const brandHeaderKey = headers.find((h) => h && h.toLowerCase() === 'brand');
    const sizeHeaderKey = headers.find((h) => h && h.toLowerCase() === 'size');
    const colorHeaderKey = headers.find((h) => h && h.toLowerCase() === 'color');
    const unitHeaderKey = headers.find((h) => h && h.toLowerCase() === 'unit');
    const taxTypeHeaderKey = headers.find((h) => h && (h.toLowerCase() === 'tax "type"' || h.toLowerCase() === 'tax type'));
    const taxHeaderKey = headers.find((h) => h && (h.toLowerCase() === 'tax percentage' || h.toLowerCase().includes('tax percent')));
    const weightHeaderKey = headers.find((h) => h && h.toLowerCase() === 'weight');
    const parentProductSkuHeaderKey = headers.find((h) => h && h.toLowerCase() === 'parent product sku');
    const parentProductIdHeaderKey = headers.find((h) => h && h.toLowerCase() === 'parent product id');
    const privateNotesHeaderKey = headers.find((h) => h && h.toLowerCase() === 'private notes');
    const setNameHeaderKey = headers.find((h) => h && h.toLowerCase() === 'set name');
    const setQuantityHeaderKey = headers.find((h) => h && h.toLowerCase() === 'set quantity');
    const setTypeHeaderKey = headers.find((h) => h && h.toLowerCase() === 'set type');
    const sizesHeaderKey = headers.find((h) => h && h.toLowerCase() === 'sizes');
    const sizesSetQuantityHeaderKey = headers.find((h) => h && h.toLowerCase() === 'sizes set quantity');
    const colorsHeaderKey = headers.find((h) => h && h.toLowerCase() === 'colors');
    const colorsSetQuantityHeaderKey = headers.find((h) => h && h.toLowerCase() === 'colors set quantity');
    const nt11_48HeaderKey = headers.find((h) => h && h.toLowerCase() === 'nt11-48');
    const nt11_48SetQuantityHeaderKey = headers.find((h) => h && h.toLowerCase() === 'nt11-48 set quantity');
    const sixToTwelveMonthsHeaderKey = headers.find((h) => h && h.toLowerCase() === '6-12 months');
    const sixToTwelveMonthsSetQuantityHeaderKey = headers.find((h) => h && h.toLowerCase() === '6-12 months set quantity');

    const pricingHeaderMap: { [colIdx: number]: { type: 'price' | 'mrp' | 'discount'; groupCode: string } } = {};
    headers.forEach((header, idx) => {
      if (!header) return;
      const priceMatch = header.match(/Price\s*-\s*(.+)/i);
      if (priceMatch) { pricingHeaderMap[idx] = { type: 'price', groupCode: priceMatch[1].trim().toUpperCase() }; return; }
      const mrpMatch = header.match(/MRP\s*-\s*(.+)/i);
      if (mrpMatch) { pricingHeaderMap[idx] = { type: 'mrp', groupCode: mrpMatch[1].trim().toUpperCase() }; return; }
      const discountMatch = header.match(/Discount\s*(?:%\s*)?-\s*(.+)/i);
      if (discountMatch) { pricingHeaderMap[idx] = { type: 'discount', groupCode: discountMatch[1].trim().toUpperCase() }; return; }
    });

    const getCellValueString = (cell: any): string | null => {
      if (!cell || cell.value === null || cell.value === undefined) return null;
      if (typeof cell.value === 'object') {
        if (cell.value.result !== undefined && cell.value.result !== null) return cell.value.result.toString();
        if (cell.value.text !== undefined && cell.value.text !== null) return cell.value.text.toString();
        return JSON.stringify(cell.value);
      }
      return cell.value.toString();
    };

    const getCellValueNumber = (cell: any): number | null => {
      if (!cell || cell.value === null || cell.value === undefined) return null;
      let val = cell.value;
      if (typeof val === 'object') {
        if (val.result !== undefined && val.result !== null) { val = val.result; } else { return null; }
      }
      const parsed = parseFloat(val);
      return isNaN(parsed) ? null : parsed;
    };

    const parsedRows: any[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const getValString = (headerKey: string | undefined) => {
        if (!headerKey) return null;
        const idx = headers.indexOf(headerKey);
        if (idx === -1) return null;
        const val = getCellValueString(row.getCell(idx));
        return val ? val.trim() : null;
      };

      const getValNumber = (headerKey: string | undefined) => {
        if (!headerKey) return null;
        const idx = headers.indexOf(headerKey);
        if (idx === -1) return null;
        return getCellValueNumber(row.getCell(idx));
      };

      const id = getValString(idHeaderKey);
      if (!id) return;

      const sku = getValString(skuHeaderKey);
      const name = getValString(nameHeaderKey);
      const isActiveStr = getValString(activeHeaderKey);
      let isActive = false;
      if (isActiveStr) {
        const cleanVal = isActiveStr.trim().toUpperCase();
        isActive = cleanVal === 'YES' || cleanVal === 'TRUE' || cleanVal === '1';
      }

      const pricingData: { [groupCode: string]: { price?: number; mrp?: number; discountPercent?: number } } = {};
      Object.keys(pricingHeaderMap).forEach((colIdxStr) => {
        const colIdx = parseInt(colIdxStr);
        const mapInfo = pricingHeaderMap[colIdx];
        const cellVal = getCellValueNumber(row.getCell(colIdx));
        if (cellVal !== null) {
          if (!pricingData[mapInfo.groupCode]) pricingData[mapInfo.groupCode] = {};
          if (mapInfo.type === 'price') pricingData[mapInfo.groupCode].price = cellVal;
          if (mapInfo.type === 'mrp') pricingData[mapInfo.groupCode].mrp = cellVal;
          if (mapInfo.type === 'discount') pricingData[mapInfo.groupCode].discountPercent = cellVal;
        }
      });

      const stockQuantity = getValNumber(stockHeaderKey);
      const moq = getValNumber(moqHeaderKey);
      const setQuantity = getValNumber(setQuantityHeaderKey);
      const sizesSetQuantity = getValNumber(sizesSetQuantityHeaderKey);
      const colorsSetQuantity = getValNumber(colorsSetQuantityHeaderKey);
      const nt11_48SetQuantity = getValNumber(nt11_48SetQuantityHeaderKey);
      const sixToTwelveMonthsSetQuantity = getValNumber(sixToTwelveMonthsSetQuantityHeaderKey);

      parsedRows.push({
        rowNumber,
        id,
        sku: sku ? sku.trim() : null,
        name: name ? name.trim() : null,
        description: getValString(descHeaderKey)?.trim() ?? null,
        productImage: getValString(productImageHeaderKey),
        productPictureUrl: getValString(productPictureUrlHeaderKey),
        productPrice: getValNumber(productPriceHeaderKey),
        discountedPrice: getValNumber(discountedPriceHeaderKey),
        stockQuantity: stockQuantity !== null ? Math.round(stockQuantity) : 0,
        moq: moq !== null ? Math.round(moq) : 1,
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
        setQuantity: setQuantity !== null ? Math.round(setQuantity) : null,
        setType: getValString(setTypeHeaderKey),
        sizes: getValString(sizesHeaderKey),
        sizesSetQuantity: sizesSetQuantity !== null ? Math.round(sizesSetQuantity) : null,
        colors: getValString(colorsHeaderKey),
        colorsSetQuantity: colorsSetQuantity !== null ? Math.round(colorsSetQuantity) : null,
        nt11_48: getValString(nt11_48HeaderKey),
        nt11_48SetQuantity: nt11_48SetQuantity !== null ? Math.round(nt11_48SetQuantity) : null,
        sixToTwelveMonths: getValString(sixToTwelveMonthsHeaderKey),
        sixToTwelveMonthsSetQuantity: sixToTwelveMonthsSetQuantity !== null ? Math.round(sixToTwelveMonthsSetQuantity) : null,
        isActive,
        pricingData,
      });
    });

    // --- OPTIMIZATION: Validations without N+1 queries ---
    const catalogProductIds = new Set(catalogue.products.map((p) => p.id));
    const skuSet = new Set<string>();

    // Collect all SKUs to check in one single DB query
    const allSkusInFile = parsedRows.map(r => r.sku).filter(Boolean);

    // Single batch query for duplicate SKUs across all rows
    const duplicateProducts = await this.prisma.product.findMany({
      where: {
        sku: { in: allSkusInFile },
        id: { notIn: parsedRows.map(r => r.id).filter(Boolean) },
      },
      select: { sku: true },
    });
    const duplicateSkuSet = new Set(duplicateProducts.map(p => p.sku.toUpperCase()));

    for (const row of parsedRows) {
      if (!row.sku) throw new BadRequestException(`Row ${row.rowNumber}: SKU is required.`);
      if (!row.name) throw new BadRequestException(`Row ${row.rowNumber}: Product name is required.`);

      const upperSku = row.sku.toUpperCase();
      if (skuSet.has(upperSku)) throw new BadRequestException(`Duplicate SKU "${row.sku}" found in the uploaded Excel sheet.`);
      skuSet.add(upperSku);

      if (!catalogProductIds.has(row.id)) throw new BadRequestException(`Row ${row.rowNumber}: Product with ID '${row.id}' does not belong to this catalogue.`);

      if (duplicateSkuSet.has(upperSku)) throw new BadRequestException(`Row ${row.rowNumber}: SKU "${row.sku}" is already in use by another product in the database.`);
    }

    // --- OPTIMIZATION: Generate & upload barcodes in parallel (concurrency=8) for changed/new SKUs only ---
    const existingProductMap = new Map(catalogue.products.map(p => [p.id, p]));
    const barcodeLimit = pLimit(8);

    this.logger.log(`Generating barcodes in parallel (concurrency=8) for import...`);
    await Promise.all(parsedRows.map((row) =>
      barcodeLimit(async () => {
        const existingProduct = existingProductMap.get(row.id);
        if (!existingProduct || existingProduct.sku !== row.sku || !existingProduct.barcodeUrl) {
          row.barcodeUrl = await this.generateAndUploadBarcode(row.sku);
        } else {
          row.barcodeUrl = existingProduct.barcodeUrl;
        }
      }),
    ));

    // --- OPTIMIZATION: Pre-fetch ALL existing product images in ONE query, build in-memory lookup ---
    const allProductIds = parsedRows.map(r => r.id);
    const existingImages = await this.prisma.productImage.findMany({
      where: { productId: { in: allProductIds } },
      select: { productId: true, originalUrl: true, isPrimary: true },
    });
    // Map: productId -> Set of existing originalUrls
    const existingImageMap = new Map<string, Set<string>>();
    for (const img of existingImages) {
      if (!existingImageMap.has(img.productId)) existingImageMap.set(img.productId, new Set());
      existingImageMap.get(img.productId)!.add(img.originalUrl);
    }

    // --- OPTIMIZATION: Pre-fetch all pricing groups in one query ---
    const allGroupCodes = [...new Set(parsedRows.flatMap(r => Object.keys(r.pricingData)))];
    const pricingGroups = await this.prisma.pricingGroup.findMany({
      where: { code: { in: allGroupCodes } },
    });
    const pricingGroupMap = new Map(pricingGroups.map(g => [g.code, g]));

    // Execute updates inside Transaction
    await this.prisma.$transaction(async (tx) => {
      // 1. Delete catalogue products omitted from Excel
      const uploadedIds = new Set(parsedRows.map((r) => r.id));
      const toDeleteIds = catalogue.products.map((p) => p.id).filter((id) => !uploadedIds.has(id));
      if (toDeleteIds.length > 0) {
        await tx.product.deleteMany({ where: { id: { in: toDeleteIds } } });
      }

      // 2. Bulk update all products using individual updates (Prisma doesn't support bulk updateMany with different values)
      // Run all product updates in parallel within the transaction
      await Promise.all(parsedRows.map(async (row) => {
        const slug = `${this.slugify(row.name)}-${row.sku.toLowerCase()}`;

        await tx.product.update({
          where: { id: row.id },
          data: {
            sku: row.sku,
            name: row.name,
            slug,
            description: row.description,
            productImage: row.productImage,
            productPictureUrl: row.productPictureUrl,
            productPrice: row.productPrice !== null ? new Prisma.Decimal(row.productPrice) : null,
            discountedPrice: row.discountedPrice !== null ? new Prisma.Decimal(row.discountedPrice) : null,
            stockQuantity: row.stockQuantity,
            moq: row.moq,
            brand: row.brand,
            size: row.size,
            color: row.color,
            unit: row.unit,
            taxType: row.taxType,
            taxPercent: row.taxPercent !== null ? new Prisma.Decimal(row.taxPercent) : null,
            weight: row.weight !== null ? new Prisma.Decimal(row.weight) : null,
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
            barcodeUrl: row.barcodeUrl,
            stockStatus: row.stockQuantity > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
            updatedBy: userId,
          },
        });

        // Smart Image Sync — use pre-fetched image map (no findFirst per URL)
        const urlsToSync = [row.productImage, row.productPictureUrl].filter((url): url is string => !!url && url.trim().length > 0);
        const knownUrls = existingImageMap.get(row.id) ?? new Set<string>();
        const newUrls = urlsToSync.map(u => u.trim()).filter(u => !knownUrls.has(u));

        await Promise.all([
          // Image sync — only create images that don't exist yet
          newUrls.length > 0
            ? (async () => {
                await tx.productImage.updateMany({
                  where: { productId: row.id, isPrimary: true },
                  data: { isPrimary: false },
                });
                await tx.productImage.create({
                  data: { productId: row.id, originalUrl: newUrls[0], isPrimary: true, createdBy: userId },
                });
                // Create any additional new urls as non-primary
                if (newUrls.length > 1) {
                  await tx.productImage.createMany({
                    data: newUrls.slice(1).map(u => ({ productId: row.id, originalUrl: u, isPrimary: false, createdBy: userId })),
                    skipDuplicates: true,
                  });
                }
              })()
            : Promise.resolve(),

          // Pricing upserts — run all in parallel for this product
          ...Object.keys(row.pricingData).map(async (groupCode) => {
            const groupPricing = row.pricingData[groupCode];
            if (groupPricing.price === undefined || groupPricing.price === null) return;

            const pricingGroup = pricingGroupMap.get(groupCode);
            if (!pricingGroup) throw new BadRequestException(`Pricing group "${groupCode}" not found.`);

            await tx.productPricing.upsert({
              where: { productId_pricingGroupId: { productId: row.id, pricingGroupId: pricingGroup.id } },
              update: {
                price: new Prisma.Decimal(groupPricing.price),
                mrp: groupPricing.mrp != null ? new Prisma.Decimal(groupPricing.mrp) : null,
                discountPercent: groupPricing.discountPercent != null ? new Prisma.Decimal(groupPricing.discountPercent) : null,
                updatedBy: userId,
              },
              create: {
                productId: row.id,
                pricingGroupId: pricingGroup.id,
                price: new Prisma.Decimal(groupPricing.price),
                mrp: groupPricing.mrp != null ? new Prisma.Decimal(groupPricing.mrp) : null,
                discountPercent: groupPricing.discountPercent != null ? new Prisma.Decimal(groupPricing.discountPercent) : null,
                createdBy: userId,
              },
            });
          }),
        ]);
      }));
    }, { timeout: 60000 }); // Extended timeout for large catalogues

    this.logger.log(`Import completed for ${parsedRows.length} products in ${Date.now() - start}ms`);
    return { message: 'Catalogue products successfully updated and replaced.' };
  }
}