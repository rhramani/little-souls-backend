import { Test, TestingModule } from '@nestjs/testing';
import { CatalogueService } from './catalogue.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

jest.mock('axios', () => ({
  get: jest.fn().mockResolvedValue({
    data: Buffer.from('dummy-image-data'),
    headers: { 'content-type': 'image/jpeg' },
  }),
}));

describe('CatalogueService', () => {
  let service: CatalogueService;

  const mockPricingGroup = {
    id: 'group-retail-id',
    code: 'RETAIL',
    isActive: true,
  };

  const mockProduct = {
    id: 'prod-uuid-1',
    sku: 'SKU-TEST-1',
    name: 'Test Product 1',
    description: 'Description 1',
    productImage: 'https://cdn.example.com/product1.jpg',
    productPictureUrl: 'https://cdn.example.com/product1_pic.jpg',
    productPrice: '100.00',
    discountedPrice: '80.00',
    stockQuantity: 50,
    isActive: true,
    moq: 2,
    brand: 'SoulsBrand',
    size: 'L',
    color: 'Red',
    unit: 'PCS',
    taxType: 'GST-18',
    taxPercent: '18.00',
    weight: '0.75',
    parentProductSku: 'PARENT-SKU-1',
    parentProductId: 'parent-uuid-1',
    privateNotes: 'Secret note',
    setName: 'Set A',
    setQuantity: 4,
    setType: 'Pack',
    sizes: 'M,L,XL',
    sizesSetQuantity: 12,
    colors: 'Red,Green',
    colorsSetQuantity: 8,
    nt11_48: 'nt-val',
    nt11_48SetQuantity: 3,
    sixToTwelveMonths: '6-12-val',
    sixToTwelveMonthsSetQuantity: 6,
    images: [
      {
        id: 'img-1',
        originalUrl: 'https://cdn.example.com/product1.jpg',
        isPrimary: true,
      },
    ],
    pricing: [
      {
        pricingGroupId: 'group-retail-id',
        price: '90.00',
        mrp: '110.00',
        discountPercent: '10.00',
      },
    ],
  };

  const mockCatalogue = {
    id: 'cat-uuid-1',
    name: 'Test Catalogue',
    products: [mockProduct],
  };

  const mockPrismaService = {
    pricingGroup: {
      findMany: jest.fn().mockResolvedValue([mockPricingGroup]),
      findUnique: jest.fn().mockResolvedValue(mockPricingGroup),
    },
    catalogue: {
      findUnique: jest.fn().mockResolvedValue(mockCatalogue),
    },
    product: {
      findFirst: jest.fn().mockResolvedValue(null),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      update: jest.fn().mockResolvedValue(mockProduct),
    },
    productImage: {
      findFirst: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({}),
    },
    productPricing: {
      upsert: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogueService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CatalogueService>(CatalogueService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('exportCatalogue', () => {
    it('should generate an Excel workbook with correct headers and mapping values', async () => {
      const buffer = await service.exportCatalogue('cat-uuid-1');
      expect(buffer).toBeDefined();

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const sheet = workbook.worksheets[0];
      expect(sheet).toBeDefined();

      // Read and assert headers
      const headers: string[] = [];
      sheet.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber] = cell.value ? cell.value.toString() : '';
      });

      expect(headers).toContain('Product ID (System ID - Do Not Edit)');
      expect(headers).toContain('SKU');
      expect(headers).toContain('Product Name');
      expect(headers).toContain('Product Image');
      expect(headers).toContain('Product Picture url');
      expect(headers).toContain('Product Price');
      expect(headers).toContain('Discounted price');
      expect(headers).toContain('Tax "type"');
      expect(headers).toContain('Tax percentage');
      expect(headers).toContain('Weight');
      expect(headers).toContain('Set Name');
      expect(headers).toContain('Set Quantity');
      expect(headers).toContain('sizes');
      expect(headers).toContain('Sizes Set Quantity');
      expect(headers).toContain('colors');
      expect(headers).toContain('Colors Set Quantity');
      expect(headers).toContain('nt11-48');
      expect(headers).toContain('Nt11-48 Set Quantity');
      expect(headers).toContain('6-12 months');
      expect(headers).toContain('6-12 months Set Quantity');
      expect(headers).toContain('Price - RETAIL');

      // Assert first row data
      const firstRow = sheet.getRow(2);
      expect(firstRow.getCell(headers.indexOf('Product ID (System ID - Do Not Edit)')).value).toBe(mockProduct.id);
      expect(firstRow.getCell(headers.indexOf('SKU')).value).toBe(mockProduct.sku);
      expect(firstRow.getCell(headers.indexOf('Product Name')).value).toBe(mockProduct.name);
      expect(firstRow.getCell(headers.indexOf('Product Image')).value).toBe(mockProduct.productImage);
      expect(firstRow.getCell(headers.indexOf('Product Picture url')).value).toBe(mockProduct.productPictureUrl);
      expect(firstRow.getCell(headers.indexOf('Product Price')).value).toBe(mockProduct.productPrice);
      expect(firstRow.getCell(headers.indexOf('Discounted price')).value).toBe(mockProduct.discountedPrice);
      expect(firstRow.getCell(headers.indexOf('Tax "type"')).value).toBe(mockProduct.taxType);
      expect(firstRow.getCell(headers.indexOf('Tax percentage')).value).toBe(mockProduct.taxPercent);
      expect(firstRow.getCell(headers.indexOf('Weight')).value).toBe(mockProduct.weight);
      expect(firstRow.getCell(headers.indexOf('Set Name')).value).toBe(mockProduct.setName);
      expect(firstRow.getCell(headers.indexOf('Set Quantity')).value).toBe(mockProduct.setQuantity);
      expect(firstRow.getCell(headers.indexOf('sizes')).value).toBe(mockProduct.sizes);
      expect(firstRow.getCell(headers.indexOf('Sizes Set Quantity')).value).toBe(mockProduct.sizesSetQuantity);
      expect(firstRow.getCell(headers.indexOf('colors')).value).toBe(mockProduct.colors);
      expect(firstRow.getCell(headers.indexOf('Colors Set Quantity')).value).toBe(mockProduct.colorsSetQuantity);
      expect(firstRow.getCell(headers.indexOf('nt11-48')).value).toBe(mockProduct.nt11_48);
      expect(firstRow.getCell(headers.indexOf('Nt11-48 Set Quantity')).value).toBe(mockProduct.nt11_48SetQuantity);
      expect(firstRow.getCell(headers.indexOf('6-12 months')).value).toBe(mockProduct.sixToTwelveMonths);
      expect(firstRow.getCell(headers.indexOf('6-12 months Set Quantity')).value).toBe(mockProduct.sixToTwelveMonthsSetQuantity);
    });
  });

  describe('importCatalogue', () => {
    it('should successfully parse optional fields and run updates inside transaction', async () => {
      // 1. Create a dummy Excel sheet in memory
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Catalogue Products');
      
      const columns = [
        { header: 'Product ID (System ID - Do Not Edit)', key: 'id' },
        { header: 'SKU', key: 'sku' },
        { header: 'Product Name', key: 'name' },
        { header: 'Product Description', key: 'description' },
        { header: 'Product Image', key: 'productImage' },
        { header: 'Product Picture url', key: 'productPictureUrl' },
        { header: 'Product Price', key: 'productPrice' },
        { header: 'Discounted price', key: 'discountedPrice' },
        { header: 'Available quantity', key: 'stockQuantity' },
        { header: 'Is Active (YES/NO)', key: 'isActive' },
        { header: 'MOQ', key: 'moq' },
        { header: 'Brand', key: 'brand' },
        { header: 'Tax "type"', key: 'taxType' },
        { header: 'Tax percentage', key: 'taxPercent' },
        { header: 'Weight', key: 'weight' },
        { header: 'Parent product sku', key: 'parentProductSku' },
        { header: 'Parent product id', key: 'parentProductId' },
        { header: 'Private notes', key: 'privateNotes' },
        { header: 'Set Name', key: 'setName' },
        { header: 'Set Quantity', key: 'setQuantity' },
        { header: 'Set Type', key: 'setType' },
        { header: 'sizes', key: 'sizes' },
        { header: 'Sizes Set Quantity', key: 'sizesSetQuantity' },
        { header: 'colors', key: 'colors' },
        { header: 'Colors Set Quantity', key: 'colorsSetQuantity' },
        { header: 'nt11-48', key: 'nt11_48' },
        { header: 'Nt11-48 Set Quantity', key: 'nt11_48SetQuantity' },
        { header: '6-12 months', key: 'sixToTwelveMonths' },
        { header: '6-12 months Set Quantity', key: 'sixToTwelveMonthsSetQuantity' },
        { header: 'Price - RETAIL', key: 'price_RETAIL' },
      ];
      sheet.columns = columns;

      sheet.addRow({
        id: 'prod-uuid-1',
        sku: 'NEW-SKU-1',
        name: 'Updated Name 1',
        description: 'Updated Description 1',
        productImage: 'https://new-cdn.com/product1_new.jpg',
        productPictureUrl: 'https://new-cdn.com/product1_pic_new.jpg',
        productPrice: 120.50,
        discountedPrice: 99.99,
        stockQuantity: 42,
        isActive: 'YES',
        moq: 3,
        brand: 'New Brand',
        taxType: 'VAT',
        taxPercent: 5.5,
        weight: 1.25,
        parentProductSku: 'PAR-SKU',
        parentProductId: 'par-uuid',
        privateNotes: 'New private notes',
        setName: 'Set B',
        setQuantity: 5,
        setType: 'Bundle',
        sizes: 'S,M',
        sizesSetQuantity: 10,
        colors: 'Black',
        colorsSetQuantity: 5,
        nt11_48: 'new-nt-val',
        nt11_48SetQuantity: 4,
        sixToTwelveMonths: 'new-6-12-val',
        sixToTwelveMonthsSetQuantity: 8,
        price_RETAIL: 110.00,
      });

      const buffer = await workbook.xlsx.writeBuffer();

      // Mock DB behavior:
      // ProductImage: image not found initially, meaning smart image sync will be triggered
      mockPrismaService.productImage.findFirst.mockResolvedValue(null);

      // Run import
      const result = await service.importCatalogue('cat-uuid-1', buffer as any, 'user-uuid-1');
      expect(result.message).toBe('Catalogue products successfully updated and replaced.');

      // Check product update arguments
      expect(mockPrismaService.product.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'prod-uuid-1' },
        data: expect.objectContaining({
          sku: 'NEW-SKU-1',
          name: 'Updated Name 1',
          description: 'Updated Description 1',
          productImage: 'https://new-cdn.com/product1_new.jpg',
          productPictureUrl: 'https://new-cdn.com/product1_pic_new.jpg',
          setName: 'Set B',
          setQuantity: 5,
          sizes: 'S,M',
          sizesSetQuantity: 10,
          colors: 'Black',
          colorsSetQuantity: 5,
          nt11_48: 'new-nt-val',
          nt11_48SetQuantity: 4,
          sixToTwelveMonths: 'new-6-12-val',
          sixToTwelveMonthsSetQuantity: 8,
        }),
      }));

      // Check Decimal conversions
      const updateCall = mockPrismaService.product.update.mock.calls[0][0];
      expect(updateCall.data.productPrice.toString()).toBe('120.5');
      expect(updateCall.data.discountedPrice.toString()).toBe('99.99');
      expect(updateCall.data.taxPercent.toString()).toBe('5.5');
      expect(updateCall.data.weight.toString()).toBe('1.25');

      // Check Smart Image Sync: should demote other primary images and create the new primary ones
      expect(mockPrismaService.productImage.updateMany).toHaveBeenCalledWith({
        where: { productId: 'prod-uuid-1', isPrimary: true },
        data: { isPrimary: false },
      });
      expect(mockPrismaService.productImage.create).toHaveBeenCalledWith({
        data: {
          productId: 'prod-uuid-1',
          originalUrl: 'https://new-cdn.com/product1_new.jpg',
          isPrimary: true,
          createdBy: 'user-uuid-1',
        },
      });
      expect(mockPrismaService.productImage.create).toHaveBeenCalledWith({
        data: {
          productId: 'prod-uuid-1',
          originalUrl: 'https://new-cdn.com/product1_pic_new.jpg',
          isPrimary: true,
          createdBy: 'user-uuid-1',
        },
      });
    });

    it('should throw BadRequestException if SKU or Name is missing', async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Catalogue Products');
      sheet.columns = [
        { header: 'Product ID (System ID - Do Not Edit)', key: 'id' },
        { header: 'SKU', key: 'sku' },
        { header: 'Product Name', key: 'name' },
      ];
      sheet.addRow({ id: 'prod-uuid-1', sku: '', name: 'Test' });

      const buffer = await workbook.xlsx.writeBuffer();

      await expect(service.importCatalogue('cat-uuid-1', buffer as any, 'user-uuid-1'))
        .rejects.toThrow(BadRequestException);
    });
  });
});
