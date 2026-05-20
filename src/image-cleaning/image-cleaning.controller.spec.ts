import { Test, TestingModule } from '@nestjs/testing';
import { ImageCleaningController } from './image-cleaning.controller';

describe('ImageCleaningController', () => {
  let controller: ImageCleaningController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImageCleaningController],
    }).compile();

    controller = module.get<ImageCleaningController>(ImageCleaningController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
