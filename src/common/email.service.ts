import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    // We only need the email and password if we are using standard services like Gmail
    if (user && pass) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user,
          pass,
        },
      });
      this.logger.log('SMTP configured for email sending via Gmail.');
    } else {
      this.logger.warn(
        'SMTP credentials not fully configured. Emails will be logged to console instead of sending.',
      );
      this.transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
      });
    }
  }

  private async getEmailTemplate(contentHtml: string): Promise<string> {
    let settings: any = null;
    try {
      settings = await this.prisma.setting.findFirst();
    } catch (err) {
      this.logger.error('Failed to fetch settings for email template', err);
    }

    const businessName = settings?.businessName || 'Little Souls';
    const logoUrl = settings?.businessLogoUrl || '';
    const contactEmail = settings?.contactEmail || 'support@littlesouls.com';
    const contactPhone = settings?.contactPhone || '';
    const companyAddress = settings?.companyAddress || '';

    const frontendUrl = (
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000'
    ).replace(/\/+$/, '');

    // Resolve relative logo URL to fully qualified URL
    let resolvedLogoUrl = logoUrl;
    if (logoUrl) {
      if (logoUrl.startsWith('/uploads/')) {
        const basePublicUrl = (
          this.configService.get<string>('R2_PUBLIC_URL') || ''
        ).replace(/\/+$/, '');
        resolvedLogoUrl = basePublicUrl
          ? `${basePublicUrl}${logoUrl}`
          : `${frontendUrl}${logoUrl}`;
      } else if (logoUrl.startsWith('/')) {
        resolvedLogoUrl = `${frontendUrl}${logoUrl}`;
      }
    }

    // Color theme matching the boutique style: warm terracotta (#9C5E43), light warm background (#FAF8F6)
    const primaryColor = '#9C5E43';
    const secondaryColor = '#FAF8F6';
    const textColor = '#403934';
    const mutedTextColor = '#8C827A';
    const borderColor = '#F4EFEA';

    // Logo display: if resolvedLogoUrl is valid HTTP/HTTPS and not broken localhost, render image; otherwise fallback to stylish typography logo
    const logoHtml = (resolvedLogoUrl && resolvedLogoUrl.startsWith('http') && !resolvedLogoUrl.includes('localhost'))
      ? `<img src="${resolvedLogoUrl}" alt="${businessName}" style="max-height: 48px; max-width: 220px; display: block; margin: 0 auto; object-fit: contain;" />`
      : `<div style="font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: 2px; text-transform: uppercase; font-family: 'Helvetica Neue', Arial, sans-serif; text-align: center; margin: 0;">${businessName}</div>`;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${businessName}</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: ${secondaryColor}; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${secondaryColor}; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; background-color: #ffffff; border: 1px solid ${borderColor}; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(156, 94, 67, 0.03);">
                <!-- Header Banner -->
                <tr>
                  <td align="center" style="background-color: ${primaryColor}; padding: 32px 20px; position: relative;">
                    ${logoHtml}
                    <div style="font-size: 10px; font-weight: 600; color: rgba(255, 255, 255, 0.85); letter-spacing: 1.5px; text-transform: uppercase; margin-top: 6px;">Wholesale Partner Portal</div>
                  </td>
                </tr>
                <!-- Content Body -->
                <tr>
                  <td style="padding: 40px 30px; color: ${textColor}; font-size: 14px; line-height: 22px;">
                    ${contentHtml}
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td align="center" style="padding: 24px 30px; background-color: ${secondaryColor}; border-top: 1px solid ${borderColor}; color: ${mutedTextColor}; font-size: 11px; font-weight: 500; line-height: 16px;">
                    <p style="margin: 0;">This is an automated notification from ${businessName}.</p>
                    ${companyAddress ? `<p style="margin: 4px 0 0 0;">${companyAddress}</p>` : ''}
                    ${contactEmail || contactPhone ? `<p style="margin: 4px 0 0 0;">Contact: ${contactEmail}${contactPhone ? ` | ${contactPhone}` : ''}</p>` : ''}
                    <p style="margin: 8px 0 0 0;">&copy; ${new Date().getFullYear()} ${businessName}. All rights reserved.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  async sendCustomerCredentials(
    email: string,
    name: string,
    plainPassword: string,
    details?: {
      businessName?: string | null;
      gstin?: string | null;
      mobile?: string | null;
      customerCode?: string | null;
    },
  ) {
    let businessName = 'Little Souls';
    try {
      const settings = await this.prisma.setting.findFirst();
      if (settings?.businessName) {
        businessName = settings.businessName;
      }
    } catch {}

    const frontendUrl = (
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000'
    ).replace(/\/+$/, '');

    const loginUrl = `${frontendUrl}/login`;
    const partnerBusiness = details?.businessName || businessName;
    const gstinStr = details?.gstin || 'Not Provided (Optional)';
    const codeStr = details?.customerCode || 'Registered';

    const subject = `Welcome to ${businessName} Wholesale! Your Account Credentials`;
    const content = `
      <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #403934; line-height: 26px;">Welcome to ${businessName} Wholesale, ${name}!</h2>
      <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 22px; color: #403934;">Your partner account application for <strong>${partnerBusiness}</strong> has been <strong style="color: #9C5E43;">APPROVED</strong> by our admin team.</p>
      <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 22px; color: #8C827A;">You can now log in to the B2B portal to browse our wholesale collection, view special tier pricing, and manage your account ledger.</p>
      
      <div style="background-color: #FAF8F6; border: 1px solid #F4EFEA; padding: 20px 24px; border-radius: 12px; margin: 24px 0; font-size: 13px; line-height: 22px; color: #403934;">
        <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 700; color: #9C5E43; border-bottom: 1px solid #F4EFEA; padding-bottom: 8px;">Account Details & Credentials</h3>
        
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px; color: #403934;">
          <tr>
            <td style="padding: 4px 0; font-weight: 600; width: 140px;">Business Name:</td>
            <td style="padding: 4px 0;">${partnerBusiness}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: 600;">Customer Code:</td>
            <td style="padding: 4px 0;"><span style="background: #EFEBE7; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 12px; font-weight: 700; color: #403934;">${codeStr}</span></td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: 600;">GSTIN Number:</td>
            <td style="padding: 4px 0;">${gstinStr}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: 600;">Email (Login ID):</td>
            <td style="padding: 4px 0;"><a href="mailto:${email}" style="color: #9C5E43; text-decoration: none; font-weight: 600;">${email}</a></td>
          </tr>
          ${details?.mobile ? `
          <tr>
            <td style="padding: 4px 0; font-weight: 600;">Registered Mobile:</td>
            <td style="padding: 4px 0;">${details.mobile}</td>
          </tr>` : ''}
          <tr>
            <td style="padding: 6px 0 4px 0; font-weight: 600;">Temporary Password:</td>
            <td style="padding: 6px 0 4px 0;"><code style="background: #ffffff; border: 1px solid #E2D9D2; padding: 4px 10px; border-radius: 6px; font-family: monospace; font-size: 14px; color: #9C5E43; font-weight: 700; letter-spacing: 0.5px;">${plainPassword}</code></td>
          </tr>
          <tr>
            <td style="padding: 6px 0 4px 0; font-weight: 600;">Login Portal:</td>
            <td style="padding: 6px 0 4px 0;"><a href="${loginUrl}" style="color: #9C5E43; font-weight: 600; text-decoration: underline;">${loginUrl}</a></td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin: 28px 0 20px 0;">
        <a href="${loginUrl}" style="display: inline-block; background-color: #9C5E43; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 10px; font-weight: 700; font-size: 14px; box-shadow: 0 3px 8px rgba(156, 94, 67, 0.25);">Login to Partner Portal &rarr;</a>
      </div>

      <p style="margin: 0 0 8px 0; font-size: 13px; line-height: 20px; color: #8C827A;">For security purposes, please change your temporary password immediately upon your first login.</p>
    `;
    const html = await this.getEmailTemplate(content);

    try {
      const fromEmail =
        this.configService.get<string>('SMTP_USER') || 'admin@littlesouls.com';
      const info = await this.transporter.sendMail({
        from: `"${businessName} Admin" <${fromEmail}>`,
        to: email,
        subject,
        html,
      });

      if (!this.configService.get<string>('SMTP_USER')) {
        this.logger.log(
          `\n\n--- MOCK EMAIL SENT TO ${email} ---\nSubject: ${subject}\nPassword generated: ${plainPassword}\n-----------------------------------\n`,
        );
      } else {
        this.logger.log(
          `Email successfully sent to ${email}. Message ID: ${info.messageId}`,
        );
      }
    } catch (error: any) {
      this.logger.error(`Failed to send email to ${email}: ${error.message}`);
      throw error;
    }
  }

  async sendStaffCredentials(
    email: string,
    name: string,
    employeeCode: string,
    plainPassword: string,
  ) {
    let businessName = 'Little Souls';
    try {
      const settings = await this.prisma.setting.findFirst();
      if (settings?.businessName) {
        businessName = settings.businessName;
      }
    } catch {}

    const frontendUrl = (
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000'
    ).replace(/\/+$/, '');
    const adminUrl = `${frontendUrl}/admin`;

    const subject = `Welcome to ${businessName}! Your Staff Login Credentials`;
    const content = `
      <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #403934; line-height: 26px;">Welcome to the ${businessName} Team, ${name}!</h2>
      <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 22px; color: #403934;">Your staff account has been created by the administrator.</p>
      <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 22px; color: #8C827A;">You can now log in to the Admin Panel to access your assigned modules.</p>
      
      <div style="background-color: #FAF8F6; border: 1px solid #F4EFEA; padding: 20px; border-radius: 12px; margin: 24px 0; font-size: 13px; line-height: 20px; color: #403934;">
        <p style="margin: 0 0 10px 0;"><strong>Admin Login URL:</strong> <a href="${adminUrl}" style="color: #9C5E43; font-weight: 600; text-decoration: underline;">${adminUrl}</a></p>
        <p style="margin: 0 0 10px 0;"><strong>Employee Code:</strong> ${employeeCode}</p>
        <p style="margin: 0 0 10px 0;"><strong>Email Address:</strong> ${email}</p>
        <p style="margin: 0;"><strong>Temporary Password:</strong> <code style="background: #ffffff; border: 1px solid #F4EFEA; padding: 4px 8px; border-radius: 6px; font-family: monospace; font-size: 13px; color: #9C5E43; font-weight: 600;">${plainPassword}</code></p>
      </div>

      <p style="margin: 0 0 8px 0; font-size: 13px; line-height: 20px; color: #8C827A;">We highly recommend changing your password immediately after your first login.</p>
    `;
    const html = await this.getEmailTemplate(content);

    try {
      const fromEmail =
        this.configService.get<string>('SMTP_USER') || 'admin@littlesouls.com';
      const info = await this.transporter.sendMail({
        from: `"${businessName} System" <${fromEmail}>`,
        to: email,
        subject,
        html,
      });

      if (!this.configService.get<string>('SMTP_USER')) {
        this.logger.log(
          `\n\n--- MOCK STAFF EMAIL SENT TO ${email} ---\nSubject: ${subject}\nPassword generated: ${plainPassword}\n-----------------------------------\n`,
        );
      } else {
        this.logger.log(
          `Staff Email successfully sent to ${email}. Message ID: ${info.messageId}`,
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to send staff email to ${email}: ${error.message}`,
      );
      throw error;
    }
  }

  async sendPasswordResetOTP(email: string, otp: string) {
    let businessName = 'Little Souls';
    try {
      const settings = await this.prisma.setting.findFirst();
      if (settings?.businessName) {
        businessName = settings.businessName;
      }
    } catch {}

    const subject = `Password Reset Code - ${businessName}`;
    const content = `
      <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #403934; line-height: 26px;">Password Reset Request</h2>
      <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 22px; color: #403934;">We received a request to reset your password. Use the verification code below to proceed:</p>
      
      <div style="background-color: #FAF8F6; border: 1px solid #F4EFEA; padding: 24px; text-align: center; border-radius: 12px; margin: 24px 0;">
        <h1 style="margin: 0; font-size: 36px; letter-spacing: 6px; color: #9C5E43; font-family: monospace; font-weight: 700;">${otp}</h1>
      </div>

      <p style="margin: 0 0 8px 0; font-size: 13px; line-height: 20px; color: #8C827A;">This verification code will expire in 15 minutes. If you did not make this request, you can safely ignore this email.</p>
    `;
    const html = await this.getEmailTemplate(content);

    try {
      const fromEmail =
        this.configService.get<string>('SMTP_USER') ||
        'support@littlesouls.com';
      const info = await this.transporter.sendMail({
        from: `"${businessName} Support" <${fromEmail}>`,
        to: email,
        subject,
        html,
      });

      if (!this.configService.get<string>('SMTP_USER')) {
        this.logger.log(
          `\n\n--- MOCK OTP EMAIL SENT TO ${email} ---\nSubject: ${subject}\nOTP: ${otp}\n-----------------------------------\n`,
        );
      } else {
        this.logger.log(
          `OTP Email successfully sent to ${email}. Message ID: ${info.messageId}`,
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to send OTP email to ${email}: ${error.message}`,
      );
      throw error;
    }
  }
}
