import { IsOptional, IsInt, IsUUID, IsString } from 'class-validator';
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

  @IsUUID('4')
  @IsOptional()
  customerId?: string;

  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  type?: string;
}
