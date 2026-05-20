import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PdfService } from './pdf.service';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [BillingService, PdfService],
  controllers: [BillingController],
  exports: [BillingService, PdfService],
})
export class BillingModule {}
