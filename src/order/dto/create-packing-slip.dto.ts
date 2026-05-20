import { IsString, IsOptional } from 'class-validator';

export class CreatePackingSlipDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
