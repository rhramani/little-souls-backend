# 🚀 Little Souls B2B - Complete API Testing Flow

This document provides a step-by-step sequence to fully test the B2B Wholesale backend using the provided Postman Collection.

## 🔑 Phase 1: Authentication & Account Setup
*Before anything else, we must set up roles, because all other endpoints require authorization.*

1. **Register a B2B Customer**
   - **Method:** `POST /api/auth/register-customer`
   - **Purpose:** Submits a business profile. The status will initially be set to `PENDING`.

2. **Register a Staff / Admin**
   - **Method:** `POST /api/auth/register-staff`
   - **Purpose:** Creates an admin user (e.g., `wholesale@ecostore.com`) who has the power to approve customers.

3. **Login as Staff (Auto-Token)**
   - **Method:** `POST /api/auth/login`
   - **Payload:** `{ "email": "wholesale@ecostore.com", "password": "Password123!" }`
   - **Purpose:** 🪄 *Postman will automatically capture the token from the response and save it as a variable.* You are now authenticated as an Admin.

---

## 🛡️ Phase 2: Admin Approvals
*Customers cannot login or see prices until the Admin approves them and assigns a pricing group.*

1. **Approve Customer & Assign Group**
   - **Method:** `PATCH /api/staff/assign-customer`
   - **Action:** Paste the `id` of the customer you created in Phase 1.
   - **Purpose:** Changes their status to `APPROVED` and assigns them to a group like `DISTRIBUTOR`.

---

## 📦 Phase 3: Catalog & Inventory (Admin Only)
*Now, the Admin will build the catalog.*

1. **Create Category**
   - **Method:** `POST /api/category`
   - **Purpose:** Adds a new category. Copy the `id` from the response.

2. **Create Product (SKU)**
   - **Method:** `POST /api/product`
   - **Payload:** Paste the `categoryId` into the payload.
   - **Purpose:** Adds a product with a Minimum Order Quantity (MOQ) and stock amount. Note down the product's `id`.

3. **Create Pricing Group**
   - **Method:** `POST /api/pricing/group`
   - **Purpose:** Create the `DISTRIBUTOR` group (if it doesn't already exist). Copy its `id`.

4. **Map Custom B2B Price**
   - **Method:** `POST /api/pricing/setup`
   - **Payload:** Pass the `productId` and `groupId`.
   - **Purpose:** Sets the hidden wholesale price for this specific group.

---

## 🛒 Phase 4: Customer Browsing & Cart
*Time to switch roles! We will now act as the Customer.*

1. **Login as Customer**
   - **Method:** `POST /api/auth/login`
   - **Action:** Login with the customer's email. Postman will automatically update the token. You are now the Customer.

2. **View Custom Catalog**
   - **Method:** `GET /api/product`
   - **Purpose:** Retrieves products. Notice how the prices returned are exactly what was set for your specific pricing group!

3. **Add to Cart (MOQ & Stock Test)**
   - **Method:** `POST /api/cart`
   - **Test 1 (Failure):** Try to add a quantity of `3`. It will fail because the MOQ is `5`.
   - **Test 2 (Failure):** Try to add a quantity of `500`. It will fail because the stock is too low.
   - **Test 3 (Success):** Enter a quantity of `10`. It will succeed and add the item to the cart.

---

## 🚚 Phase 5: Checkout & Order Flow

1. **B2B Checkout**
   - **Method:** `POST /api/order/checkout`
   - **Purpose:** Places the order. The stock will **NOT** be deducted yet. The response will give you a special WhatsApp link. Copy the `id` of the order.

2. **Login as Staff (Admin)**
   - **Method:** `POST /api/auth/login`
   - **Action:** Switch back to the Admin account.

3. **Approve Order & Deduct Stock**
   - **Method:** `PATCH /api/order/:id/status` (Set status to `APPROVED`)
   - **Purpose:** The admin verifies the order. Only upon this approval does the inventory stock actually reduce in the database!

---

## 💳 Phase 6: Billing & Ledgers (Optional final testing)

1. **Generate Invoice**
   - **Method:** `POST /api/billing/invoice/generate/:orderId`
   - **Purpose:** Creates a formal tax invoice and adds a `DEBIT` entry to the customer's ledger book.

2. **Verify Payment**
   - **Method:** `POST /api/billing/payment/:id/verify`
   - **Purpose:** Admin verifies that money was received in the bank. Adds a `CREDIT` entry to the customer's ledger and updates their outstanding balance.
