import { IsMongoId, IsOptional } from 'class-validator';

export class ApproveCustomerDto {
  @IsMongoId()
  @IsOptional()
  pricingGroupId?: string;
}
