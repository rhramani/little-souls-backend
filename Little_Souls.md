Little Souls Wholesale System
# **1. Main Customer Flow**
- - Customer visits website for the first time.
- - Customer fills registration form with business and contact details.
- - Customer status remains Pending until admin review.
- - Admin checks customer details like business name, contact number, GSTIN, address, store photo, and source.
- - If details are valid, admin approves the customer and assigns one pricing group.
- - Customer receives login permission and can access the customer panel.
- - Customer browses catalog, searches products, opens product details, and adds products to cart.
- - Customer checks out and the order is sent to the business team on WhatsApp.
- - Customer can later view order history, payment history, ledger, invoices/statements, and profile.
# **2. Customer Registration & Approval**
- - Registration fields: Business Name, GSTIN, Billing Address, Shipping Address, City, State, Store Photo, Customer Source, Main Contact Number.
- - One business account can have multiple linked contact persons such as Owner, Partner, Purchase Manager, or Sales Contact.
- - Each contact person can store Name, Photo, Mobile Number, WhatsApp Number, Email, Designation, and Login Access Yes/No.
- - Pricing group, ledger, orders, and payments belong to the business account, not individual contact persons.
- - Admin must approve customer before login access is enabled.
# **3. Customer Group & Pricing Rules**
- - Main pricing groups: Retailer, Dealer, Distributor. Admin can assign any one group to the customer.
- - Group names are only for backend/admin use. Customers should never see pricing group names.
- - Product pricing will be separate group-wise.
- - Customer sees only their own product price, MOQ, and product details.
- - Customer must not see other group prices or hidden pricing tiers.
# **4. Catalog & Product Management**
- - Catalog will be managed manually by admin or staff members. QuickSell API will not be used for catalog display in this current flow. Admin/staff can add, edit, and manage products directly from the backend.
- - Product fields: SKU, Product Name, Images, Description, Category, MOQ, Tags, Stock, and Group-wise Pricing.
- - Admin/staff can upload product images, product PDF/JPG catalog media, and product videos if needed.
- - Catalog should be mobile-friendly and easy for customers to search and browse.
- - Customer can search products, view product details, add to cart, and checkout.
- - Every product should have a unique SKU to avoid duplicate products.
# **5. Product Image Cleaning Feature**
- - During catalog creation, when admin or staff uploads product images, the system should use a third-party image cleaning API to improve the image quality before saving it in the catalog.
- - Image cleaning can include background cleanup, image enhancement, resizing, compression, and clean product presentation.
- - Original image and cleaned image should be stored separately if needed.
- - Admin/staff should be able to preview the cleaned image before final save.
- - This feature will help make the catalog look clean, professional, and premium.
# **6. Role-Based Panel Topics**

|Role|Main Access|Responsibility|
| :- | :- | :- |
|Super Admin|Full system access|Manage staff, permissions, customers, catalog, pricing, orders, reports, settings.|
|Admin/Manager|Customer approval, group assignment, catalog/order control|Verify customers, assign pricing group, manage products, monitor orders.|
|Catalog Staff|Catalog module|Add/edit products, upload images, manage product details and image cleaning workflow.|
|Sales Staff|Orders and customer follow-up|Review WhatsApp orders, create/confirm orders, customer support.|
|Accounts Staff|Ledger and payments|Manage payment entries, customer ledger, transaction history, statements.|
|Customer|Customer panel only|Browse catalog, add to cart, checkout, view orders, payments, ledger, and profile.|
# **7. Order & Customer Panel**
- - Cart and checkout should be simple and fast.
- - Current order submission method: send order details to WhatsApp.
- - Order data should still be saved in backend for history and reporting.
- - Customer panel should include Order History, Payment History, Ledger, Profile, and Support.
- - Future order flow can include invoice generation, packing, dispatch, and shipment tracking.
# **8. Suggested Development Timeline — 7 to 8 Weeks**

|Week|Work|Output|
| :- | :- | :- |
|Week 1|Project setup, database planning, authentication base, role & permission structure|Base project ready with login/auth and role structure.|
|Week 2|Customer registration, multi-contact person setup, admin approval workflow, group assignment|Customer can register; admin can review, approve, and assign pricing group.|
|Week 3|Manual catalog module, product CRUD, SKU, category, MOQ, stock, tags, product media upload|Admin/staff can create and manage catalog products manually.|
|Week 4|Third-party image cleaning API integration, image preview, original/cleaned image storage|Catalog images can be cleaned and previewed before final save.|
|Week 5|Group-wise pricing security, customer catalog view, search, product details, cart|Customer sees only own group price and can add products to cart.|
|Week 6|Checkout to WhatsApp, backend order saving, order history, sales staff order follow-up flow|Order is sent on WhatsApp and stored in backend for tracking.|
|Week 7|Payment history, ledger view, invoices/statements basic view, reports, customer profile/support|Customer panel and admin/accounts workflow become functional.|
|Week 8|Full testing, bug fixing, mobile responsive polish, security review, deployment preparation|System becomes ready for demo/live launch. Week 8 can be used as buffer if Week 7 work is completed early.|
# **9. Final Build Scope**
- - Manual catalog management instead of QuickSell API for current phase.
- - Admin approval is required before customer login.
- - Admin assigns customer group internally.
- - Group-wise pricing is secure and hidden from customer.
- - Customer checkout currently sends order on WhatsApp.
- - Customer panel includes order history, payment history, ledger, and profile.
- - Role-based access must be applied for admin, staff, and customer.
