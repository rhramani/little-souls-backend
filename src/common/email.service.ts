import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
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
      this.logger.warn('SMTP credentials not fully configured. Emails will be logged to console instead of sending.');
      this.transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
      });
    }
  }

  async sendCustomerCredentials(email: string, name: string, plainPassword: string) {
    const subject = 'Welcome to Little Souls Wholesale! Your Login Credentials';
    const html = `
      <div style="font-family: sans-serif; max-w-md; margin: auto;">
        <h2>Welcome to Little Souls Wholesale, ${name}!</h2>
        <p>Your partner account application has been <strong>approved</strong> by our admin team.</p>
        <p>You can now log in to the B2B portal to view pricing, place orders, and manage your ledger.</p>
        
        <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 24px 0;">
          <p style="margin: 0 0 8px 0;"><strong>Login URL:</strong> <a href="http://localhost:5173/login">http://localhost:5173/login</a></p>
          <p style="margin: 0 0 8px 0;"><strong>Email Address:</strong> ${email}</p>
          <p style="margin: 0;"><strong>Temporary Password:</strong> <code style="background: #e5e7eb; padding: 4px 8px; border-radius: 4px;">${plainPassword}</code></p>
        </div>

        <p>We highly recommend changing your password after your first login.</p>
        <br/>
        <p>Best regards,<br/>The Little Souls Team</p>
      </div>
    `;

    try {
      const fromEmail = this.configService.get<string>('SMTP_USER') || 'admin@littlesouls.com';
      const info = await this.transporter.sendMail({
        from: `"Little Souls Admin" <${fromEmail}>`,
        to: email,
        subject,
        html,
      });

      if (!this.configService.get<string>('SMTP_USER')) {
        this.logger.log(`\n\n--- MOCK EMAIL SENT TO ${email} ---\nSubject: ${subject}\nPassword generated: ${plainPassword}\n-----------------------------------\n`);
      } else {
        this.logger.log(`Email successfully sent to ${email}. Message ID: ${info.messageId}`);
      }
    } catch (error: any) {
      this.logger.error(`Failed to send email to ${email}: ${error.message}`);
      throw error;
    }
  }

  async sendStaffCredentials(email: string, name: string, employeeCode: string, plainPassword: string) {
    const subject = 'Welcome to Little Souls! Your Staff Login Credentials';
    const html = `
      <div style="font-family: sans-serif; max-w-md; margin: auto;">
        <h2>Welcome to the Little Souls Team, ${name}!</h2>
        <p>Your staff account has been created by the administrator.</p>
        <p>You can now log in to the Admin Panel to access your assigned modules.</p>
        
        <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 24px 0;">
          <p style="margin: 0 0 8px 0;"><strong>Admin Login URL:</strong> <a href="http://localhost:5173/admin">http://localhost:5173/admin</a></p>
          <p style="margin: 0 0 8px 0;"><strong>Employee Code:</strong> ${employeeCode}</p>
          <p style="margin: 0 0 8px 0;"><strong>Email Address:</strong> ${email}</p>
          <p style="margin: 0;"><strong>Temporary Password:</strong> <code style="background: #e5e7eb; padding: 4px 8px; border-radius: 4px;">${plainPassword}</code></p>
        </div>

        <p>We highly recommend changing your password after your first login.</p>
        <br/>
        <p>Best regards,<br/>The Little Souls System</p>
      </div>
    `;

    try {
      const fromEmail = this.configService.get<string>('SMTP_USER') || 'admin@littlesouls.com';
      const info = await this.transporter.sendMail({
        from: `"Little Souls System" <${fromEmail}>`,
        to: email,
        subject,
        html,
      });

      if (!this.configService.get<string>('SMTP_USER')) {
        this.logger.log(`\n\n--- MOCK STAFF EMAIL SENT TO ${email} ---\nSubject: ${subject}\nPassword generated: ${plainPassword}\n-----------------------------------\n`);
      } else {
        this.logger.log(`Staff Email successfully sent to ${email}. Message ID: ${info.messageId}`);
      }
    } catch (error: any) {
      this.logger.error(`Failed to send staff email to ${email}: ${error.message}`);
      throw error;
    }
  }
  async sendPasswordResetOTP(email: string, otp: string) {
    const subject = 'Password Reset Code - Little Souls';
    const html = `
      <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>We received a request to reset your password. Use the verification code below to proceed:</p>
        
        <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 24px 0;">
          <h1 style="margin: 0; font-size: 36px; letter-spacing: 4px; color: #2563eb;">${otp}</h1>
        </div>

        <p style="color: #666; font-size: 14px;">This code will expire in 15 minutes. If you did not request a password reset, you can safely ignore this email.</p>
        <br/>
        <p style="font-size: 14px;">Best regards,<br/>The Little Souls Team</p>
      </div>
    `;

    try {
      const fromEmail = this.configService.get<string>('SMTP_USER') || 'support@littlesouls.com';
      const info = await this.transporter.sendMail({
        from: `"Little Souls Support" <${fromEmail}>`,
        to: email,
        subject,
        html,
      });

      if (!this.configService.get<string>('SMTP_USER')) {
        this.logger.log(`\n\n--- MOCK OTP EMAIL SENT TO ${email} ---\nSubject: ${subject}\nOTP: ${otp}\n-----------------------------------\n`);
      } else {
        this.logger.log(`OTP Email successfully sent to ${email}. Message ID: ${info.messageId}`);
      }
    } catch (error: any) {
      this.logger.error(`Failed to send OTP email to ${email}: ${error.message}`);
      throw error;
    }
  }
}
