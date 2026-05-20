import { IsString, IsOptional } from 'class-validator';

export class RejectCustomerDto {
  @IsString()
  @IsOptional()
  reason?: string;
}
