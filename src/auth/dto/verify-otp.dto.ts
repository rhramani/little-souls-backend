import { IsString, IsNotEmpty } from 'class-validator';

export class VerifyOtpDto {
  @IsNotEmpty()
  @IsString()
  mobile: string;

  @IsNotEmpty()
  @IsString()
  otp: string;
}
