import { IsUUID, IsInt, Min } from 'class-validator';

export class AddToCartDto {
  @IsUUID('4')
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}
