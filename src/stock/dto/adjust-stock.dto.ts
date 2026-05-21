import { IsString, IsIn, IsOptional, IsInt, IsPositive, IsNumber } from 'class-validator';

export class AdjustStockDto {
  @IsString()
  productId: string;

  @IsIn(['ADJUSTMENT_IN', 'ADJUSTMENT_OUT'])
  movementType: string;

  @IsInt()
  @IsPositive()
  quantity: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class OpeningStockDto {
  @IsString()
  productId: string;

  @IsInt()
  @IsPositive()
  quantity: number;

  @IsOptional()
  @IsString()
  note?: string;
}
