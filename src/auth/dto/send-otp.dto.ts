import { IsString, IsNotEmpty } from 'class-validator';

export class SendOtpDto {
  @IsNotEmpty()
  @IsString()
  mobile: string;
}
