import {
  IsMongoId,
  IsNumber,
  Min,
  IsEnum,
  IsString,
  IsOptional,
} from 'class-validator';
import { IsR2Url } from '../../upload/decorators/is-r2-url.decorator';

export class RecordPaymentDto {
  @IsMongoId()
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
  @IsR2Url()
  attachmentUrl?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
