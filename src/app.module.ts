import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CategoryModule } from './category/category.module';
import { ProductModule } from './product/product.module';
import { PricingModule } from './pricing/pricing.module';
import { CartModule } from './cart/cart.module';
import { OrderModule } from './order/order.module';
import { BillingModule } from './billing/billing.module';
import { ImportModule } from './import/import.module';
import { StaffModule } from './staff/staff.module';
import { PurchaseOrderModule } from './purchase-order/purchase-order.module';
import { SupportModule } from './support/support.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule, CategoryModule, ProductModule, PricingModule, CartModule, OrderModule, BillingModule, ImportModule, StaffModule, PurchaseOrderModule, SupportModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
