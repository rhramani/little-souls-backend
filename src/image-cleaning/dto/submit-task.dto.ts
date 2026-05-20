import { IsString, IsNotEmpty } from 'class-validator';

export class SubmitTaskDto {
  @IsNotEmpty()
  @IsString()
  productImageId: string;
}
