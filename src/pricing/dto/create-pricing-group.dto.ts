import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreatePricingGroupDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  code: string;

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
