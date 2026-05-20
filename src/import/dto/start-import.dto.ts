import { IsString, IsEnum, IsArray, IsNotEmpty } from 'class-validator';
import { IsR2Url } from '../../upload/decorators/is-r2-url.decorator';

export class StartImportDto {
  @IsString()
  @IsNotEmpty()
  @IsR2Url()
  fileUrl: string;

  @IsEnum(['PRODUCT_CREATE', 'PRODUCT_UPDATE', 'PRICE_UPDATE', 'STOCK_UPDATE'])
  importType: string;

  @IsArray()
  @IsNotEmpty()
  rows: any[];
}
