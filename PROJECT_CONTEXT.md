# Little Souls Backend — Full Project Context

> **Purpose of this document**: A complete, self-contained context file for AI models, developers, and collaborators joining this project. Read this before touching any code.

---

## 1. Project Overview

**Little Souls** is a B2B wholesale clothing/product brand. This repository (`little-souls-backend`) is the **NestJS REST API backend** that powers:

- A **B2B Customer Website** (Next.js — separate repo)
- A **Customer Mobile App** (React Native — separate repo)
- A **Staff / Admin Panel** (separate frontend repo)

The backend is the single source of truth for all business logic: pricing, orders, invoices, inventory, attendance, payroll, and more.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (v24+) |
| Framework | NestJS v11 |
| Language | TypeScript v5.7 |
| ORM | Prisma v7 (`@prisma/adapter-pg`) |
| Database | PostgreSQL (via `pg` adapter) |
| Auth | JWT + Passport (`passport-jwt`) |
| File Storage | AWS S3 (`@aws-sdk/client-s3` + presigned URLs) |
| PDF Generation | PDFKit |
| Excel | ExcelJS |
| HTTP Client | Axios (`@nestjs/axios`) |
| Validation | `class-validator` + `class-transformer` |
| Hashing | bcrypt |
| Testing | Jest + Supertest |
| Linting | ESLint + Prettier |

**Run commands:**
```bash
npm run start:dev   # development (watch mode)
npm run start:prod  # production (node dist/main)
npm run build       # compile TypeScript
npm run test        # unit tests
npm run test:api    # Postman API tests (Newman)
```

**API Global Prefix:** All routes are prefixed with `/api` (e.g., `/api/auth/login`).

**Default Port:** `3000` (overridable via `PORT` env variable).

---

## 3. Project Directory Structure

```
little-souls-backend/
├── prisma/
│   ├── schema.prisma          # Full database schema (1076 lines, 30+ models)
│   └── migrations/            # Prisma migration history
├── scripts/
│   ├── rebuild-postman.js     # Utility to rebuild Postman collection
│   ├── update-postman.js      # Utility to update Postman collection
│   └── inject-postman-tests.js
├── src/
│   ├── main.ts                # App entry point (bootstrap, CORS, global prefix, validation pipe)
│   ├── app.module.ts          # Root module (imports all feature modules)
│   ├── app.controller.ts      # Health check controller
│   ├── app.service.ts
│   ├── prisma/                # PrismaModule + PrismaService (singleton DB client)
│   ├── auth/                  # Authentication & session management
│   ├── customer/              # Customer approval management (staff-facing)
│   ├── category/              # Product categories (hierarchical)
│   ├── product/               # Product catalog management
│   ├── pricing/               # Pricing groups + per-product pricing
│   ├── cart/                  # Shopping cart (B2B customer)
│   ├── order/                 # Order lifecycle + packing + shipping
│   ├── billing/               # Invoices, payments, ledger, credit/debit notes
│   ├── import/                # Bulk Excel catalog import/export
│   ├── upload/                # S3 file upload (presigned URLs + direct)
│   ├── image-cleaning/        # Background removal API integration
│   ├── staff/                 # Staff management, attendance, payroll
│   ├── purchase-order/        # Supplier management + purchase orders
│   ├── notification/          # WhatsApp notification service
│   ├── support/               # Support ticket system
│   ├── report/                # Sales, outstanding, attendance reports
│   └── common/
│       └── interceptors/
│           └── audit-log.interceptor.ts  # Global audit logging
├── Little-Souls-B2B.postman_collection.json  # Full Postman test suite
├── API_TESTING_FLOW.md
├── DAILY_REPORT_SHEET.md
├── Little Souls Wholesale System Master Build Plan.md
└── package.json
```

---

## 4. Business Rules (Critical)

1. **QuickSell was the original catalog source** — product data comes from Excel bulk import (round-trip editing: export → edit → re-import).
2. **Customers NEVER see pricing group names** — pricing is served transparently based on which `pricingGroup` the customer belongs to.
3. **Every employee gets a separate login** — no shared admin accounts.
4. **Backend controls all permissions** — frontend never enforces permissions.
5. **Negative stock is NEVER silent** — shortage and backorder must always be visible.
6. **One business (Customer) can have multiple contact persons** — pricing, ledger, orders are at the business level, not the contact level.

---

## 5. User Types & Auth

### User Types (enum `UserType`)
| Type | Description |
|---|---|
| `CUSTOMER` | B2B buyer (linked to a `Customer` business account) |
| `STAFF` | Internal team member (sales, packing, accounts, etc.) |
| `SUPER_ADMIN` | Full access to everything |

### Auth Flow
- **Register Customer**: `POST /api/auth/register-customer` — creates a `User` (type=CUSTOMER) + `Customer` with `approvalStatus=PENDING`
- **Register Staff**: `POST /api/auth/register-staff` — creates a `User` (type=STAFF) + `StaffProfile`
- **Login**: `POST /api/auth/login` — returns JWT access token + refresh token stored in `UserSession`
- **OTP Login**: `POST /api/auth/otp/send` + `POST /api/auth/otp/verify`
- **Logout**: `POST /api/auth/logout` — revokes the `UserSession`
- **Forgot/Reset Password**: `POST /api/auth/forgot-password` + `POST /api/auth/reset-password`
- **Profile**: `GET /api/auth/profile`

### Guards
- `JwtAuthGuard` — requires a valid Bearer token
- `OptionalJwtAuthGuard` — attaches user if token present, but allows unauthenticated access
- `RolesGuard` — checks `@Roles(UserType.X)` decorator against JWT payload
- `@GetUser()` decorator — extracts user from request

### JWT Payload shape (what's available in `@GetUser()`)
```typescript
{
  id: string;          // User UUID
  userType: UserType;
  customerId?: string;   // Only for CUSTOMER type
  contactId?: string;    // Only for CUSTOMER type (contact person)
  staffId?: string;      // Only for STAFF type
  sessionId?: string;
}
```

---

## 6. Database Schema Summary

> Full schema: `prisma/schema.prisma` (1076 lines)

### Enums
| Enum | Values |
|---|---|
| `UserType` | `CUSTOMER`, `STAFF`, `SUPER_ADMIN` |
| `ApprovalStatus` | `PENDING`, `APPROVED`, `REJECTED` |
| `StockStatus` | `IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`, `SHORTAGE`, `BACKORDER` |
| `ImageCleaningStatus` | `NOT_REQUIRED`, `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED` |

### Core Models

#### Auth & Users
| Model | Table | Key Fields |
|---|---|---|
| `User` | `users` | `id`, `name`, `email`, `mobile`, `passwordHash`, `userType`, `customerId`, `customerContactId`, `staffId` |
| `PasswordResetToken` | `password_reset_tokens` | `userId`, `token`, `expiresAt`, `usedAt` |
| `UserSession` | `user_sessions` | `userId`, `refreshToken`, `ipAddress`, `expiresAt`, `revokedAt` |
| `Role` | `roles` | `name`, `isSystemRole` |
| `Permission` | `permissions` | `module`, `action` |
| `RolePermission` | `role_permissions` | `roleId`, `permissionId` |
| `UserRole` | `user_roles` | `userId`, `roleId` |

#### Customers
| Model | Table | Key Fields |
|---|---|---|
| `Customer` | `customers` | `id`, `customerCode`, `businessName`, `gstin`, `billingAddress*`, `shippingAddress*`, `pricingGroupId`, `approvalStatus`, `creditLimit`, `currentBalance` |
| `CustomerContact` | `customer_contacts` | `customerId`, `name`, `mobile`, `loginAccess`, `isPrimary`, `canPlaceOrder`, `canViewLedger`, `canDownloadInvoice` |
| `PricingGroup` | `pricing_groups` | `name`, `code`, `isActive` |

#### Products
| Model | Table | Key Fields |
|---|---|---|
| `Category` | `categories` | `name`, `slug`, `parentCategoryId` (self-relation), `isActive`, `sortOrder` |
| `Product` | `products` | `sku`, `name`, `slug`, `categoryId`, `moq`, `stockQuantity`, `stockStatus`, `allowBackorder`, `taxPercent`, `hsnCode` |
| `ProductImage` | `product_images` | `productId`, `originalUrl`, `cleanedUrl`, `thumbnailUrl`, `isPrimary`, `cleaningStatus` |
| `ProductPricing` | `product_pricing` | `productId`, `pricingGroupId`, `price`, `mrp`, `discountPercent`, `minQuantity`, `maxQuantity` — unique per `(productId, pricingGroupId)` |
| `ProductCatalogFile` | `product_catalog_files` | `productId`, `fileType` (JPG/PDF), `fileUrl`, `title` |
| `ProductVideo` | `product_videos` | `productId`, `videoUrl`, `videoType` (PRODUCT_VIDEO / SHORT_DEMO_VIDEO) |
| `Banner` | `banners` | `title`, `bannerType` (HERO/CATEGORY/PROMO/WEB_HEADER/MOBILE), `linkType`, `imageUrl` |
| `ImageCleaningTask` | `image_cleaning_tasks` | `productImageId`, `provider`, `status`, `cleanedUrl` |
| `CatalogImport` | `catalog_imports` | `fileUrl`, `importType`, `status`, `totalRows`, `successRows`, `failedRows` |
| `CatalogImportRow` | `catalog_import_rows` | `catalogImportId`, `rowNumber`, `sku`, `status`, `errorMessage` |

#### Cart & Orders
| Model | Table | Key Fields |
|---|---|---|
| `Cart` | `carts` | `customerId`, `customerContactId`, `status` (ACTIVE/CONVERTED/ABANDONED) |
| `CartItem` | `cart_items` | `cartId`, `productId`, `quantity`, `price`, `lineTotal` |
| `Order` | `orders` | `orderNumber`, `customerId`, `orderStatus`, `orderSource`, `grandTotal`, `paymentStatus` |
| `OrderItem` | `order_items` | `orderId`, `productId`, `sku`, `quantity`, `moq`, `availableStock`, `shortageQuantity`, `backorderQuantity`, `fulfillmentStatus` |
| `OrderStatusHistory` | `order_status_history` | `orderId`, `oldStatus`, `newStatus`, `changedBy` |
| `BackorderApproval` | `backorder_approvals` | `orderId`, `orderItemId`, `requestedQuantity`, `shortageQuantity`, `approvalStatus` |
| `PackingSlip` | `packing_slips` | `orderId`, `packingSlipNumber`, `packedBy`, `status` |
| `Shipment` | `shipments` | `orderId`, `courierName`, `trackingNumber`, `shipmentStatus` |

#### Billing & Finance
| Model | Table | Key Fields |
|---|---|---|
| `Invoice` | `invoices` | `invoiceNumber`, `orderId`, `customerId`, `grandTotal`, `paymentStatus`, `status` (DRAFT/GENERATED/SENT/CANCELLED) |
| `InvoiceItem` | `invoice_items` | `invoiceId`, `productId`, `sku`, `quantity`, `price`, `taxPercent` |
| `Payment` | `payments` | `customerId`, `paymentNumber`, `amount`, `paymentMode` (CASH/UPI/BANK_TRANSFER/CHEQUE/OTHER), `paymentStatus` (PENDING/VERIFIED/REJECTED) |
| `LedgerEntry` | `ledger_entries` | `customerId`, `entryDate`, `entryType`, `debit`, `credit`, `balanceAfterEntry` |
| `CreditDebitNote` | `credit_debit_notes` | `customerId`, `noteNumber`, `noteType` (CREDIT_NOTE/DEBIT_NOTE), `amount` |

#### Purchase & Stock
| Model | Table | Key Fields |
|---|---|---|
| `Supplier` | `suppliers` | `name`, `mobile`, `email`, `gstin` |
| `PurchaseOrder` | `purchase_orders` | `poNumber`, `supplierId`, `status` (DRAFT/SENT/RECEIVED/CANCELLED), `grandTotal` |
| `PurchaseOrderItem` | `purchase_order_items` | `purchaseOrderId`, `productId`, `quantity`, `costPrice`, `taxPercent` |
| `StockMovement` | `stock_movements` | `productId`, `movementType` (OPENING/PURCHASE_IN/ORDER_OUT/RETURN_IN/ADJUSTMENT_IN/ADJUSTMENT_OUT), `quantity`, `stockBefore`, `stockAfter` |

#### Staff
| Model | Table | Key Fields |
|---|---|---|
| `StaffProfile` | `staff_profiles` | `employeeCode`, `name`, `designation`, `department`, `joiningDate`, `salary` |
| `AttendanceRecord` | `attendance_records` | `staffId`, `attendanceDate`, `status` (PRESENT/ABSENT/HALF_DAY/LEAVE), `checkInTime`, `checkOutTime`, `overtimeMinutes` |
| `LeaveRequest` | `leave_requests` | `staffId`, `leaveType` (CASUAL/SICK/PAID/UNPAID), `startDate`, `endDate`, `totalDays`, `status` |
| `Payroll` | `payrolls` | `staffId`, `salaryMonth`, `salaryYear`, `basicSalary`, `overtimeAmount`, `deductions`, `bonus`, `payableSalary`, `paymentStatus` |

#### System
| Model | Table | Key Fields |
|---|---|---|
| `Notification` | `notifications` | `userId`, `title`, `message`, `notificationType`, `isRead` |
| `SupportTicket` | `support_tickets` | `ticketNumber`, `customerId`, `subject`, `status` (OPEN/IN_PROGRESS/RESOLVED/CLOSED), `priority` (LOW/MEDIUM/HIGH) |
| `SavedReport` | `saved_reports` | `reportName`, `reportType`, `filters` |
| `Setting` | `settings` | `businessName`, `orderPrefix`, `invoicePrefix`, `currency`, `taxEnabled`, `lowStockThreshold`, `imageCleaningProvider` |
| `AuditLog` | `audit_logs` | `userId`, `action`, `module`, `referenceId`, `oldData`, `newData` |
| `EventLog` | `event_logs` | `eventName`, `module`, `referenceId`, `payload`, `processed` |

---

## 7. API Endpoints Reference

> Base URL: `http://localhost:3000/api`
> All protected routes require: `Authorization: Bearer <JWT_TOKEN>`

### Auth (`/api/auth`)
| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| POST | `/auth/register-customer` | ❌ | — | Register a new B2B customer (PENDING status) |
| POST | `/auth/register-staff` | ❌ | — | Register staff user |
| POST | `/auth/login` | ❌ | — | Login with mobile/password → returns JWT |
| POST | `/auth/logout` | ✅ | Any | Revoke session |
| POST | `/auth/forgot-password` | ❌ | — | Send password reset token |
| POST | `/auth/reset-password` | ❌ | — | Reset password with token |
| GET | `/auth/profile` | ✅ | Any | Get logged-in user profile |
| POST | `/auth/otp/send` | ❌ | — | Send OTP to mobile number |
| POST | `/auth/otp/verify` | ❌ | — | Verify OTP and get JWT |

### Customer Management (`/api/customer`) — Staff only
| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/customer` | ✅ | SUPER_ADMIN, STAFF | List all customers (with filters) |
| GET | `/customer/:id` | ✅ | SUPER_ADMIN, STAFF | Get single customer |
| PATCH | `/customer/:id/approve` | ✅ | SUPER_ADMIN, STAFF | Approve customer + assign pricing group |
| PATCH | `/customer/:id/reject` | ✅ | SUPER_ADMIN, STAFF | Reject customer with reason |

### Category (`/api/category`)
| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| POST | `/category` | ✅ | SUPER_ADMIN, STAFF | Create category |
| GET | `/category` | ❌/✅ | Optional | List categories (tree structure) |
| GET | `/category/:id` | ❌/✅ | Optional | Get category |
| PATCH | `/category/:id` | ✅ | SUPER_ADMIN, STAFF | Update category |
| DELETE | `/category/:id` | ✅ | SUPER_ADMIN, STAFF | Delete category |

### Product (`/api/product`)
| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| POST | `/product` | ✅ | SUPER_ADMIN, STAFF | Create product |
| GET | `/product` | Optional | — | List products (pricing shown for authenticated customer's group) |
| GET | `/product/:id` | Optional | — | Get product by ID |
| GET | `/product/slug/:slug` | Optional | — | Get product by slug |
| PATCH | `/product/:id` | ✅ | SUPER_ADMIN, STAFF | Update product |
| DELETE | `/product/:id` | ✅ | SUPER_ADMIN, STAFF | Delete product |
| POST | `/product/:id/video` | ✅ | SUPER_ADMIN, STAFF | Add product video |
| POST | `/product/:id/catalog` | ✅ | SUPER_ADMIN, STAFF | Add catalog file (PDF/JPG) |

### Pricing (`/api/pricing`) — Staff only
| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| POST | `/pricing/group` | ✅ | SUPER_ADMIN, STAFF | Create pricing group |
| GET | `/pricing/group` | ✅ | SUPER_ADMIN, STAFF | List pricing groups |
| GET | `/pricing/group/:id` | ✅ | SUPER_ADMIN, STAFF | Get pricing group |
| PATCH | `/pricing/group/:id` | ✅ | SUPER_ADMIN, STAFF | Update pricing group |
| DELETE | `/pricing/group/:id` | ✅ | SUPER_ADMIN, STAFF | Delete pricing group |
| POST | `/pricing/setup` | ✅ | SUPER_ADMIN, STAFF | Set product price for a pricing group |
| DELETE | `/pricing/price/:productId/:pricingGroupId` | ✅ | SUPER_ADMIN, STAFF | Remove product pricing |

### Cart (`/api/cart`) — Customer only
| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/cart` | ✅ | CUSTOMER | Get or create active cart |
| POST | `/cart` | ✅ | CUSTOMER | Add item to cart |
| PATCH | `/cart/item/:id` | ✅ | CUSTOMER | Update cart item quantity |
| DELETE | `/cart/item/:id` | ✅ | CUSTOMER | Remove cart item |
| DELETE | `/cart` | ✅ | CUSTOMER | Clear entire cart |

### Order (`/api/order`)
| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| POST | `/order/checkout` | ✅ | CUSTOMER | Place order from cart |
| GET | `/order` | ✅ | Any | List orders (customers see own, staff see all) |
| GET | `/order/:id` | ✅ | Any | Get order details |
| PATCH | `/order/:id/status` | ✅ | SUPER_ADMIN, STAFF | Update order status |
| POST | `/order/:id/cancel` | ✅ | Any | Cancel order |
| PATCH | `/order/:id/backorder/approve` | ✅ | SUPER_ADMIN, STAFF | Approve backorder |
| POST | `/order/:id/pack` | ✅ | SUPER_ADMIN, STAFF | Create packing slip |
| POST | `/order/:id/ship` | ✅ | SUPER_ADMIN, STAFF | Create shipment |

### Billing (`/api/billing`)
| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| POST | `/billing/invoice/generate/:orderId` | ✅ | SUPER_ADMIN, STAFF | Generate invoice for order |
| GET | `/billing/invoice` | ✅ | Any | List invoices |
| GET | `/billing/invoice/:id` | ✅ | Any | Get invoice |
| GET | `/billing/invoice/:id/pdf` | ✅ | Any | Download invoice as PDF |
| POST | `/billing/payment` | ✅ | Any | Record payment (staff = auto-verified, customer = pending) |
| GET | `/billing/payment` | ✅ | Any | List payments |
| POST | `/billing/payment/:id/verify` | ✅ | SUPER_ADMIN, STAFF | Verify pending payment |
| POST | `/billing/payment/:id/reject` | ✅ | SUPER_ADMIN, STAFF | Reject payment |
| POST | `/billing/ledger/credit-note` | ✅ | SUPER_ADMIN, STAFF | Create credit note |
| POST | `/billing/ledger/debit-note` | ✅ | SUPER_ADMIN, STAFF | Create debit note |
| GET | `/billing/ledger` | ✅ | Any | Get ledger entries |
| GET | `/billing/balance` | ✅ | Any | Get customer balance |

### Upload (`/api/upload`)
| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| POST | `/upload/presign` | ✅ | Any | Get S3 presigned upload URL |
| POST | `/upload` | ✅ | Any | Direct file upload to S3 |

### Import (`/api/import`) — Staff only
| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| POST | `/import` | ✅ | SUPER_ADMIN, STAFF | Start bulk catalog import (Excel) |
| GET | `/import/export` | ✅ | SUPER_ADMIN, STAFF | Export current catalog as Excel |
| GET | `/import` | ✅ | SUPER_ADMIN, STAFF | List all imports |
| GET | `/import/:id` | ✅ | SUPER_ADMIN, STAFF | Get import details + row status |

### Image Cleaning (`/api/image-cleaning`)
| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| POST | `/image-cleaning/submit` | ✅ | SUPER_ADMIN, STAFF | Submit image for background removal |
| POST | `/image-cleaning/webhook` | ❌ | — | Callback from cleaning provider |

### Staff (`/api/staff`) — Staff/Admin
| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| POST | `/staff/assign-customer` | ✅ | SUPER_ADMIN, STAFF | Assign customer to sales staff |
| GET | `/staff/performance` | ✅ | SUPER_ADMIN, STAFF | Get own performance metrics |
| GET | `/staff/performance/:id` | ✅ | SUPER_ADMIN | Get specific staff performance |
| GET | `/staff/leaderboard` | ✅ | SUPER_ADMIN | Staff sales leaderboard |
| GET | `/staff/my-customers` | ✅ | SUPER_ADMIN, STAFF | Get assigned customers |
| POST | `/staff/attendance/check-in` | ✅ | STAFF | Staff check-in |
| POST | `/staff/attendance/check-out` | ✅ | STAFF | Staff check-out |
| POST | `/staff/payroll/calculate/:staffId` | ✅ | SUPER_ADMIN | Calculate monthly payroll |

### Purchase Order (`/api/purchase-order`) — Staff/Admin
| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| POST | `/purchase-order/supplier` | ✅ | SUPER_ADMIN, STAFF | Create supplier |
| GET | `/purchase-order/supplier` | ✅ | SUPER_ADMIN, STAFF | List suppliers |
| GET | `/purchase-order/supplier/:id` | ✅ | SUPER_ADMIN, STAFF | Get supplier |
| PUT | `/purchase-order/supplier/:id` | ✅ | SUPER_ADMIN, STAFF | Update supplier |
| POST | `/purchase-order` | ✅ | SUPER_ADMIN, STAFF | Create purchase order |
| GET | `/purchase-order` | ✅ | SUPER_ADMIN, STAFF | List purchase orders |
| GET | `/purchase-order/:id` | ✅ | SUPER_ADMIN, STAFF | Get purchase order |
| PATCH | `/purchase-order/:id/status` | ✅ | SUPER_ADMIN, STAFF | Transition PO status |

### Support (`/api/support`)
| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| POST | `/support` | ✅ | Any | Create support ticket |
| GET | `/support` | ✅ | Any | List tickets (customers see own) |
| GET | `/support/:id` | ✅ | Any | Get ticket |
| PATCH | `/support/:id/assign` | ✅ | SUPER_ADMIN, STAFF | Assign ticket to staff |
| PATCH | `/support/:id/status` | ✅ | SUPER_ADMIN, STAFF | Update ticket status |
| PATCH | `/support/:id/priority` | ✅ | SUPER_ADMIN, STAFF | Update ticket priority |

### Reports (`/api/report`) — Staff/Admin
| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/report/sales` | ✅ | SUPER_ADMIN, STAFF | Sales report (date range) |
| GET | `/report/outstanding` | ✅ | SUPER_ADMIN, STAFF | Outstanding balances report |
| GET | `/report/attendance` | ✅ | SUPER_ADMIN, STAFF | Staff attendance report (date range) |

---

## 8. Order Lifecycle

```
DRAFT → SUBMITTED → APPROVED → PACKED → SHIPPED → DELIVERED
                  ↘ CANCELLED (at any stage)
```

**Order Source values:** `WEBSITE`, `MOBILE_APP`, `STAFF_PANEL`, `WHATSAPP`

**Payment Status values:** `UNPAID`, `PARTIAL`, `PAID`

**Fulfillment Status (per OrderItem):** `IN_STOCK`, `SHORTAGE`, `BACKORDER`, `PARTIAL_FULFILLMENT`, `FULFILLED`

---

## 9. Key Design Patterns

### Module Structure (NestJS standard)
Each feature module (`auth`, `product`, `order`, etc.) follows:
```
module/
├── module.module.ts     # Module definition + imports
├── module.controller.ts # HTTP route handlers
├── module.service.ts    # Business logic
└── dto/                 # Data Transfer Objects (class-validator)
```

### PrismaService
Located at `src/prisma/prisma.service.ts` — wraps the Prisma client in a NestJS injectable singleton. Always inject `PrismaService` for DB access; do NOT instantiate `PrismaClient` directly.

### Global Audit Log Interceptor
`src/common/interceptors/audit-log.interceptor.ts` is registered globally in `AppModule`. It automatically logs mutating actions to the `AuditLog` table.

### Pricing Access Pattern
- Products are returned with **no price** for unauthenticated users.
- Products return **the customer's group price** when a Customer JWT is provided (via `OptionalJwtAuthGuard`).
- Staff see all prices.

### Customer Scoping Pattern
For list/get routes accessed by both customers and staff:
```typescript
// Customer sees own data, staff see all
const customerId = user.userType === UserType.CUSTOMER ? user.customerId : undefined;
return this.service.findAll(query, customerId);
```

### Payment Verification Logic
- **Staff records payment** → auto-marked `VERIFIED`
- **Customer submits payment proof** → status = `PENDING` (staff must verify)

---

## 10. Environment Variables Required

```env
# Server
PORT=3000

# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# JWT
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

# AWS S3
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_S3_BUCKET=your_bucket_name

# Image Cleaning (optional)
IMAGE_CLEANING_API_KEY=your_api_key

# WhatsApp (optional)
WHATSAPP_API_URL=https://...
WHATSAPP_API_KEY=your_key
```

---

## 11. Coding Conventions

1. **DTOs** use `class-validator` decorators (`@IsString()`, `@IsOptional()`, `@IsEnum()`, etc.)
2. **All IDs** are UUIDs (`@db.Uuid`, `@default(uuid())`)
3. **All timestamps** use snake_case in DB (`created_at`, `updated_at`) mapped via `@map()`
4. **Services** handle all business logic — controllers only extract params and call services
5. **Roles** are enforced via `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(UserType.X)`
6. **Pagination** is handled via query params (`page`, `limit`, `search`, `status`, etc.)
7. **Decimal fields** use Prisma `@db.Decimal(12, 2)` for money and `@db.Decimal(5, 2)` for percentages

---

## 12. Import System (Excel Bulk Catalog)

The `ImportService` handles:
- **Import types:** `PRODUCT_CREATE`, `PRODUCT_UPDATE`, `PRICE_UPDATE`, `STOCK_UPDATE`
- **Excel template:** exported via `GET /api/import/export`
- **Re-upload:** matched by SKU (no duplicates — updates existing)
- **Row-level tracking:** each row in `CatalogImportRow` has `SUCCESS`, `FAILED`, or `SKIPPED` status
- **Error file:** failed rows exported back as error Excel

---

## 13. Image Cleaning System

Integrates with an external background removal API provider:
- Staff submits `ProductImage` ID → `ImageCleaningTask` created
- External provider calls `/api/image-cleaning/webhook` when done
- `ProductImage.cleanedUrl` updated + `cleaningStatus` set to `COMPLETED`
- Provider is configurable via `Setting.imageCleaningProvider` + `Setting.imageCleaningApiKey`

---

## 14. Notification System

`NotificationModule` contains a `WhatsAppService` for sending WhatsApp messages (e.g., order confirmations, payment receipts). In-app `Notification` records are stored in the `notifications` table.

---

## 15. Related Repositories

| Repo | Purpose | Stack |
|---|---|---|
| `little-souls-backend` | **This repo** — REST API | NestJS + PostgreSQL |
| (future) `little-souls-web` | B2B Customer Website | Next.js |
| (future) `little-souls-app` | Customer Mobile App | React Native |
| (future) `little-souls-admin` | Staff/Admin Panel | Next.js or React |

---

## 16. Testing

- **Unit tests:** Jest (`*.spec.ts` files) — `npm run test`
- **API tests:** Postman collection (`Little-Souls-B2B.postman_collection.json`) — run via `npm run test:api` (uses Newman)
- **API Testing flow:** documented in `API_TESTING_FLOW.md`

---

## 17. Quick Start for New Developers

```bash
# 1. Clone & install
git clone <repo-url>
cd little-souls-backend
npm ci

# 2. Set up environment
cp .env.example .env   # (create this file manually with vars from Section 10)

# 3. Run database migrations
npx prisma migrate deploy

# 4. Generate Prisma client
npx prisma generate

# 5. Start development server
npm run start:dev
# API available at http://localhost:3000/api
```

---

*Last updated: May 2026 | Maintained by the Little Souls development team*
