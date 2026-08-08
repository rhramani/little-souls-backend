import type { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    registerCustomer(dto: RegisterCustomerDto): Promise<{
        message: string;
        user: {
            id: string;
            name: string;
            email: string | null;
            mobile: string;
            userType: import("@prisma/client").$Enums.UserType;
            isVerified: boolean;
        };
        customer: {
            status: import("@prisma/client").$Enums.ApprovalStatus;
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
        };
        accessToken: null;
        refreshToken: null;
    }>;
    registerStaff(dto: import('./dto/register-staff.dto').RegisterStaffDto): Promise<{
        message: string;
        user: {
            id: string;
            name: string;
            email: string | null;
            userType: import("@prisma/client").$Enums.UserType;
        };
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
        };
    }>;
    login(dto: LoginDto, req: Request, ipAddress: string): Promise<{
        message: string;
        user: {
            id: string;
            name: string;
            email: string | null;
            mobile: string;
            userType: import("@prisma/client").$Enums.UserType;
            isVerified: boolean;
            customerId: string | null;
            customerContactId: string | null;
            customerApprovalStatus: import("@prisma/client").$Enums.ApprovalStatus | undefined;
        };
        accessToken: string;
        token: string;
        refreshToken: string;
    }>;
    refreshToken(dto: RefreshTokenDto, req: Request, ipAddress: string): Promise<{
        accessToken: string;
        token: string;
        refreshToken: string;
    }>;
    logout(userId: string, sessionId?: string): Promise<{
        message: string;
    }>;
    forgotPassword(dto: ForgotPasswordDto): Promise<any>;
    resetPassword(dto: ResetPasswordDto): Promise<{
        message: string;
    }>;
    updatePassword(userId: string, dto: UpdatePasswordDto): Promise<{
        message: string;
    }>;
    getProfile(userId: string): Promise<{
        role: import("@prisma/client").$Enums.UserType;
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
        name: string;
        email: string | null;
        mobile: string;
        id: string;
        userType: import("@prisma/client").$Enums.UserType;
        isActive: boolean;
        isVerified: boolean;
        lastLoginAt: Date | null;
        createdAt: Date;
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
        userRoles: {
            role: {
                name: string;
                id: string;
                rolePermissions: {
                    permission: {
                        description: string | null;
                        module: string;
                        action: string;
                    };
                }[];
            };
        }[];
    }>;
    updateProfile(userId: string, dto: UpdateProfileDto): Promise<{
        message: string;
        user: {
            name: string;
            email: string | null;
            mobile: string;
            id: string;
            userType: import("@prisma/client").$Enums.UserType;
            isActive: boolean;
            isVerified: boolean;
        };
    }>;
    sendOtp(dto: SendOtpDto): Promise<{
        message: string;
    }>;
    verifyOtp(dto: VerifyOtpDto, req: Request, ipAddress: string): Promise<{
        message: string;
        user: {
            id: string;
            name: string;
            email: string | null;
            mobile: string;
            userType: import("@prisma/client").$Enums.UserType;
            isVerified: boolean;
            customerId: string | null;
            customerContactId: string | null;
            customerApprovalStatus: import("@prisma/client").$Enums.ApprovalStatus | undefined;
        };
        accessToken: string;
        token: string;
        refreshToken: string;
    }>;
    getCustomerStatus(id: string): Promise<{
        businessName: string;
        gstin: string | null;
        id: string;
        isActive: boolean;
        approvalStatus: import("@prisma/client").$Enums.ApprovalStatus;
        rejectionReason: string | null;
    }>;
    checkGstin(gstin: string): Promise<{
        exists: boolean;
        message?: undefined;
    } | {
        exists: boolean;
        message: string;
    }>;
}
