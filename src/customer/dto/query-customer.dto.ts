import { IsOptional, IsInt, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApprovalStatus } from '@prisma/client';

export class QueryCustomerDto {
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  limit?: number = 10;

  @IsEnum(ApprovalStatus)
  @IsOptional()
  status?: ApprovalStatus;

  @IsString()
  @IsOptional()
  search?: string;
}
