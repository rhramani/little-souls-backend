import { IsMongoId } from 'class-validator';

export class AssignCustomerDto {
  @IsMongoId()
  customerId: string;

  @IsMongoId()
  salesStaffId: string;
}
