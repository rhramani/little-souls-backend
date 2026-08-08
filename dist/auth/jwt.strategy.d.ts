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
        customerContact: {
            name: string;
            email: string | null;
            mobile: string;
            designation: string | null;
            id: string;
            customerId: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            photoUrl: string | null;
            whatsappNumber: string | null;
            loginAccess: boolean;
            isPrimary: boolean;
            canPlaceOrder: boolean;
            canViewLedger: boolean;
            canDownloadInvoice: boolean;
        } | null;
        staff: {
            name: string;
            email: string | null;
            mobile: string;
            employeeCode: string;
            designation: string | null;
            department: string | null;
            id: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
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
                name: string;
                id: string;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                description: string | null;
                isSystemRole: boolean;
            };
        } & {
            id: string;
            createdAt: Date;
            userId: string;
            roleId: string;
        })[];
    } & {
        name: string;
        email: string | null;
        mobile: string;
        id: string;
        customerContactId: string | null;
        passwordHash: string;
        plainPassword: string | null;
        userType: import("@prisma/client").$Enums.UserType;
        customerId: string | null;
        staffId: string | null;
        isActive: boolean;
        isVerified: boolean;
        lastLoginAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
export {};
