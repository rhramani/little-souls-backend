import { PrismaService } from '../prisma/prisma.service';
export interface ActivityItem {
    action: string;
    section: string;
    path?: string;
    details?: string;
    timestamp: string;
    durationSeconds?: number;
}
export interface ActiveSessionData {
    sessionId: string;
    userId: string;
    customerId: string;
    customerCode?: string;
    businessName?: string;
    customerName?: string;
    customerEmail?: string;
    customerMobile?: string;
    loginTime: Date;
    currentSection: string;
    currentSectionStartTime: number;
    sectionDurations: Record<string, number>;
    activities: ActivityItem[];
}
export declare class CustomerActivityService {
    private readonly prisma;
    private readonly logger;
    private activeSessions;
    constructor(prisma: PrismaService);
    startSession(data: {
        sessionId?: string;
        userId: string;
        customerId?: string;
        customerCode?: string;
        businessName?: string;
        customerName?: string;
        customerEmail?: string;
        customerMobile?: string;
    }): ActiveSessionData;
    recordActivity(sessionKey: string, activity: {
        action: string;
        section: string;
        path?: string;
        details?: string;
    }): void;
    getActiveSession(sessionKey: string): ActiveSessionData | undefined;
    endSession(sessionKey: string, gatewayServer?: any): Promise<{
        id: any;
        sessionId: string;
        userId: string;
        customerId: string;
        customer: {
            businessName: string | undefined;
            customerCode: string | undefined;
            name: string | undefined;
            email: string | undefined;
            mobile: string | undefined;
        };
        loginTime: string;
        logoutTime: string;
        totalDurationSeconds: number;
        formattedDuration: string;
        sectionDurations: Record<string, number>;
        formattedSections: string;
        keyHighlights: string;
        activities: ActivityItem[];
        activitySummaryLines: string[];
        summaryMessage: string;
    } | null>;
    getSessionHistory(page?: number, limit?: number): Promise<{
        sessions: {
            totalDurationFormatted: string;
            sectionDurationsObj: any;
            activitiesList: any;
            user: {
                id: string;
                name: string;
                email: string | null;
                mobile: string;
            };
            customer: {
                id: string;
                businessName: string;
                customerCode: string | null;
                mainContactNumber: string;
            };
            id: string;
            customerId: string;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            sessionId: string | null;
            loginTime: Date;
            logoutTime: Date | null;
            totalDuration: number | null;
            sectionDurations: string | null;
            activities: string | null;
            userId: string;
        }[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    getSessionDetails(id: string): Promise<{
        totalDurationFormatted: string;
        sectionDurationsObj: any;
        activitiesList: any;
        user: {
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
        };
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
        };
        id: string;
        customerId: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        sessionId: string | null;
        loginTime: Date;
        logoutTime: Date | null;
        totalDuration: number | null;
        sectionDurations: string | null;
        activities: string | null;
        userId: string;
    } | null>;
    private formatDuration;
}
