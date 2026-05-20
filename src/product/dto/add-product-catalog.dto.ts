import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class AddProductCatalogDto {
  @IsNotEmpty()
  @IsString()
  fileUrl: string;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  fileType: string;
}
