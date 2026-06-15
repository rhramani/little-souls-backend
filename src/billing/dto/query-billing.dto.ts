import { IsOptional, IsInt, IsMongoId, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryBillingDto {
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  limit?: number = 10;

  @IsMongoId()
  @IsOptional()
  customerId?: string;

  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  type?: string;
}
