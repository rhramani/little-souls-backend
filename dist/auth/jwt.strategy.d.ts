import { Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
declare const JwtStrategy_base: new (...args: [opt: import("passport-jwt").StrategyOptionsWithRequest] | [opt: import("passport-jwt").StrategyOptionsWithoutRequest]) => Strategy & {
    validate(...args: any[]): unknown;
};
export declare class JwtStrategy extends JwtStrategy_base {
    private readonly prisma;
    constructor(prisma: PrismaService);
    validate(payload: {
        sub: string;
        email?: string;
        mobile: string;
        type: string;
    }): Promise<{
        customer: {
            id: string;
            approvedBy: string | null;
            approvedAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
            gstin: string | null;
            businessName: string;
            businessType: string | null;
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
            isActive: boolean;
            customerCode: string | null;
            mainContactNumber: string;
            pricingGroupId: string | null;
            assignedSalesStaffId: string | null;
            approvalStatus: import("@prisma/client").$Enums.ApprovalStatus;
            rejectionReason: string | null;
            creditLimit: number | null;
            openingBalance: number | null;
            currentBalance: number | null;
            lastOrderAt: Date | null;
        } | null;
        customerContact: {
            id: string;
            customerId: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            email: string | null;
            mobile: string;
            designation: string | null;
            isActive: boolean;
            photoUrl: string | null;
            whatsappNumber: string | null;
            loginAccess: boolean;
            isPrimary: boolean;
            canPlaceOrder: boolean;
            canViewLedger: boolean;
            canDownloadInvoice: boolean;
        } | null;
        staff: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            email: string | null;
            mobile: string;
            employeeCode: string;
            designation: string | null;
            department: string | null;
            isActive: boolean;
            photoUrl: string | null;
            joiningDate: Date | null;
            salary: number | null;
        } | null;
        userRoles: ({
            role: {
                rolePermissions: ({
                    permission: {
                        id: string;
                        createdAt: Date;
                        updatedAt: Date;
                        description: string | null;
                        module: string;
                        action: string;
                    };
                } & {
                    id: string;
                    createdAt: Date;
                    roleId: string;
                    permissionId: string;
                })[];
            } & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                name: string;
                description: string | null;
                isActive: boolean;
                isSystemRole: boolean;
            };
        } & {
            id: string;
            createdAt: Date;
            userId: string;
            roleId: string;
        })[];
    } & {
        id: string;
        customerId: string | null;
        customerContactId: string | null;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        email: string | null;
        mobile: string;
        passwordHash: string;
        plainPassword: string | null;
        userType: import("@prisma/client").$Enums.UserType;
        staffId: string | null;
        isActive: boolean;
        isVerified: boolean;
        lastLoginAt: Date | null;
    }>;
}
export {};
