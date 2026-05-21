import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCatalogueDto } from './dto/create-catalogue.dto';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import axios from 'axios';

@Injectable()
export class CatalogueService {
  constructor(private readonly prisma: PrismaService) {}

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

    // 2. Create the Catalogue record inside a transaction
    return this.prisma.$transaction(async (tx) => {
      const catalogue = await tx.catalogue.create({
        data: { name: dto.name },
      });

      // 3. Loop and bulk-create temporary products
      for (const img of dto.images) {
        const tempId = randomUUID();
        const tempSku = `TEMP-SKU-${tempId}`;
        const tempSlug = `temp-sku-${tempId}`;
        const baseName = img.filename.split('.').slice(0, -1).join('.') || img.filename;

        await tx.product.create({
          data: {
            id: tempId,
            sku: tempSku,
            name: baseName,
            slug: tempSlug,
            categoryId: category.id,
            catalogueId: catalogue.id,
            moq: 1,
            stockQuantity: 0,
            stockStatus: 'OUT_OF_STOCK',
            isActive: false,
            createdBy: userId,
            images: {
              create: {
                originalUrl: img.url,
                isPrimary: true,
                createdBy: userId,
              },
            },
          },
        });
      }

      return tx.catalogue.findUnique({
        where: { id: catalogue.id },
        include: {
          products: {
            include: { images: true },
          },
        },
      });
    });
  }

  async findAll() {
    const catalogues = await this.prisma.catalogue.findMany({
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return catalogues.map((c) => ({
      id: c.id,
      name: c.name,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      productsCount: c._count.products,
    }));
  }

  async findOne(id: string) {
    const catalogue = await this.prisma.catalogue.findUnique({
      where: { id },
      include: {
        products: {
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

    // Populate rows
    let rowIndex = 1; // Header is row 1
    for (const p of catalogue.products) {
      rowIndex++;
      const primaryImageUrl = p.images[0]?.originalUrl || '';
      const imageUrl = p.productImage || primaryImageUrl;

      const rowData: any = {
        productImage: imageUrl,
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

      // Download and embed image if available
      if (imageUrl) {
        try {
          const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 5000 });
          const buffer = Buffer.from(response.data);

          let extension: 'png' | 'jpeg' | 'gif' = 'jpeg';
          const contentType = response.headers['content-type'];
          if (contentType && typeof contentType === 'string') {
            if (contentType.includes('png')) extension = 'png';
            else if (contentType.includes('gif')) extension = 'gif';
          } else {
            const lowerUrl = imageUrl.toLowerCase();
            if (lowerUrl.endsWith('.png')) extension = 'png';
            else if (lowerUrl.endsWith('.gif')) extension = 'gif';
          }

          const imageId = workbook.addImage({
            buffer,
            extension,
          });

          sheet.addImage(imageId, {
            tl: { col: 0, row: rowIndex - 1 },
            br: { col: 1, row: rowIndex },
            editAs: 'oneCell',
          });
        } catch (err) {
          console.error(`Failed to download and embed image from ${imageUrl}:`, err.message);
        }
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as Buffer;
  }

  async importCatalogue(catalogueId: string, fileBuffer: Buffer, userId: string) {
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
      if (priceMatch) {
        pricingHeaderMap[idx] = { type: 'price', groupCode: priceMatch[1].trim().toUpperCase() };
        return;
      }
      const mrpMatch = header.match(/MRP\s*-\s*(.+)/i);
      if (mrpMatch) {
        pricingHeaderMap[idx] = { type: 'mrp', groupCode: mrpMatch[1].trim().toUpperCase() };
        return;
      }
      const discountMatch = header.match(/Discount\s*(?:%\s*)?-\s*(.+)/i);
      if (discountMatch) {
        pricingHeaderMap[idx] = { type: 'discount', groupCode: discountMatch[1].trim().toUpperCase() };
        return;
      }
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
      const sku = getValString(skuHeaderKey);
      const name = getValString(nameHeaderKey);
      const description = getValString(descHeaderKey);
      const productImage = getValString(productImageHeaderKey);
      const productPictureUrl = getValString(productPictureUrlHeaderKey);
      const productPrice = getValNumber(productPriceHeaderKey);
      const discountedPrice = getValNumber(discountedPriceHeaderKey);
      const stockQuantity = getValNumber(stockHeaderKey);
      const isActiveStr = getValString(activeHeaderKey);
      const moq = getValNumber(moqHeaderKey);
      const brand = getValString(brandHeaderKey);
      const size = getValString(sizeHeaderKey);
      const color = getValString(colorHeaderKey);
      const unit = getValString(unitHeaderKey);
      const taxType = getValString(taxTypeHeaderKey);
      const taxPercent = getValNumber(taxHeaderKey);
      const weight = getValNumber(weightHeaderKey);
      const parentProductSku = getValString(parentProductSkuHeaderKey);
      const parentProductId = getValString(parentProductIdHeaderKey);
      const privateNotes = getValString(privateNotesHeaderKey);
      const setName = getValString(setNameHeaderKey);
      const setQuantity = getValNumber(setQuantityHeaderKey);
      const setType = getValString(setTypeHeaderKey);
      const sizes = getValString(sizesHeaderKey);
      const sizesSetQuantity = getValNumber(sizesSetQuantityHeaderKey);
      const colors = getValString(colorsHeaderKey);
      const colorsSetQuantity = getValNumber(colorsSetQuantityHeaderKey);
      const nt11_48 = getValString(nt11_48HeaderKey);
      const nt11_48SetQuantity = getValNumber(nt11_48SetQuantityHeaderKey);
      const sixToTwelveMonths = getValString(sixToTwelveMonthsHeaderKey);
      const sixToTwelveMonthsSetQuantity = getValNumber(sixToTwelveMonthsSetQuantityHeaderKey);

      if (!id) return;

      const pricingData: { [groupCode: string]: { price?: number; mrp?: number; discountPercent?: number } } = {};
      Object.keys(pricingHeaderMap).forEach((colIdxStr) => {
        const colIdx = parseInt(colIdxStr);
        const mapInfo = pricingHeaderMap[colIdx];
        const cellVal = getCellValueNumber(row.getCell(colIdx));
        if (cellVal !== null) {
          if (!pricingData[mapInfo.groupCode]) {
            pricingData[mapInfo.groupCode] = {};
          }
          if (mapInfo.type === 'price') pricingData[mapInfo.groupCode].price = cellVal;
          if (mapInfo.type === 'mrp') pricingData[mapInfo.groupCode].mrp = cellVal;
          if (mapInfo.type === 'discount') pricingData[mapInfo.groupCode].discountPercent = cellVal;
        }
      });

      let isActive = false;
      if (isActiveStr) {
        const cleanVal = isActiveStr.trim().toUpperCase();
        isActive = cleanVal === 'YES' || cleanVal === 'TRUE' || cleanVal === '1';
      }

      parsedRows.push({
        rowNumber,
        id,
        sku: sku ? sku.trim() : null,
        name: name ? name.trim() : null,
        description: description ? description.trim() : null,
        productImage,
        productPictureUrl,
        productPrice,
        discountedPrice,
        stockQuantity: stockQuantity !== null ? Math.round(stockQuantity) : 0,
        moq: moq !== null ? Math.round(moq) : 1,
        brand,
        size,
        color,
        unit: unit || 'PCS',
        taxType,
        taxPercent,
        weight,
        parentProductSku,
        parentProductId,
        privateNotes,
        setName,
        setQuantity: setQuantity !== null ? Math.round(setQuantity) : null,
        setType,
        sizes,
        sizesSetQuantity: sizesSetQuantity !== null ? Math.round(sizesSetQuantity) : null,
        colors,
        colorsSetQuantity: colorsSetQuantity !== null ? Math.round(colorsSetQuantity) : null,
        nt11_48,
        nt11_48SetQuantity: nt11_48SetQuantity !== null ? Math.round(nt11_48SetQuantity) : null,
        sixToTwelveMonths,
        sixToTwelveMonthsSetQuantity: sixToTwelveMonthsSetQuantity !== null ? Math.round(sixToTwelveMonthsSetQuantity) : null,
        isActive,
        pricingData,
      });
    });

    // Validations
    const catalogProductIds = new Set(catalogue.products.map((p) => p.id));
    const skuSet = new Set<string>();

    for (const row of parsedRows) {
      if (!row.sku) {
        throw new BadRequestException(`Row ${row.rowNumber}: SKU is required.`);
      }
      if (!row.name) {
        throw new BadRequestException(`Row ${row.rowNumber}: Product name is required.`);
      }

      // Check within Excel duplicate SKUs
      const upperSku = row.sku.toUpperCase();
      if (skuSet.has(upperSku)) {
        throw new BadRequestException(`Duplicate SKU "${row.sku}" found in the uploaded Excel sheet.`);
      }
      skuSet.add(upperSku);

      // Check belongs to catalogue
      if (!catalogProductIds.has(row.id)) {
        throw new BadRequestException(`Row ${row.rowNumber}: Product with ID '${row.id}' does not belong to this catalogue.`);
      }

      // Check against database other products
      const duplicateSkuProduct = await this.prisma.product.findFirst({
        where: {
          sku: row.sku,
          id: { not: row.id },
        },
      });
      if (duplicateSkuProduct) {
        throw new BadRequestException(`Row ${row.rowNumber}: SKU "${row.sku}" is already in use by another product in the database.`);
      }
    }

    // Execute updates inside Transaction
    await this.prisma.$transaction(async (tx) => {
      // 1. Replaced By It: Delete catalog products that are omitted from Excel
      const uploadedIds = new Set(parsedRows.map((r) => r.id));
      const toDeleteIds = catalogue.products.map((p) => p.id).filter((id) => !uploadedIds.has(id));

      if (toDeleteIds.length > 0) {
        await tx.product.deleteMany({
          where: { id: { in: toDeleteIds } },
        });
      }

      // 2. Update each product
      for (const row of parsedRows) {
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
            stockStatus: row.stockQuantity > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
            updatedBy: userId,
          },
        });

        // Smart Image Sync
        const urlsToSync = [row.productImage, row.productPictureUrl].filter((url): url is string => !!url && url.trim().length > 0);
        for (const url of urlsToSync) {
          const trimmedUrl = url.trim();
          const existingImg = await tx.productImage.findFirst({
            where: {
              productId: row.id,
              originalUrl: trimmedUrl,
            },
          });
          if (!existingImg) {
            // Set all existing images for this product as isPrimary = false
            await tx.productImage.updateMany({
              where: { productId: row.id, isPrimary: true },
              data: { isPrimary: false },
            });

            // Create new primary image
            await tx.productImage.create({
              data: {
                productId: row.id,
                originalUrl: trimmedUrl,
                isPrimary: true,
                createdBy: userId,
              },
            });
          }
        }

        // Upsert pricings
        for (const groupCode of Object.keys(row.pricingData)) {
          const groupPricing = row.pricingData[groupCode];
          if (groupPricing.price === undefined || groupPricing.price === null) continue;

          const pricingGroup = await tx.pricingGroup.findUnique({
            where: { code: groupCode },
          });
          if (!pricingGroup) {
            throw new BadRequestException(`Pricing group "${groupCode}" not found.`);
          }

          await tx.productPricing.upsert({
            where: {
              productId_pricingGroupId: {
                productId: row.id,
                pricingGroupId: pricingGroup.id,
              },
            },
            update: {
              price: new Prisma.Decimal(groupPricing.price),
              mrp: groupPricing.mrp !== undefined && groupPricing.mrp !== null ? new Prisma.Decimal(groupPricing.mrp) : null,
              discountPercent:
                groupPricing.discountPercent !== undefined && groupPricing.discountPercent !== null
                  ? new Prisma.Decimal(groupPricing.discountPercent)
                  : null,
              updatedBy: userId,
            },
            create: {
              productId: row.id,
              pricingGroupId: pricingGroup.id,
              price: new Prisma.Decimal(groupPricing.price),
              mrp: groupPricing.mrp !== undefined && groupPricing.mrp !== null ? new Prisma.Decimal(groupPricing.mrp) : null,
              discountPercent:
                groupPricing.discountPercent !== undefined && groupPricing.discountPercent !== null
                  ? new Prisma.Decimal(groupPricing.discountPercent)
                  : null,
              createdBy: userId,
            },
          });
        }
      }
    });

    return { message: 'Catalogue products successfully updated and replaced.' };
  }
}
