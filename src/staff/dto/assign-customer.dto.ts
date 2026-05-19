import { IsUUID } from 'class-validator';

export class AssignCustomerDto {
  @IsUUID('4')
  customerId: string;

  @IsUUID('4')
  salesStaffId: string;
}
