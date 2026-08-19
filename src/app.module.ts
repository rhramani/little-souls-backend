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
import { SupportModule } from './support/support.module';
import { ConfigModule } from '@nestjs/config';
import { UploadModule } from './upload/upload.module';
import { CustomerModule } from './customer/customer.module';
import { NotificationModule } from './notification/notification.module';
import { CatalogueModule } from './catalogue/catalogue.module';
import { EventsModule } from './events/events.module';
import { CommonModule } from './common/common.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PurchaseModule } from './purchase/purchase.module';

import { ReportModule } from './report/report.module';
import { StockModule } from './stock/stock.module';
import { SettingsModule } from './settings/settings.module';
import { BannerModule } from './banner/banner.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    CategoryModule,
    ProductModule,
    PricingModule,
    CartModule,
    OrderModule,
    BillingModule,
    ImportModule,
    StaffModule,
    SupportModule,
    UploadModule,
    CustomerModule,
    NotificationModule,
    ReportModule,
    StockModule,
    SettingsModule,
    BannerModule,
    CatalogueModule,
    EventsModule,
    CommonModule,
    DashboardModule,
    PurchaseModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
