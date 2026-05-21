import { IsString, IsIn, IsOptional, IsDateString } from 'class-validator';

export class MarkAttendanceDto {
  @IsString()
  staffId: string;

  @IsDateString()
  attendanceDate: string;

  @IsIn(['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE'])
  status: string;

  @IsOptional()
  @IsString()
  note?: string;
}
