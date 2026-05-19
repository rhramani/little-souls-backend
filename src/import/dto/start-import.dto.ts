import { IsString, IsEnum, IsArray, IsNotEmpty } from 'class-validator';

export class StartImportDto {
  @IsString()
  @IsNotEmpty()
  fileUrl: string;

  @IsEnum(['PRODUCT_CREATE', 'PRODUCT_UPDATE', 'PRICE_UPDATE', 'STOCK_UPDATE'])
  importType: string;

  @IsArray()
  @IsNotEmpty()
  rows: any[];
}
