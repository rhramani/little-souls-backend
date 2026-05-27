import { IsOptional, IsInt, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryOrderDto {
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  limit?: number = 10;

  @IsString()
  @IsOptional()
  status?: string;
}
