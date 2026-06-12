import { Module } from '@nestjs/common';
import { CustomerController } from './customer.controller';
import { CustomerMeController } from './customer-me.controller';
import { CustomerService } from './customer.service';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [AuthModule, EventsModule],
  controllers: [CustomerMeController, CustomerController],
  providers: [CustomerService],
})
export class CustomerModule {}
