import { IsOptional, IsInt, IsString } from 'class-validator';

export class QueryOrderDto {
  @IsInt()
  @IsOptional()
  page?: number = 1;

  @IsInt()
  @IsOptional()
  limit?: number = 10;

  @IsString()
  @IsOptional()
  status?: string;
}
