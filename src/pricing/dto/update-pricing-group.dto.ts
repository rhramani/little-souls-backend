import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class UpdatePricingGroupDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  desc?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
