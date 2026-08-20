import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { RegisterStaffDto } from './dto/register-staff.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { EventsGateway } from '../events/events.gateway';
import { CustomerActivityService } from '../events/customer-activity.service';
import { EmailService } from '../common/email.service';
export declare class AuthService {
    private readonly prisma;
    private readonly jwtService;
    private readonly eventsGateway;
    private readonly customerActivityService;
    private readonly emailService;
    constructor(prisma: PrismaService, jwtService: JwtService, eventsGateway: EventsGateway, customerActivityService: CustomerActivityService, emailService: EmailService);
    registerStaff(dto: RegisterStaffDto): Promise<{
        message: string;
        user: {
            id: string;
            name: string;
            email: string | null;
            userType: import("@prisma/client").$Enums.UserType;
        };
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
        };
    }>;
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
        };
        accessToken: null;
        refreshToken: null;
    }>;
    login(dto: LoginDto, userAgent?: string, ipAddress?: string): Promise<{
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
    updateProfile(userId: string, dto: UpdateProfileDto): Promise<{
        message: string;
        user: {
            id: string;
            name: string;
            email: string | null;
            mobile: string;
            userType: import("@prisma/client").$Enums.UserType;
            isActive: boolean;
            isVerified: boolean;
        };
    }>;
    getProfile(userId: string): Promise<{
        role: import("@prisma/client").$Enums.UserType;
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
        id: string;
        createdAt: Date;
        name: string;
        email: string | null;
        mobile: string;
        userType: import("@prisma/client").$Enums.UserType;
        isActive: boolean;
        isVerified: boolean;
        lastLoginAt: Date | null;
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
        userRoles: {
            role: {
                id: string;
                name: string;
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
    sendOtp(mobile: string): Promise<{
        message: string;
    }>;
    verifyOtp(mobile: string, otp: string, userAgent?: string, ipAddress?: string): Promise<{
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
    refreshToken(refreshToken: string, ipAddress?: string, userAgent?: string): Promise<{
        accessToken: string;
        token: string;
        refreshToken: string;
    }>;
    getCustomerStatus(id: string): Promise<{
        id: string;
        gstin: string | null;
        businessName: string;
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
