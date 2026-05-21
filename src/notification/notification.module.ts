import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { WhatsappService } from './whatsapp.service';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [HttpModule, ConfigModule, PrismaModule],
  controllers: [NotificationController],
  providers: [WhatsappService, NotificationService],
  exports: [WhatsappService, NotificationService],
})
export class NotificationModule {}
