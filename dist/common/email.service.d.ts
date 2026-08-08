import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
export declare class EmailService {
    private configService;
    private prisma;
    private readonly logger;
    private transporter;
    constructor(configService: ConfigService, prisma: PrismaService);
    private getEmailTemplate;
    sendCustomerCredentials(email: string, name: string, plainPassword: string, details?: {
        businessName?: string | null;
        gstin?: string | null;
        mobile?: string | null;
        customerCode?: string | null;
    }): Promise<void>;
    sendStaffCredentials(email: string, name: string, employeeCode: string, plainPassword: string): Promise<void>;
    sendPasswordResetOTP(email: string, otp: string): Promise<void>;
}
