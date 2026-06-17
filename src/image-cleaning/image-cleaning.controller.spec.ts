import { Test, TestingModule } from '@nestjs/testing';
import { ImageCleaningController } from './image-cleaning.controller';
import { ImageCleaningService } from './image-cleaning.service';

describe('ImageCleaningController', () => {
  let controller: ImageCleaningController;

  const mockImageCleaningService = {
    submitTask: jest.fn(),
    handleWebhook: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImageCleaningController],
      providers: [
        {
          provide: ImageCleaningService,
          useValue: mockImageCleaningService,
        },
      ],
    }).compile();

    controller = module.get<ImageCleaningController>(ImageCleaningController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
