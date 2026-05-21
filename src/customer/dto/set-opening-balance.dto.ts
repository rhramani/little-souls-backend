import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class SetOpeningBalanceDto {
  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;
}
