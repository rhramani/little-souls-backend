import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { StockStatus } from '@prisma/client';

export class QueryProductDto {
  @IsInt()
  @IsOptional()
  page?: number = 1;

  @IsInt()
  @IsOptional()
  limit?: number = 10;

  @IsString()
  @IsOptional()
  search?: string;

  @IsUUID('4')
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  brand?: string;

  @IsEnum(StockStatus)
  @IsOptional()
  stockStatus?: StockStatus;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @IsString()
  @IsOptional()
  sortBy?: string = 'createdAt';

  @IsString()
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
