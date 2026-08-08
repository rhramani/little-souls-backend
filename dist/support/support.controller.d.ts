import { SupportService } from './support.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { QueryTicketDto } from './dto/query-ticket.dto';
export declare class SupportController {
    private readonly supportService;
    constructor(supportService: SupportService);
    createTicket(dto: CreateTicketDto, user: any): Promise<{
        user: {
            name: string;
            email: string | null;
        } | null;
        customer: {
            businessName: string;
            customerCode: string | null;
        } | null;
    } & {
        message: string;
        id: string;
        customerId: string | null;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        userId: string | null;
        subject: string;
        priority: string;
        ticketNumber: string;
        assignedTo: string | null;
    }>;
    findAll(query: QueryTicketDto, user: any): Promise<{
        tickets: ({
            user: {
                name: string;
                email: string | null;
            } | null;
            customer: {
                businessName: string;
                customerCode: string | null;
            } | null;
            assignedUser: {
                name: string;
            } | null;
        } & {
            message: string;
            id: string;
            customerId: string | null;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            userId: string | null;
            subject: string;
            priority: string;
            ticketNumber: string;
            assignedTo: string | null;
        })[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    findOne(id: string, user: any): Promise<{
        user: {
            name: string;
            email: string | null;
            id: string;
        } | null;
        customer: {
            businessName: string;
            businessType: string | null;
            gstin: string | null;
            billingAddressLine1: string | null;
            billingAddressLine2: string | null;
            billingCity: string | null;
            billingState: string | null;
            billingPincode: string | null;
            billingCountry: string | null;
            shippingAddressLine1: string | null;
            shippingAddressLine2: string | null;
            shippingCity: string | null;
            shippingState: string | null;
            shippingPincode: string | null;
            shippingCountry: string | null;
            storePhotoUrl: string | null;
            customerSource: string | null;
            id: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            customerCode: string | null;
            mainContactNumber: string;
            pricingGroupId: string | null;
            assignedSalesStaffId: string | null;
            approvalStatus: import("@prisma/client").$Enums.ApprovalStatus;
            approvedBy: string | null;
            approvedAt: Date | null;
            rejectionReason: string | null;
            creditLimit: number | null;
            openingBalance: number | null;
            currentBalance: number | null;
            lastOrderAt: Date | null;
        } | null;
        assignedUser: {
            name: string;
            email: string | null;
            id: string;
        } | null;
    } & {
        message: string;
        id: string;
        customerId: string | null;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        userId: string | null;
        subject: string;
        priority: string;
        ticketNumber: string;
        assignedTo: string | null;
    }>;
    assignTicket(id: string, assignedTo: string): Promise<{
        assignedUser: {
            name: string;
            email: string | null;
            id: string;
        } | null;
    } & {
        message: string;
        id: string;
        customerId: string | null;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        userId: string | null;
        subject: string;
        priority: string;
        ticketNumber: string;
        assignedTo: string | null;
    }>;
    transitionStatus(id: string, status: string): Promise<{
        message: string;
        id: string;
        customerId: string | null;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        userId: string | null;
        subject: string;
        priority: string;
        ticketNumber: string;
        assignedTo: string | null;
    }>;
    updatePriority(id: string, priority: string): Promise<{
        message: string;
        id: string;
        customerId: string | null;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        userId: string | null;
        subject: string;
        priority: string;
        ticketNumber: string;
        assignedTo: string | null;
    }>;
}
