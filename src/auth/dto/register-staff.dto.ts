import {
  IsString,
  IsNotEmpty,
  MinLength,
  IsEmail,
  IsOptional,
  Matches,
} from 'class-validator';

export class RegisterStaffDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  employeeCode?: string;

  @IsString()
  @IsNotEmpty()
  mobile: string;

  @IsString()
  @IsOptional()
  designation?: string;

  @IsString()
  @IsOptional()
  department?: string;
}
