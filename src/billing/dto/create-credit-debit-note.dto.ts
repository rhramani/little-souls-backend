import { IsString, IsNotEmpty, IsNumber, Min, IsOptional } from 'class-validator';

export class CreateCreditDebitNoteDto {
  @IsNotEmpty()
  @IsString()
  customerId: string;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsNotEmpty()
  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  chargeType?: string; // "DISCOUNT" | "PACKING" | "OTHER" | "CUSTOM"

  @IsOptional()
  @IsString()
  noteType?: string; // "CREDIT_NOTE" | "DEBIT_NOTE"

  @IsOptional()
  @IsNumber()
  discountAmount?: number;

  @IsOptional()
  @IsNumber()
  packingCharges?: number;

  @IsOptional()
  @IsNumber()
  otherCharges?: number;

  @IsOptional()
  @IsString()
  paymentId?: string;
}
