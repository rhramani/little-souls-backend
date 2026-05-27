import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { StockStatus } from '@prisma/client';

export class QueryProductDto {
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
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

  @IsString()
  @IsOptional()
  stockStatuses?: string; // Comma-separated array string

  @IsString()
  @IsOptional()
  moqTiers?: string; // Comma-separated array string

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
