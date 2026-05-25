import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { RegisterStaffDto } from './dto/register-staff.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UserType, ApprovalStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async registerStaff(dto: RegisterStaffDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ mobile: dto.mobile }, { email: dto.email }],
      },
    });

    if (existingUser) {
      throw new ConflictException(
        'A user with this email or mobile number already exists',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const result = await this.prisma.$transaction(async (tx) => {
      const staffProfile = await tx.staffProfile.create({
        data: {
          name: dto.name,
          email: dto.email,
          mobile: dto.mobile,
          employeeCode: dto.employeeCode,
          designation: dto.designation || 'Staff',
          department: dto.department || 'General',
        },
      });

      const user = await tx.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          mobile: dto.mobile,
          passwordHash,
          userType: UserType.STAFF,
          isActive: true,
          isVerified: true,
          staffId: staffProfile.id,
        },
      });

      return { user, staffProfile };
    });

    return {
      message: 'Staff registered successfully',
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        userType: result.user.userType,
      },
      staff: result.staffProfile,
    };
  }

  async registerCustomer(dto: RegisterCustomerDto) {
    // 1. Check if user already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { mobile: dto.mobile },
          dto.email ? { email: dto.email } : undefined,
        ].filter(Boolean) as any,
      },
    });

    if (existingUser) {
      throw new ConflictException(
        'A user with this email or mobile number already exists',
      );
    }

    // Check if GSTIN is already registered
    if (dto.gstin) {
      const existingCustomer = await this.prisma.customer.findUnique({
        where: { gstin: dto.gstin },
      });
      if (existingCustomer) {
        throw new ConflictException('GSTIN is already registered');
      }
    }

    // 2. Hash Password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // 3. Perform atomic transaction to create Customer, Contact and User
    const result = await this.prisma.$transaction(async (tx) => {
      // Create Customer
      const customer = await tx.customer.create({
        data: {
          businessName: dto.businessName,
          businessType: dto.businessType,
          gstin: dto.gstin,
          billingAddressLine1: dto.billingAddressLine1,
          billingAddressLine2: dto.billingAddressLine2,
          billingCity: dto.billingCity,
          billingState: dto.billingState,
          billingPincode: dto.billingPincode,
          billingCountry: dto.billingCountry,
          shippingAddressLine1: dto.shippingAddressLine1,
          shippingAddressLine2: dto.shippingAddressLine2,
          shippingCity: dto.shippingCity,
          shippingState: dto.shippingState,
          shippingPincode: dto.shippingPincode,
          shippingCountry: dto.shippingCountry,
          storePhotoUrl: dto.storePhotoUrl,
          customerSource: dto.customerSource,
          mainContactNumber: dto.mobile,
          approvalStatus: ApprovalStatus.PENDING, // Customer needs approval for wholesale rates
          isActive: false, // Inactive until approved
        },
      });

      // Create primary contact
      const contact = await tx.customerContact.create({
        data: {
          customerId: customer.id,
          name: dto.name,
          mobile: dto.mobile,
          email: dto.email,
          loginAccess: true,
          isPrimary: true,
          isActive: true,
          canPlaceOrder: true,
          canViewLedger: true,
          canDownloadInvoice: true,
        },
      });

      // Create user
      const user = await tx.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          mobile: dto.mobile,
          passwordHash,
          userType: UserType.CUSTOMER,
          customerId: customer.id,
          customerContactId: contact.id,
          isActive: true,
          isVerified: false,
        },
      });

      // Generate first user session (only for staff, for customer we wait until approval)
      // We no longer generate a session for customers on registration since they can't login yet
      // return { user, customer, contact };
      return { user, customer, contact, session: null };
    });


    const response = {
      message: 'Customer registered successfully. Approval is pending.',
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        mobile: result.user.mobile,
        userType: result.user.userType,
        isVerified: result.user.isVerified,
      },
      customer: {
        ...result.customer,
        status: result.customer.approvalStatus,
      },
      accessToken: null,
      refreshToken: null,
    };

    // Emit event to all connected clients
    this.eventsGateway.emitCustomerRegistered(response.customer);

    return response;
  }

  async login(dto: LoginDto, userAgent?: string, ipAddress?: string) {
    // 1. Find User by mobile or email
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ mobile: dto.email }, { email: dto.email }],
      },
      include: {
        customer: true,
        customerContact: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid login credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException(
        'Your account has been deactivated. Please contact support.',
      );
    }

    if (user.userType === UserType.CUSTOMER && user.customer?.approvalStatus !== ApprovalStatus.APPROVED) {
      throw new UnauthorizedException('Your account is pending admin approval.');
    }

    // 2. Compare passwords
    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid login credentials');
    }

    // 3. Create UserSession
    const sessionToken = crypto.randomBytes(40).toString('hex');
    const session = await this.prisma.userSession.create({
      data: {
        userId: user.id,
        refreshToken: sessionToken,
        ipAddress,
        userAgent,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    // 4. Update last login timestamp
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // 5. Generate JWT Token
    const payload = {
      sub: user.id,
      email: user.email,
      mobile: user.mobile,
      type: user.userType,
      customerId: user.customerId,
      contactId: user.customerContactId,
      sessionId: session.id,
    };

    const token = this.jwtService.sign(payload);

    return {
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        userType: user.userType,
        isVerified: user.isVerified,
        customerId: user.customerId,
        customerContactId: user.customerContactId,
        customerApprovalStatus: user.customer?.approvalStatus,
      },
      accessToken: token,
      refreshToken: sessionToken,
    };
  }

  async logout(userId: string, sessionId?: string) {
    if (sessionId) {
      await this.prisma.userSession.update({
        where: { id: sessionId },
        data: { revokedAt: new Date() },
      });
    } else {
      // Revoke all active sessions for this user
      await this.prisma.userSession.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    }

    return { message: 'Logged out successfully' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ mobile: dto.identifier }, { email: dto.identifier }],
      },
    });

    if (!user) {
      // To prevent user enumeration, we return success even if user not found,
      // but under the hood, we don't send anything.
      return {
        message:
          'If a matching account exists, a password reset link has been generated.',
      };
    }

    // Generate numeric 6-digit verification code or token
    const token = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins expiry

    // Save/Upsert password reset token
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // Logging token for debugging / local testing so user can see it!
    console.log(`[AUTH] Password reset code for ${dto.identifier}: ${token}`);

    return {
      message:
        'If a matching account exists, a password reset link/code has been sent.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const resetRecord = await this.prisma.passwordResetToken.findFirst({
      where: {
        token: dto.token,
        usedAt: null,
        expiresAt: { gte: new Date() },
      },
    });

    if (!resetRecord) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { message: 'Password has been reset successfully' };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        userType: true,
        isActive: true,
        isVerified: true,
        lastLoginAt: true,
        createdAt: true,
        customer: true,
        customerContact: true,
        staff: true,
        userRoles: {
          select: {
            role: {
              select: {
                name: true,
                rolePermissions: {
                  select: {
                    permission: {
                      select: {
                        module: true,
                        action: true,
                        description: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    return {
      ...user,
      role: user.userType,
    };
  }

  async sendOtp(mobile: string) {
    const user = await this.prisma.user.findFirst({
      where: { mobile },
    });

    if (!user) {
      throw new NotFoundException('No account found with this mobile number.');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive.');
    }

    // Mocking OTP sending
    console.log(`[AUTH] Mock OTP for ${mobile} is 123456`);

    return {
      message: 'OTP sent successfully to your mobile number.',
    };
  }

  async verifyOtp(mobile: string, otp: string, userAgent?: string, ipAddress?: string) {
    if (otp !== '123456') {
      throw new BadRequestException('Invalid OTP.');
    }

    const user = await this.prisma.user.findFirst({
      where: { mobile },
      include: {
        customer: true,
        customerContact: true,
      },
    });

    if (!user) {
      throw new NotFoundException('No account found with this mobile number.');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Your account has been deactivated.');
    }

    if (user.userType === UserType.CUSTOMER && user.customer?.approvalStatus !== ApprovalStatus.APPROVED) {
      throw new UnauthorizedException('Your account is pending admin approval.');
    }

    // Create session & JWT just like login
    const sessionToken = crypto.randomBytes(40).toString('hex');
    const session = await this.prisma.userSession.create({
      data: {
        userId: user.id,
        refreshToken: sessionToken,
        ipAddress,
        userAgent,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const payload = {
      sub: user.id,
      email: user.email,
      mobile: user.mobile,
      type: user.userType,
      customerId: user.customerId,
      contactId: user.customerContactId,
      sessionId: session.id,
    };

    const token = this.jwtService.sign(payload);

    return {
      message: 'OTP verified successfully. Logged in.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        userType: user.userType,
        isVerified: user.isVerified,
        customerId: user.customerId,
        customerContactId: user.customerContactId,
        customerApprovalStatus: user.customer?.approvalStatus,
      },
      accessToken: token,
      refreshToken: sessionToken,
    };
  }

  async refreshToken(refreshToken: string, ipAddress?: string, userAgent?: string) {
    const session = await this.prisma.userSession.findFirst({
      where: {
        refreshToken,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!session || !session.user.isActive) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Revoke old session
    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    // Create new session
    const newRefreshToken = crypto.randomBytes(40).toString('hex');
    const newSession = await this.prisma.userSession.create({
      data: {
        userId: session.userId,
        refreshToken: newRefreshToken,
        ipAddress,
        userAgent,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    const payload = {
      sub: session.user.id,
      email: session.user.email,
      mobile: session.user.mobile,
      type: session.user.userType,
      customerId: session.user.customerId,
      contactId: session.user.customerContactId,
      sessionId: newSession.id,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }
}
