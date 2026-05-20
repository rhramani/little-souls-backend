import { IsUUID, IsOptional } from 'class-validator';

export class ApproveCustomerDto {
  @IsUUID('4')
  @IsOptional()
  pricingGroupId?: string;
}
