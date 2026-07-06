# Little Souls Wholesale System — Product Documentation

Welcome to the official product documentation for the **Little Souls Wholesale B2B System**. This document provides a detailed overview of the system architecture, core business rules, functional modules, role permissions, database schema, API routing, end-to-end operational flows, and development guidelines.

---

## 1. Executive Summary & Product Goal

**Little Souls** is a premium wholesale clothing brand operating in the B2B commerce space. The ecosystem replaces manual order collection and unstructured communications with a secure, automated, and high-performance ordering, tracking, and management platform.

### Product Objectives
* **Catalog-Driven Operations**: Products are easily searchable, browsable, and categorized, providing a premium shopping experience for B2B buyers.
* **Granular Price Security**: B2B price tiers (Retailer, Dealer, Distributor, etc.) are strictly hidden and served dynamically based on user identity.
* **Unified Accounting**: Integrates invoicing, payments, credit/debit notes, and business-level ledgers.
* **Operational Control**: Includes staff attendance tracking, monthly payroll calculation, purchase order management, and detailed sales analytics.
* **Multi-Channel Delivery**: Powers a Customer Web Portal, a Customer Mobile App, and a Staff Dashboard through a central API.

---

## 2. High-Level System Architecture

The ecosystem follows an API-first, modular design to ensure scaling capabilities and integration with future automation tools.

```mermaid
graph TD
    subgraph "External Integrations"
        QS[QuickSell API / Excel Catalog]
        IC[Image Cleaning API]
        WA[WhatsApp Notification API]
        S3[AWS S3 File Storage]
    end

    subgraph "Backend Engine"
        Nest[NestJS v11 REST API]
        Prisma[Prisma v7 ORM]
        DB[(PostgreSQL Database)]
        Audit[Global Audit Interceptor]
    end

    subgraph "Frontend Applications"
        Web[Customer Web Portal]
        Mobile[Customer Mobile App]
        Admin[Staff / Admin Panel]
    end

    QS <-->|Excel Upload / Sync| Nest
    IC <-->|Webhook Callback| Nest
    WA <-->|Notification Push| Nest
    Nest <-->|Presigned Uploads / Storage| S3
    
    Nest <--> Prisma
    Prisma <--> DB
    Nest <--> Audit
    
    Nest <-->|JSON REST API| Web
    Nest <-->|JSON REST API| Mobile
    Nest <-->|JSON REST API| Admin
```

* **Backend API (`little-souls-backend`)**: NestJS REST framework running on Node.js. It acts as the single source of truth, enforcing all security guards, processing business logic, and executing audit logging.
* **Frontend Web Clients (`little-souls-flow`)**: A monorepo structure built on React, Vite, and TanStack Start / React Router. It serves as both the B2B Customer Web Portal and the Admin Dashboard.
* **Database Layer**: PostgreSQL managed via Prisma ORM for type-safe queries.

---

## 3. Core Business Rules

The following core rules govern the development and operation of the Little Souls B2B Wholesale ecosystem:

1. **Excel Round-Trip Editing**: Product and inventory catalogs are managed in bulk via Excel exporting, editing, and re-importing. Unique SKUs must be enforced to prevent duplicates.
2. **Strict Pricing Group Anonymity**: Customers are assigned to pricing groups (e.g., `Retailer`, `Dealer`, `Distributor`). Customers must **never** see the name of their group or other pricing tiers.
3. **Separate Auditable Credentials**: No shared administrative accounts are permitted. Every employee gets individual credentials, and actions are logged using a global audit log interceptor.
4. **Unified Customer Accounts**: A business (Customer) is represented as a single financial entity with a unified ledger, credit limit, and pricing group. However, a customer can have multiple contact persons (e.g., Owner, Purchase Manager) with independent credentials.
5. **No Silent Negative Stock**: Shortages and backorders must always be explicitly visible in order screens. Negative stock is never quietly accepted.
6. **Backend Permission Enforcement**: Frontend client routes are protected for UX convenience, but all security and resource authorization are strictly enforced by the backend using role guards.

---

## 4. User Types & Role-Based Access Control (RBAC)

The system manages authorization through system roles. A user’s capability is derived from their role's permissions across modules.

### User Types (Enum `UserType`)
* **`SUPER_ADMIN`**: Full system control. Can manage staff, update settings, access payroll, override credit limits, and modify catalogs.
* **`STAFF`**: Internal team members. Granular module assignments determine their workspace permissions.
* **`CUSTOMER`**: External B2B buyer account. Restricted to their own catalogs, cart, orders, ledger, and profile page.

### Staff Module Specializations
Staff users can be assigned multiple roles/modules dynamically:

| Staff Module | Core Responsibility | Key Screens |
| :--- | :--- | :--- |
| **Catalog Staff** | Manages categories, products, inventory imports, and image cleaning workflows. | Product List, Categories, Import/Export, Media Upload |
| **Sales Staff** | Reviews pending orders, validates shortages, overrides backorders, and logs quotes. | Orders, Customers, Chat Support, POS |
| **Packing Staff** | Directs item pick list, generates packing slips, prints shipping labels, and updates dispatch. | Packing Slips, Shipments, Courier Details |
| **Accounts Staff** | Logs customer payments, creates debit/credit notes, downloads statements, and checks ledger. | Payments, Ledger Entries, Credit/Debit Notes |
| **Management / HR** | Oversees staff performance, evaluates attendance logs, and calculates payroll salaries. | Staff Profiles, Attendance Sheets, Payroll, Reports |

---

## 5. Functional Modules

### 5.1 Authentication & Registration Flow
* **Registration**: Customers fill a detailed sign-up form. Accounts are created in `PENDING` state.
* **Approval Flow**: Administrators review the GSTIN, business profile, and store photos. Once validated, they assign a pricing group and approve the customer.
* **Login Options**: Custom credentials (mobile & password) or OTP-based authentication (`/api/auth/otp`).
* **Session Management**: JWT access tokens are used for stateless API authorization, backed by refresh tokens stored in the `UserSession` table to handle session revocation.

### 5.2 Customer Groups & Pricing Engine
* **Pricing Groups**: Internal pricing matrices configured under distinct groups (e.g. Retailer, Dealer, Distributor).
* **Price Fetching Pattern**:
  * Unauthenticated users see products with **no price**.
  * Logged-in customers see **only their designated group price** (via `OptionalJwtAuthGuard`).
  * Admin and Sales staff view all pricing matrices.

```
Product (SKU: LS101)
├── Retailer Price:    ₹180.00  <-- Visible only to Retailer Customers
├── Dealer Price:      ₹165.00  <-- Visible only to Dealer Customers
└── Distributor Price: ₹150.00  <-- Visible only to Distributor Customers
```

### 5.3 Catalog & Product Management
* **Manual & Bulk Operations**: Products can be created manually in the panel or updated in bulk via Excel imports (`/api/import`).
* **Product Fields**: SKU (unique), Name, Slug, Category, Description, MOQ, Stock Quantity, Stock Status, Tax Percent, HSN Code.
* **Media Assets**: Support for product image galleries, PDF/JPG catalogs, product videos, and mobile-first short demos.

### 5.4 Image Cleaning Integration
* During catalog upload, staff can submit product images to an integrated third-party background removal API.
* Keeps the storefront visually premium by removing distracting photo backgrounds.
* The system keeps the `originalUrl` and updates `cleanedUrl` once the webhook callback is processed from the cleaning provider.

### 5.5 Cart & Checkout
* **B2B Logic Enforcements**:
  * **MOQ Check**: The cart prevents checkout if the quantity is below the product's Minimum Order Quantity (MOQ).
  * **Stock Check**: If the stock is insufficient, checkout is blocked unless backorders are enabled for the product or approved by a manager.
* **Checkout Result**: An order is placed in the database and a WhatsApp text formatting utility creates a pre-filled order details message to send directly to the sales team's WhatsApp.

### 5.6 Order Lifecycle & Inventory Control
Orders transition through structured states. Stock is only deducted when the order is approved.

```
[Customer Checkout] ──> Status: SUBMITTED (Stock locked but NOT deducted)
                             │
                      [Sales Review]
                             ├──> CANCELLED (Release stock lock)
                             └──> Status: APPROVED (Deduct stock from database)
                                     │
                             [Packing Slip Generated]
                                     └──> Status: PACKED (Fulfillment details logged)
                                             │
                                     [Shipment Booked]
                                             └──> Status: SHIPPED (Tracking number added)
                                                     │
                                             [Courier Delivery]
                                                     └──> Status: DELIVERED
```

* **Shortage & Backorder Control**:
  * If stock is insufficient: sales team can request a split order, adjust quantities, hold pending stock, or mark as Backorder.
  * Backorders must be authorized based on the product’s `allowBackorder` flag or a manager’s manual approval.

### 5.7 Billing, Ledgers, & Credit Management
* **Invoicing**: Staff generates a formal invoice (`/api/billing/invoice/generate/:orderId`) upon order approval. This automatically writes a `DEBIT` entry to the customer's ledger.
* **Payment Log**:
  * Customer uploads payment proofs (bank receipt, UPI screenshot) -> Status = `PENDING`.
  * Accounts staff enters or verifies payment -> Status = `VERIFIED` -> Creates a `CREDIT` entry in the ledger.
* **Credit/Debit Notes**: Used for processing returns, price adjustments, or goodwill credits. Adjusts the customer's `currentBalance` directly.

### 5.8 Operations: Attendance & Payroll
* **Daily Attendance**: Staff check-in and check-out via the portal. Logs overtime minutes, half-days, and leaves.
* **Leave Requests**: System for requesting and approving Sick, Casual, Paid, or Unpaid leaves.
* **Monthly Payroll**: Automatically calculates payable salary based on basic wage, overtime rates, approved leaves, and deductions.

---

## 6. Database Schema Summary (Prisma Models)

The PostgreSQL database is organized into distinct logical zones. Below is an index of the critical models defined in [schema.prisma](file:///Users/user/Raj/little-souls-backend/prisma/schema.prisma):

```
┌──────────────────────────────────────────────────────────────────────────┐
│                             DATABASE ZONES                               │
├───────────────────┬───────────────────┬───────────────────┬──────────────┤
│ 1. Auth & Staff   │ 2. Customers      │ 3. Products       │ 4. Orders    │
├───────────────────┼───────────────────┼───────────────────┼──────────────┤
│ - User            │ - Customer        │ - Category        │ - Order      │
│ - StaffProfile    │ - CustomerContact │ - Product         │ - OrderItem  │
│ - AttendanceRecord│ - PricingGroup    │ - ProductImage    │ - PackingSlip│
│ - Payroll         │ - LedgerEntry     │ - ProductPricing  │ - Shipment   │
│ - AuditLog        │ - Payment         │ - CatalogImport   │ - Cart       │
└───────────────────┴───────────────────┴───────────────────┴──────────────┘
```

### Core Table Indexes
* **`users`**: Contains credentials, mobile verification, and references to `staffId` or `customerId`.
* **`customers`**: Holds business-level information, credit limits, current balances, and billing address.
* **`products`**: Enforces unique SKUs, stock levels, and ties to category relations.
* **`product_pricing`**: Holds pricing overrides for combinations of `(productId, pricingGroupId)`.
* **`ledger_entries`**: Immutable double-entry book-keeping log recording transactions per customer business.

---

## 7. API Endpoints Directory

All endpoints are prefixed with `/api` and expect headers `Content-Type: application/json` and `Authorization: Bearer <token>` for protected paths.

### 7.1 Authentication (`/api/auth`)
| Method | Endpoint | Auth Required | Authorized Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/auth/register-customer` | No | — | Submits a customer business request. |
| `POST` | `/auth/register-staff` | No | — | Registers staff credentials. |
| `POST` | `/auth/login` | No | — | Authenticates username/password and yields JWT. |
| `POST` | `/auth/otp/send` | No | — | Dispatches OTP code to user's mobile. |
| `POST` | `/auth/otp/verify` | No | — | Exchanges verified OTP code for access token. |
| `GET` | `/auth/profile` | Yes | All | Returns current active user object. |

### 7.2 Customer & Verification (`/api/customer`)
| Method | Endpoint | Auth Required | Authorized Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/customer` | Yes | `SUPER_ADMIN`, `STAFF` | Fetches list of all businesses with filters. |
| `PATCH` | `/customer/:id/approve` | Yes | `SUPER_ADMIN`, `STAFF` | Approves business and maps to a pricing group. |
| `PATCH` | `/customer/:id/reject` | Yes | `SUPER_ADMIN`, `STAFF` | Rejects registration with reason. |

### 7.3 Products & Catalogs (`/api/product` / `/api/category`)
| Method | Endpoint | Auth Required | Authorized Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/category` | Optional | All | Returns categories as a hierarchical tree. |
| `GET` | `/product` | Optional | All | Lists products. Prices correspond to customer group. |
| `POST` | `/product` | Yes | `SUPER_ADMIN`, `STAFF` | Creates a new SKU catalog record. |
| `PATCH` | `/product/:id` | Yes | `SUPER_ADMIN`, `STAFF` | Updates product specifications. |

### 7.4 Cart & Orders (`/api/cart` / `/api/order`)
| Method | Endpoint | Auth Required | Authorized Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/cart` | Yes | `CUSTOMER` | Fetches active shopping cart. |
| `POST` | `/cart` | Yes | `CUSTOMER` | Adds an item to the active cart with MOQ checks. |
| `POST` | `/order/checkout` | Yes | `CUSTOMER` | Places order and builds WhatsApp share link. |
| `PATCH` | `/order/:id/status` | Yes | `SUPER_ADMIN`, `STAFF` | Advances order lifecycle status. |
| `POST` | `/order/:id/pack` | Yes | `SUPER_ADMIN`, `STAFF` | Creates packing slip and lists pick list. |

### 7.5 Financials & Ledger (`/api/billing`)
| Method | Endpoint | Auth Required | Authorized Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/billing/invoice/generate/:orderId` | Yes | `SUPER_ADMIN`, `STAFF` | Compiles formal tax invoice & debits ledger. |
| `GET` | `/billing/ledger` | Yes | All | Returns ledger transactions list. |
| `POST` | `/billing/payment` | Yes | All | Log a payment (Staff = Auto-approved, Customer = Pending). |
| `POST` | `/billing/payment/:id/verify` | Yes | `SUPER_ADMIN`, `STAFF` | Accounts staff confirms payment in bank. |

---

## 8. Essential Workflows

### 8.1 The B2B Purchase Loop
```
[Customer] Browses items on Web/App -> Adds to Cart (respects MOQ) -> Checkout
                                                                        │
[Sales Staff] Receives order on WhatsApp/Admin Dashboard ───────────────┘
  ├── Check Stock Status:
  │     ├── Sufficient Stock -> Verify and click "Approve Order" (Deducts stock)
  │     └── Shortage -> Select "Backorder", adjust quantities, or split order
  │
[Packing Staff] Prints packing slip -> Packs items -> Click "Mark Packed"
                                                                        │
[Accounts Staff] Clicks "Generate Invoice" (Creates invoice & Debits ledger)
                                                                        │
[Customer] Pays amount -> Uploads transfer receipt on portal ───────────┘
                                                                        │
[Accounts Staff] Verifies payment in bank -> Clicks "Verify" (Credits ledger)
```

### 8.2 Bulk Catalog Management
```
[Admin/Staff] Downloads current catalog Excel sheet
                     │
[Admin/Staff] Updates columns (Prices, SKUs, MOQ, stock numbers) in Excel
                     │
[Admin/Staff] Uploads Excel sheet under Bulk Import Screen
                     │
[Backend Engine] Validates duplicate SKUs and checks columns
                     ├── Success -> Updates catalog rows & logs Audit action
                     └── Validation Errors -> Generates error-marked Excel for download
```

---

## 9. Environment Setup & Configuration

### Backend Environment Variables (`.env`)
```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Connection
DATABASE_URL="postgresql://db_user:db_password@localhost:5432/little_souls_db?schema=public"

# Auth Keys
JWT_SECRET="super_secret_session_token_key"
JWT_EXPIRES_IN="7d"

# AWS S3 Storage Details
AWS_REGION="ap-south-1"
AWS_ACCESS_KEY_ID="your_aws_key_id"
AWS_SECRET_ACCESS_KEY="your_aws_secret_key"
AWS_S3_BUCKET="little-souls-media-bucket"

# External Integrations (Optional)
IMAGE_CLEANING_API_KEY="bg_removal_api_token"
WHATSAPP_API_URL="https://api.whatsapp-gateway.com/v1"
WHATSAPP_API_KEY="whatsapp_gateway_secret"
```

### Frontend Environment Variables (`.env`)
```env
# API Target URL
VITE_API_BASE_URL="http://localhost:3000/api"

# Web Socket URL
VITE_SOCKET_URL="http://localhost:3000"
```

---

## 10. Development & Testing Instructions

### Initial Setup & Launch
1. Clone the repository files locally.
2. Provide local configuration parameters in the `.env` file.
3. Install project dependencies:
   ```bash
   npm install
   ```
4. Run DB migrations and update the local Prisma engine:
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```
5. Launch the application in developer mode:
   ```bash
   npm run start:dev
   ```

### Execution of Automated Tests
* Run unit tests using:
  ```bash
  npm run test
  ```
* Run endpoint testing suite using Newman:
  ```bash
  npm run test:api
  ```

---

*Document version: 1.0.0 | Maintainers: Little Souls Core Dev Team*
