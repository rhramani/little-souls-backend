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
      const info = await this.transporter.sendMail({
        from: '"Little Souls Admin" <admin@littlesouls.com>',
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
}
