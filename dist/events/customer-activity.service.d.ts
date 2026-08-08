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
                name: string;
                email: string | null;
                mobile: string;
                id: string;
            };
            customer: {
                businessName: string;
                id: string;
                customerCode: string | null;
                mainContactNumber: string;
            };
            id: string;
            customerId: string;
            createdAt: Date;
            updatedAt: Date;
            sessionId: string | null;
            loginTime: Date;
            logoutTime: Date | null;
            totalDuration: number | null;
            status: string;
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
        };
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
        };
        id: string;
        customerId: string;
        createdAt: Date;
        updatedAt: Date;
        sessionId: string | null;
        loginTime: Date;
        logoutTime: Date | null;
        totalDuration: number | null;
        status: string;
        sectionDurations: string | null;
        activities: string | null;
        userId: string;
    } | null>;
    private formatDuration;
}
