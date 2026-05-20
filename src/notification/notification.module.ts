import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WhatsappService } from './whatsapp.service';

@Global()
@Module({
  imports: [HttpModule],
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class NotificationModule {}
