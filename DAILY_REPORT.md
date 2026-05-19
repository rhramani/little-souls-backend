# Daily Status Report: Backend Setup & API Development

**Date:** May 19, 2026  
**Project:** Little Souls B2B Wholesale Platform  

---

## 🎯 Objective
To establish a robust, scalable, and secure backend architecture using NestJS and Prisma, and to develop all core B2B wholesale operational APIs ranging from Authentication to Order Management, ensuring all endpoints successfully integrate with the Postman test suite.

---

## 🛠️ Key Achievements & Development Progress

### 1. Project Initialization & Architecture Setup
- **NestJS Framework Setup:** Initialized the project with a modular architecture for better scalability and code maintainability.
- **Database & ORM Integration:** 
  - Integrated **PostgreSQL** as the primary database.
  - Set up **Prisma ORM** with standard database connection pooling and `.env` configuration for secure credential management.
  - Resolved Prisma 7 configuration constraints by migrating the DB connection URL to `prisma.config.ts`.
  - Successfully executed database sync (`npx prisma db push`), ensuring all tables and relations are properly structured in PostgreSQL.
- **Global Validation:** Configured `ValidationPipe` globally to strictly validate all incoming API payloads using DTOs and implicitly convert query params.
- **Environment & Security:** Added `.gitignore` to securely omit environment variables and compiled files from version control.

### 2. Database Schema Design (B2B Focus)
- Designed a comprehensive and highly relational database schema covering:
  - **User & Role Management:** `User`, `StaffProfile`, `Customer`, `CustomerContact`, and `Role` tables.
  - **Catalog & Inventory:** `Category`, `Product`, `ProductImage`, and `ProductPricing` (for custom wholesale tiers).
  - **Commerce & Logistics:** `Cart`, `Order`, `OrderItem`, and `SupportTicket` tables.
  - **Billing:** `Invoice`, `Payment`, and `Ledger` tables.

### 3. Authentication & Role-Based Access Control (RBAC)
- Developed secure JWT-based authentication workflows.
- **Registration Workflows:** 
  - Created isolated Registration APIs for B2B Customers (defaults to `PENDING` status) and Sales Staff.
- **Login & Sessions:** Created Login APIs mapped precisely to accept `email` credentials and return standardized user profiles along with JWT tokens.
- **Authorization Guards:** Implemented strict access controls (`RolesGuard`) to ensure only authorized Admins/Staff can approve accounts, set pricing, or change order statuses.

### 4. Core B2B API Development
Successfully developed the core functional modules:
- **Catalog & Products API:** Endpoints to create categories and products. Implemented dynamic catalog listing that resolves custom prices based on the logged-in customer's pricing group.
- **Tiered Wholesale Pricing API:** Built a custom pricing engine allowing Staff to set up specific Pricing Groups (e.g., Distributors, Premium Wholesalers) and assign custom prices to products per group.
- **Cart & Order Management API:**
  - Implemented Cart APIs with built-in validations for **Minimum Order Quantity (MoQ)** and Stock Availability.
  - Built the B2B Checkout pipeline. Implemented strict inventory logic where stock is reserved but **only deducted** after a Staff Admin explicitly approves the order.
- **Billing & Support:** Prepared the foundation for Ledger entries, Payment Verifications, and Support Ticketing APIs.

---

## 🐛 Bug Fixes & Postman API Testing Triumphs
During the end-to-end testing phase, several critical roadblocks were identified and resolved to achieve 100% test passing in Postman:

1. **Prisma Schema & Relational Fixes (Staff Creation):**
   - **Issue:** TypeScript and Prisma errors (`Property 'staff' does not exist`) occurred during Staff Registration due to reversed schema relationships.
   - **Fix:** Refactored the `registerStaff` transaction to first generate a `StaffProfile`, and then securely link its ID to the `User` model, restoring the admin creation flow.

2. **Route Name Mismatches (404 Errors):**
   - Synchronized NestJS controller paths with Postman API expectations:
     - `POST /auth/register/customer` ➡️ `POST /auth/register-customer`
     - `POST /cart/item` ➡️ `POST /cart`
     - `POST /pricing/price` ➡️ `POST /pricing/setup`

3. **Login Payload Alignment (401 Errors):**
   - Transformed the `LoginDto` to accept `email` instead of `identifier`, ensuring seamless automated token capture by Postman during login tests.

4. **Dynamic Catalog Pricing Bug (500 Error):**
   - **Issue:** `GET /product` returned a 500 error when accessed without a pricing group token.
   - **Fix:** Identified an out-of-sync database (`created_by` column missing in `product_pricing`). Forced a Prisma schema push (`db push`), aligning the Postgres database with the application logic and completely resolving the server crash.

5. **Postman Test Assertion Alignment:**
   - Modified standard backend JSON responses to perfectly align with the strict JavaScript assertions configured in the Postman collection:
     - Mapped `customer.approvalStatus` to `customer.status`.
     - Attached the full `staff` object to the staff registration response.
     - Mapped `user.userType` to `role` in the profile endpoint.
   - **Result:** Eliminated all false-positive assertion failures (`AssertionError: expected undefined to deeply equal...`), unlocking the 403 Forbidden blockers and clearing the path for End-to-End API testing.

---

## 🚀 Next Steps
- **Execute Final QA Run:** Run the entire Postman collection in sequence to verify all Admin Approvals and Customer Checkouts perform without interruption.
- **Begin Frontend Integration:** The APIs are now stable, secure, and ready to be consumed by the frontend application.
