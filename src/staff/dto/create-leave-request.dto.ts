import { IsString, IsIn, IsDateString, IsOptional } from 'class-validator';

export class CreateLeaveRequestDto {
  @IsIn(['CASUAL', 'SICK', 'PAID', 'UNPAID'])
  leaveType: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
