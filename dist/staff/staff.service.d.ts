import { PrismaService } from '../prisma/prisma.service';
import { AssignCustomerDto } from './dto/assign-customer.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { EmailService } from '../common/email.service';
export declare class StaffService {
    private readonly prisma;
    private readonly emailService;
    constructor(prisma: PrismaService, emailService: EmailService);
    getRoles(): Promise<({
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
    })[]>;
    createRole(data: {
        name: string;
        description?: string;
    }): Promise<{
        name: string;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        isSystemRole: boolean;
    }>;
    updateRole(id: string, data: {
        name?: string;
        description?: string;
    }): Promise<{
        name: string;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        isSystemRole: boolean;
    }>;
    deleteRole(id: string): Promise<{
        name: string;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        isSystemRole: boolean;
    }>;
    updateRolePermissions(roleId: string, permissions: {
        module: string;
        action: string;
        enabled: boolean;
    }[]): Promise<{
        success: boolean;
    }>;
    createStaff(dto: CreateStaffDto): Promise<{
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
    }>;
    findAllStaff(page?: number, limit?: number): Promise<{
        staff: ({
            users: {
                email: string | null;
                mobile: string;
                id: string;
                userType: import("@prisma/client").$Enums.UserType;
                isActive: boolean;
                lastLoginAt: Date | null;
                userRoles: ({
                    role: {
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
            }[];
        } & {
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
        })[];
        meta: {
            total: number;
            activeCount: number;
            disabledCount: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    findOneStaff(staffId: string): Promise<{
        users: {
            email: string | null;
            mobile: string;
            id: string;
            userType: import("@prisma/client").$Enums.UserType;
            isActive: boolean;
            lastLoginAt: Date | null;
            userRoles: ({
                role: {
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
        }[];
    } & {
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
    }>;
    updateStaff(staffId: string, dto: UpdateStaffDto): Promise<{
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
    }>;
    deactivateStaff(staffId: string): Promise<{
        message: string;
    }>;
    activateStaff(staffId: string): Promise<{
        message: string;
    }>;
    deleteStaff(staffId: string): Promise<{
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
    }>;
    assignCustomer(dto: AssignCustomerDto): Promise<{
        assignedSalesStaff: {
            name: string;
            email: string | null;
            id: string;
        } | null;
    } & {
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
    }>;
    getStaffPerformance(salesStaffId: string): Promise<{
        staffId: string;
        name: string;
        employeeCode: string | null;
        designation: string | null;
        department: string | null;
        totalCustomersAssigned: number;
        totalOrdersCount: number;
        totalSalesVolume: number;
        averageOrderValue: number;
        commissionRatePercent: number;
        commissionEarned: number;
    }>;
    getStaffLeaderboard(): Promise<({
        staffId: string;
        name: string;
        employeeCode: string | null;
        designation: string | null;
        department: string | null;
        totalCustomersAssigned: number;
        totalOrdersCount: number;
        totalSalesVolume: number;
        averageOrderValue: number;
        commissionRatePercent: number;
        commissionEarned: number;
    } | null)[]>;
    findAssignedCustomers(salesStaffId: string): Promise<({
        contacts: {
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
        }[];
    } & {
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
    })[]>;
    private autoCheckoutPreviousDays;
    getAttendanceHistory(staffId?: string, startDate?: string, endDate?: string, page?: number, limit?: number): Promise<{
        records: ({
            staff: {
                name: string;
                employeeCode: string;
                designation: string | null;
            };
        } & {
            id: string;
            staffId: string;
            createdAt: Date;
            updatedAt: Date;
            approvedBy: string | null;
            status: string;
            note: string | null;
            attendanceDate: Date;
            checkInTime: Date | null;
            checkOutTime: Date | null;
            totalWorkMinutes: number | null;
            overtimeMinutes: number | null;
        })[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    markAttendanceAdmin(dto: MarkAttendanceDto, approvedById: string): Promise<{
        id: string;
        staffId: string;
        createdAt: Date;
        updatedAt: Date;
        approvedBy: string | null;
        status: string;
        note: string | null;
        attendanceDate: Date;
        checkInTime: Date | null;
        checkOutTime: Date | null;
        totalWorkMinutes: number | null;
        overtimeMinutes: number | null;
    }>;
    checkInAttendance(userId: string, note?: string): Promise<{
        id: string;
        staffId: string;
        createdAt: Date;
        updatedAt: Date;
        approvedBy: string | null;
        status: string;
        note: string | null;
        attendanceDate: Date;
        checkInTime: Date | null;
        checkOutTime: Date | null;
        totalWorkMinutes: number | null;
        overtimeMinutes: number | null;
    }>;
    checkOutAttendance(userId: string): Promise<{
        id: string;
        staffId: string;
        createdAt: Date;
        updatedAt: Date;
        approvedBy: string | null;
        status: string;
        note: string | null;
        attendanceDate: Date;
        checkInTime: Date | null;
        checkOutTime: Date | null;
        totalWorkMinutes: number | null;
        overtimeMinutes: number | null;
    }>;
    createLeaveRequest(dto: CreateLeaveRequestDto, userId: string): Promise<{
        id: string;
        staffId: string;
        createdAt: Date;
        updatedAt: Date;
        approvedBy: string | null;
        approvedAt: Date | null;
        status: string;
        startDate: Date;
        endDate: Date;
        reason: string | null;
        leaveType: string;
        totalDays: number;
    }>;
    getLeaveRequests(userId: string, userType: string, page?: number, limit?: number): Promise<{
        requests: ({
            staff: {
                name: string;
                employeeCode: string;
            };
        } & {
            id: string;
            staffId: string;
            createdAt: Date;
            updatedAt: Date;
            approvedBy: string | null;
            approvedAt: Date | null;
            status: string;
            startDate: Date;
            endDate: Date;
            reason: string | null;
            leaveType: string;
            totalDays: number;
        })[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    approveLeave(leaveId: string, userId: string): Promise<{
        id: string;
        staffId: string;
        createdAt: Date;
        updatedAt: Date;
        approvedBy: string | null;
        approvedAt: Date | null;
        status: string;
        startDate: Date;
        endDate: Date;
        reason: string | null;
        leaveType: string;
        totalDays: number;
    }>;
    rejectLeave(leaveId: string, userId: string): Promise<{
        id: string;
        staffId: string;
        createdAt: Date;
        updatedAt: Date;
        approvedBy: string | null;
        approvedAt: Date | null;
        status: string;
        startDate: Date;
        endDate: Date;
        reason: string | null;
        leaveType: string;
        totalDays: number;
    }>;
    getPayrolls(staffId?: string, month?: number, year?: number, page?: number, limit?: number): Promise<{
        payrolls: ({
            staff: {
                name: string;
                employeeCode: string;
                designation: string | null;
            };
        } & {
            id: string;
            staffId: string;
            createdAt: Date;
            updatedAt: Date;
            paymentStatus: string;
            salaryMonth: number;
            salaryYear: number;
            daysWorked: number | null;
            basicSalary: number;
            overtimeAmount: number;
            deductions: number;
            bonus: number;
            payableSalary: number;
            paidAt: Date | null;
            paidBy: string | null;
        })[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    markPayrollPaid(payrollId: string, userId: string): Promise<{
        id: string;
        staffId: string;
        createdAt: Date;
        updatedAt: Date;
        paymentStatus: string;
        salaryMonth: number;
        salaryYear: number;
        daysWorked: number | null;
        basicSalary: number;
        overtimeAmount: number;
        deductions: number;
        bonus: number;
        payableSalary: number;
        paidAt: Date | null;
        paidBy: string | null;
    }>;
    calculatePayroll(staffId: string, salaryMonth: string | number, salaryYear: string | number, userId: string, dto?: any): Promise<{
        id: string;
        staffId: string;
        createdAt: Date;
        updatedAt: Date;
        paymentStatus: string;
        salaryMonth: number;
        salaryYear: number;
        daysWorked: number | null;
        basicSalary: number;
        overtimeAmount: number;
        deductions: number;
        bonus: number;
        payableSalary: number;
        paidAt: Date | null;
        paidBy: string | null;
    }>;
    updatePayroll(id: string, dto: any, userId: string): Promise<{
        id: string;
        staffId: string;
        createdAt: Date;
        updatedAt: Date;
        paymentStatus: string;
        salaryMonth: number;
        salaryYear: number;
        daysWorked: number | null;
        basicSalary: number;
        overtimeAmount: number;
        deductions: number;
        bonus: number;
        payableSalary: number;
        paidAt: Date | null;
        paidBy: string | null;
    }>;
    deletePayroll(id: string): Promise<{
        id: string;
        staffId: string;
        createdAt: Date;
        updatedAt: Date;
        paymentStatus: string;
        salaryMonth: number;
        salaryYear: number;
        daysWorked: number | null;
        basicSalary: number;
        overtimeAmount: number;
        deductions: number;
        bonus: number;
        payableSalary: number;
        paidAt: Date | null;
        paidBy: string | null;
    }>;
}
