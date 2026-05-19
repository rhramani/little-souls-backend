import { IsUUID, IsNumber, Min, IsEnum, IsString, IsOptional } from 'class-validator';

export class RecordPaymentDto {
  @IsUUID('4')
  customerId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsEnum(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER'])
  paymentMode: string;

  @IsString()
  transactionDate: string; // ISO date string

  @IsString()
  @IsOptional()
  referenceNumber?: string;

  @IsString()
  @IsOptional()
  attachmentUrl?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
