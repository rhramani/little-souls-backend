import {
  IsMongoId,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  IsNumber,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PurchaseOrderItemDto {
  @IsMongoId()
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0.01)
  costPrice: number;

  @IsNumber()
  @Min(0)
  taxPercent: number;
}

export class CreatePurchaseOrderDto {
  @IsMongoId()
  supplierId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items: PurchaseOrderItemDto[];
}
