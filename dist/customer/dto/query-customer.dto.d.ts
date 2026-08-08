import { ApprovalStatus } from '@prisma/client';
export declare class QueryCustomerDto {
    page?: number;
    limit?: number;
    status?: ApprovalStatus;
    search?: string;
}
