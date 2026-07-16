import { IsArray, IsString } from 'class-validator';

export class BulkDeleteProductsDto {
  @IsArray()
  @IsString({ each: true })
  ids: string[];
}
