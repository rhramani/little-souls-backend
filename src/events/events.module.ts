import { Module, forwardRef } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { CustomerActivityService } from './customer-activity.service';
import { CustomerActivityController } from './customer-activity.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CustomerActivityController],
  providers: [EventsGateway, CustomerActivityService],
  exports: [EventsGateway, CustomerActivityService],
})
export class EventsModule {}
