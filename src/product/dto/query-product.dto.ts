import {
  IsString,
  IsOptional,
  IsMongoId,
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

  @IsMongoId()
  @IsOptional()
  categoryId?: string;

  @IsMongoId()
  @IsOptional()
  catalogueId?: string;


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

  @IsBoolean()
  @IsOptional()
  hasCatalogue?: boolean;

  @IsString()
  @IsOptional()
  sortBy?: string = 'createdAt';

  @IsString()
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
