import { IsString, IsNotEmpty, IsNumber, Min } from 'class-validator';

export class CreateCreditDebitNoteDto {
  @IsNotEmpty()
  @IsString()
  customerId: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsNotEmpty()
  @IsString()
  reason: string;
}
