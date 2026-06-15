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

    // Resolve relative logo URL to fully qualified URL
    let resolvedLogoUrl = logoUrl;
    if (logoUrl) {
      if (logoUrl.startsWith('/uploads/')) {
        const basePublicUrl = (
          this.configService.get<string>('R2_PUBLIC_URL') || ''
        ).replace(/\/+$/, '');
        resolvedLogoUrl = basePublicUrl
          ? `${basePublicUrl}${logoUrl}`
          : `http://localhost:8080${logoUrl}`;
      } else if (logoUrl.startsWith('/')) {
        resolvedLogoUrl = `http://localhost:8080${logoUrl}`;
      }
    }

    // Color theme matching the boutique style: warm terracotta (#9C5E43), light warm background (#FAF8F6)
    const primaryColor = '#9C5E43';
    const secondaryColor = '#FAF8F6';
    const textColor = '#403934';
    const mutedTextColor = '#8C827A';
    const borderColor = '#F4EFEA';

    // Logo display: if resolvedLogoUrl is present, render image; otherwise fallback to stylish text
    const logoHtml = resolvedLogoUrl
      ? `<img src="${resolvedLogoUrl}" alt="${businessName}" style="max-height: 48px; max-width: 200px; display: block; margin: 0 auto; object-fit: contain;" />`
      : `<div style="font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: 2px; text-transform: uppercase; margin: 0;">${businessName.toUpperCase()}</div>`;

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
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px; background-color: #ffffff; border: 1px solid ${borderColor}; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(156, 94, 67, 0.03);">
                <!-- Header Banner -->
                <tr>
                  <td align="center" style="background-color: ${primaryColor}; padding: 32px 20px; position: relative;">
                    ${logoHtml}
                    <div style="font-size: 10px; font-weight: 600; color: rgba(255, 255, 255, 0.75); letter-spacing: 1px; text-transform: uppercase; margin-top: 4px;">Wholesale Partner Portal</div>
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
  ) {
    let businessName = 'Little Souls';
    try {
      const settings = await this.prisma.setting.findFirst();
      if (settings?.businessName) {
        businessName = settings.businessName;
      }
    } catch {}

    const subject = `Welcome to ${businessName} Wholesale! Your Login Credentials`;
    const content = `
      <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #403934; line-height: 26px;">Welcome to ${businessName} Wholesale, ${name}!</h2>
      <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 22px; color: #403934;">Your partner account application has been <strong style="color: #9C5E43;">approved</strong> by our admin team.</p>
      <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 22px; color: #8C827A;">You can now log in to the B2B portal to view pricing, place orders, and manage your ledger.</p>
      
      <div style="background-color: #FAF8F6; border: 1px solid #F4EFEA; padding: 20px; border-radius: 12px; margin: 24px 0; font-size: 13px; line-height: 20px; color: #403934;">
        <p style="margin: 0 0 10px 0;"><strong>Login URL:</strong> <a href="http://localhost:8080/login" style="color: #9C5E43; font-weight: 600; text-decoration: none;">http://localhost:8080/login</a></p>
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

    const subject = `Welcome to ${businessName}! Your Staff Login Credentials`;
    const content = `
      <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #403934; line-height: 26px;">Welcome to the ${businessName} Team, ${name}!</h2>
      <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 22px; color: #403934;">Your staff account has been created by the administrator.</p>
      <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 22px; color: #8C827A;">You can now log in to the Admin Panel to access your assigned modules.</p>
      
      <div style="background-color: #FAF8F6; border: 1px solid #F4EFEA; padding: 20px; border-radius: 12px; margin: 24px 0; font-size: 13px; line-height: 20px; color: #403934;">
        <p style="margin: 0 0 10px 0;"><strong>Admin Login URL:</strong> <a href="http://localhost:8080/admin" style="color: #9C5E43; font-weight: 600; text-decoration: none;">http://localhost:8080/admin</a></p>
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
