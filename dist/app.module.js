"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const prisma_module_1 = require("./prisma/prisma.module");
const auth_module_1 = require("./auth/auth.module");
const category_module_1 = require("./category/category.module");
const product_module_1 = require("./product/product.module");
const pricing_module_1 = require("./pricing/pricing.module");
const cart_module_1 = require("./cart/cart.module");
const order_module_1 = require("./order/order.module");
const billing_module_1 = require("./billing/billing.module");
const import_module_1 = require("./import/import.module");
const staff_module_1 = require("./staff/staff.module");
const support_module_1 = require("./support/support.module");
const config_1 = require("@nestjs/config");
const upload_module_1 = require("./upload/upload.module");
const customer_module_1 = require("./customer/customer.module");
const notification_module_1 = require("./notification/notification.module");
const catalogue_module_1 = require("./catalogue/catalogue.module");
const events_module_1 = require("./events/events.module");
const common_module_1 = require("./common/common.module");
const dashboard_module_1 = require("./dashboard/dashboard.module");
const purchase_module_1 = require("./purchase/purchase.module");
const report_module_1 = require("./report/report.module");
const stock_module_1 = require("./stock/stock.module");
const settings_module_1 = require("./settings/settings.module");
const banner_module_1 = require("./banner/banner.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            prisma_module_1.PrismaModule,
            auth_module_1.AuthModule,
            category_module_1.CategoryModule,
            product_module_1.ProductModule,
            pricing_module_1.PricingModule,
            cart_module_1.CartModule,
            order_module_1.OrderModule,
            billing_module_1.BillingModule,
            import_module_1.ImportModule,
            staff_module_1.StaffModule,
            support_module_1.SupportModule,
            upload_module_1.UploadModule,
            customer_module_1.CustomerModule,
            notification_module_1.NotificationModule,
            report_module_1.ReportModule,
            stock_module_1.StockModule,
            settings_module_1.SettingsModule,
            banner_module_1.BannerModule,
            catalogue_module_1.CatalogueModule,
            events_module_1.EventsModule,
            common_module_1.CommonModule,
            dashboard_module_1.DashboardModule,
            purchase_module_1.PurchaseModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map