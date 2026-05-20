import {
  IsUUID,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  IsNumber,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PurchaseOrderItemDto {
  @IsUUID('4')
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
  @IsUUID('4')
  supplierId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items: PurchaseOrderItemDto[];
}
