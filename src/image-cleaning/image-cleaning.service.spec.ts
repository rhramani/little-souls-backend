import { Test, TestingModule } from '@nestjs/testing';
import { ImageCleaningService } from './image-cleaning.service';

describe('ImageCleaningService', () => {
  let service: ImageCleaningService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ImageCleaningService],
    }).compile();

    service = module.get<ImageCleaningService>(ImageCleaningService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
