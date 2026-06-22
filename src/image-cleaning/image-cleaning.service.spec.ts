import { Test, TestingModule } from '@nestjs/testing';
import { ImageCleaningService } from './image-cleaning.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { UploadService } from '../upload/upload.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ImageCleaningService', () => {
  let service: ImageCleaningService;

  const mockProductImage = {
    id: 'img-123',
    productId: 'prod-123',
    originalUrl: 'https://example.com/original.jpg',
    cleanedUrl: null,
    cleaningStatus: 'NOT_REQUIRED',
  };

  const mockTask = {
    id: 'task-123',
    productImageId: 'img-123',
    productId: 'prod-123',
    provider: 'PHOTOROOM',
    originalUrl: 'https://example.com/original.jpg',
    status: 'PENDING',
    createdBy: 'user-123',
  };

  const mockPrismaService = {
    productImage: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    imageCleaningTask: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockUploadService = {
    uploadBuffer: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImageCleaningService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: UploadService,
          useValue: mockUploadService,
        },
      ],
    }).compile();

    service = module.get<ImageCleaningService>(ImageCleaningService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('submitTask', () => {
    it('should throw NotFoundException if product image does not exist', async () => {
      mockPrismaService.productImage.findUnique.mockResolvedValue(null);

      await expect(
        service.submitTask({ productImageId: 'non-existent' }, 'user-123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if image is already being processed', async () => {
      mockPrismaService.productImage.findUnique.mockResolvedValue({
        ...mockProductImage,
        cleaningStatus: 'PROCESSING',
      });

      await expect(
        service.submitTask({ productImageId: 'img-123' }, 'user-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully create task and return message', async () => {
      mockPrismaService.productImage.findUnique.mockResolvedValue(
        mockProductImage,
      );
      mockPrismaService.imageCleaningTask.create.mockResolvedValue(mockTask);
      mockPrismaService.productImage.update.mockResolvedValue({
        ...mockProductImage,
        cleaningStatus: 'PROCESSING',
      });

      // Stub background processor to avoid actual runtime behavior during this test
      jest
        .spyOn(service, 'processTaskInBackground')
        .mockResolvedValue(undefined);

      const result = await service.submitTask(
        { productImageId: 'img-123' },
        'user-123',
      );

      expect(result).toEqual({
        message: 'Image cleaning task submitted successfully.',
        taskId: mockTask.id,
      });

      expect(mockPrismaService.imageCleaningTask.create).toHaveBeenCalledWith({
        data: {
          productImageId: mockProductImage.id,
          productId: mockProductImage.productId,
          provider: 'PHOTOROOM',
          originalUrl: mockProductImage.originalUrl,
          status: 'PENDING',
          createdBy: 'user-123',
        },
      });

      expect(mockPrismaService.productImage.update).toHaveBeenCalledWith({
        where: { id: mockProductImage.id },
        data: { cleaningStatus: 'PROCESSING' },
      });
    });
  });

  describe('triggerBackgroundCleaningForProduct', () => {
    it('should find images and trigger autoCleanImage for eligible images', async () => {
      mockPrismaService.productImage.findMany.mockResolvedValue([
        mockProductImage,
      ]);
      const spyAutoClean = jest
        .spyOn(service, 'autoCleanImage')
        .mockResolvedValue(undefined);

      await service.triggerBackgroundCleaningForProduct('prod-123', 'user-123');

      expect(mockPrismaService.productImage.findMany).toHaveBeenCalledWith({
        where: {
          productId: 'prod-123',
          cleaningStatus: { in: ['NOT_REQUIRED', 'FAILED'] },
        },
      });
      expect(spyAutoClean).toHaveBeenCalledWith('img-123', 'user-123');
    });
  });

  describe('triggerBackgroundCleaningForCatalogue', () => {
    it('should find images for catalogue and trigger autoCleanImage', async () => {
      mockPrismaService.productImage.findMany.mockResolvedValue([
        mockProductImage,
      ]);
      const spyAutoClean = jest
        .spyOn(service, 'autoCleanImage')
        .mockResolvedValue(undefined);

      await service.triggerBackgroundCleaningForCatalogue(
        'cat-123',
        'user-123',
      );

      expect(mockPrismaService.productImage.findMany).toHaveBeenCalledWith({
        where: {
          product: { catalogueId: 'cat-123' },
          cleaningStatus: { in: ['NOT_REQUIRED', 'FAILED'] },
        },
      });
      expect(spyAutoClean).toHaveBeenCalledWith('img-123', 'user-123');
    });
  });

  describe('autoCleanImage', () => {
    it('should exit early if image is already processing', async () => {
      mockPrismaService.productImage.findUnique.mockResolvedValue({
        ...mockProductImage,
        cleaningStatus: 'PROCESSING',
      });

      await service.autoCleanImage('img-123', 'user-123');

      expect(mockPrismaService.imageCleaningTask.create).not.toHaveBeenCalled();
    });

    it('should create a task and call processTaskInBackground', async () => {
      mockPrismaService.productImage.findUnique.mockResolvedValue(
        mockProductImage,
      );
      mockPrismaService.imageCleaningTask.create.mockResolvedValue(mockTask);
      mockPrismaService.productImage.update.mockResolvedValue(undefined);
      const spyProcess = jest
        .spyOn(service, 'processTaskInBackground')
        .mockResolvedValue(undefined);

      await service.autoCleanImage('img-123', 'user-123');

      expect(mockPrismaService.imageCleaningTask.create).toHaveBeenCalled();
      expect(mockPrismaService.productImage.update).toHaveBeenCalledWith({
        where: { id: 'img-123' },
        data: { cleaningStatus: 'PROCESSING' },
      });
      expect(spyProcess).toHaveBeenCalledWith(mockTask.id, 'user-123');
    });
  });

  describe('processTaskInBackground', () => {
    it('should complete with mock URL if API key is invalid/missing', async () => {
      mockConfigService.get.mockReturnValue('dummy_key');
      mockPrismaService.imageCleaningTask.findUnique.mockResolvedValue(
        mockTask,
      );
      mockPrismaService.imageCleaningTask.update.mockResolvedValue(undefined);
      mockPrismaService.productImage.update.mockResolvedValue(undefined);

      await service.processTaskInBackground('task-123', 'user-123');

      expect(mockPrismaService.imageCleaningTask.update).toHaveBeenCalledWith({
        where: { id: 'task-123' },
        data: {
          status: 'COMPLETED',
          cleanedUrl: expect.stringContaining('Mock+Cleaned+Image+task-123'),
        },
      });

      expect(mockPrismaService.productImage.update).toHaveBeenCalledWith({
        where: { id: 'img-123' },
        data: {
          cleanedUrl: expect.stringContaining('Mock+Cleaned+Image+task-123'),
          cleaningStatus: 'COMPLETED',
        },
      });
    }, 10000); // 10s timeout to allow the 2s mock delay to complete naturally

    it('should call Photoroom API v2 and upload to R2 if API key is valid', async () => {
      mockConfigService.get.mockReturnValue('real_photoroom_api_key');
      mockPrismaService.imageCleaningTask.findUnique.mockResolvedValue(
        mockTask,
      );
      mockPrismaService.imageCleaningTask.update.mockResolvedValue(undefined);
      mockPrismaService.productImage.update.mockResolvedValue(undefined);

      const fakeBuffer = Buffer.from('enhanced-image-binary');
      mockedAxios.get.mockResolvedValue({
        data: fakeBuffer,
        status: 200,
        headers: {},
      });

      mockUploadService.uploadBuffer.mockResolvedValue({
        fileUrl: 'https://r2.example.com/cleaned_task-123.png',
      });

      await service.processTaskInBackground('task-123', 'user-123');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('https://image-api.photoroom.com/v2/edit'),
        expect.objectContaining({
          headers: {
            'x-api-key': 'real_photoroom_api_key',
          },
          responseType: 'arraybuffer',
        }),
      );

      expect(mockUploadService.uploadBuffer).toHaveBeenCalledWith(
        fakeBuffer,
        'image/png',
        'cleaned_task-123.png',
      );

      expect(mockPrismaService.imageCleaningTask.update).toHaveBeenCalledWith({
        where: { id: 'task-123' },
        data: {
          status: 'COMPLETED',
          cleanedUrl: 'https://r2.example.com/cleaned_task-123.png',
        },
      });
    });

    it('should set status to FAILED if Photoroom API or upload fails', async () => {
      mockConfigService.get.mockReturnValue('real_photoroom_api_key');
      mockPrismaService.imageCleaningTask.findUnique.mockResolvedValue(
        mockTask,
      );
      mockPrismaService.imageCleaningTask.update.mockResolvedValue(undefined);
      mockPrismaService.productImage.update.mockResolvedValue(undefined);

      mockedAxios.get.mockRejectedValue({
        message: 'Network Error',
        response: {
          status: 500,
          data: 'Internal server error from Photoroom',
        },
      });

      await service.processTaskInBackground('task-123', 'user-123');

      expect(mockPrismaService.imageCleaningTask.update).toHaveBeenCalledWith({
        where: { id: 'task-123' },
        data: {
          status: 'FAILED',
          errorMessage: expect.stringContaining('Photoroom API Error (500)'),
        },
      });

      expect(mockPrismaService.productImage.update).toHaveBeenCalledWith({
        where: { id: 'img-123' },
        data: {
          cleaningStatus: 'FAILED',
        },
      });
    });
  });
});
