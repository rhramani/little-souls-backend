# <a name="little-souls-master-build-plan"></a>LITTLE SOULS — MASTER BUILD PLAN
## <a name="xeb729e53fd994acc58824e110f0d600f38fc64a"></a>Wholesale Website + Customer App + Staff Backend System
-----
# <a name="project-goal"></a>PROJECT GOAL
Build a complete wholesale ecosystem that is:

- simple for staff
- secure for pricing
- scalable for future growth
- catalog-driven using QuickSell
- mobile-friendly
- role-based
- operationally easy
-----
# <a name="final-system-architecture"></a>FINAL SYSTEM ARCHITECTURE
`                 `QUICKSELL\
`      `(Catalog + PDF + JPG + Sharing)\
`                         `↓\
`               `Product Sync/API Layer\
`                         `↓\
`                 `CENTRAL BACKEND\
`                         `↓\
` `┌────────────────────────────────────┐\
` `│                                    │\
` `│ Customer Website                   │\
` `│ Customer Mobile App                │\
` `│ Staff/Admin Backend App            │\
` `│                                    │\
` `└────────────────────────────────────┘

-----
# <a name="core-business-rules"></a>CORE BUSINESS RULES
## <a name="rule-1"></a>RULE 1
QuickSell is the ONLY product catalog source.
## <a name="rule-2"></a>RULE 2
Backend handles business operations only.
## <a name="rule-3"></a>RULE 3
Customers NEVER see pricing groups.
## <a name="rule-4"></a>RULE 4
Every employee gets separate login.
## <a name="rule-5"></a>RULE 5
Backend controls all permissions.
## <a name="rule-6"></a>RULE 6
No shared admin accounts.
## <a name="rule-7"></a>RULE 7
One employee can have multiple modules.

-----
# <a name="modules-to-build"></a>MODULES TO BUILD
# <a name="module-1-authentication"></a>MODULE 1 — AUTHENTICATION
## <a name="features"></a>Features
- Login
- Logout
- Forgot password
- OTP login optional
- Session management
- JWT authentication
- Role checking
## <a name="user-types"></a>User Types
- Customer
- Staff
- Super Admin
-----
# <a name="module-2-customer-registration-approval"></a>MODULE 2 — CUSTOMER REGISTRATION & APPROVAL
## <a name="flow"></a>Flow
1. Customer registers
1. Status = Pending
1. Manager/Admin reviews
1. Assign pricing group
1. Customer approved
## <a name="fields"></a>Fields
- Business Name
- GSTIN
- Billing Address
- Shipping Address
- City
- State
- Store Photo
- Customer Source
- Main Contact Number
## <a name="linked-contact-persons"></a>Linked Contact Persons
One business account can contain multiple linked contact persons.

Each contact person can have:

- Name
- Photo
- Mobile Number
- WhatsApp Number
- Email
- Designation
- Login Access YES/NO

Examples:

- Owner
- Partner
- Purchase Manager
- Sales Contact
## <a name="important-structure-rule"></a>Important Structure Rule
- Business account stores pricing, ledger, orders, and customer group
- Contact persons store people information only
- Pricing group belongs to business account, not individual contacts
- All linked contacts share the same pricing and ledger under one business account
- Each contact person can optionally get separate login credentials
## <a name="important-rule"></a>Important Rule
- Store-level customer account stays one group
- Partners are stored as linked people under the same business account
- This keeps pricing, orders, and ledger unified while still recording individual identities
-----
# <a name="module-3-customer-group-system"></a>MODULE 3 — CUSTOMER GROUP SYSTEM
## <a name="internal-groups"></a>Internal Groups
- Retailer
- Dealer
- Distributor
- VIP
## <a name="important"></a>IMPORTANT
Customers never see these names.

Backend uses groups internally only.

-----
# <a name="module-4-product-sync-system"></a>MODULE 4 — PRODUCT SYNC SYSTEM
## <a name="product-source"></a>Product Source
QuickSell
## <a name="sync-fields"></a>Sync Fields
- SKU
- Product Name
- Images
- Description
- Categories
- MOQ
- Tags
## <a name="sync-method"></a>Sync Method
- API
- Webhooks
- Scheduled sync
## <a name="excel-round-trip-editing"></a>Excel Round-Trip Editing
Staff can: 1. Download the existing catalog as Excel 2. Edit fields like product name, SKU, price, discounted price, description, sizes, colors, tax, weight, and image URLs 3. Re-upload the Excel file to update the catalog in bulk
## <a name="important-rule-1"></a>Important Rule
- Every product must keep a unique identifier such as SKU
- Re-upload should update the same product, not create duplicates
- Backend should validate duplicate SKUs before sync
## <a name="product-media-support"></a>Product Media Support
Each product should support:

- product images
- image carousel
- product video
- short demo video
- optional thumbnail for video
## <a name="xbececb67ffe03c0bfcc569ef6798a822f2a8b3a"></a>Banner Style for Better Catalog Presentation
Use clean, branded banners so each catalogue looks premium and easy to browse.

Recommended banner types:

- Hero banner for catalogue cover
- Category banner for product groups
- Promo banner for offers/new arrivals
- Horizontal banner for web headers
- Vertical banner for mobile-first sharing
## <a name="responsive-size-guidance"></a>Responsive Size Guidance
Use device-friendly sizes instead of separate designs for every platform:

- Square product image: 1:1
- Web hero banner: wide landscape ratio
- Mobile banner: tall or centered crop
- Video: portrait or square for mobile sharing, landscape for website playback
## <a name="device-compatibility"></a>Device Compatibility
Design should look good on:

- Android phones
- iPhone screens
- Windows desktop / laptop screens
- Tablet screens
## <a name="key-rule"></a>Key Rule
The same catalogue content should resize properly across all devices without breaking layout.

-----
# <a name="module-5-pricing-engine"></a>MODULE 5 — PRICING ENGINE
## <a name="backend-pricing-table"></a>Backend Pricing Table

|SKU|Retailer|Dealer|Distributor|
| :- | :- | :- | :- |
|LS101|180|165|150|
## <a name="frontend-customer-view"></a>Frontend Customer View
Customer sees ONLY:

₹180\
MOQ: 12 pcs

Never:

- pricing groups
- hidden tiers
- other customer pricing
-----
# <a name="module-6-customer-website"></a>MODULE 6 — CUSTOMER WEBSITE
## <a name="pages"></a>Pages
- Home
- Categories
- Product Listing
- Product Detail
- Register
- Login
- Request Access
- Cart
- Checkout
- Orders
- Ledger
- Profile
## <a name="customer-features"></a>Customer Features
- View products
- View own prices
- Place order
- Reorder
- Download invoice
- View transaction history
- View ledger
-----
# <a name="module-7-customer-mobile-app"></a>MODULE 7 — CUSTOMER MOBILE APP
## <a name="main-screens"></a>Main Screens
- Splash
- Login
- Home
- Categories
- Product Detail
- Cart
- Orders
- Transactions
- Ledger
- Notifications
- Support
## <a name="features-1"></a>Features
- Fast reordering
- Push notifications
- WhatsApp support
- Order tracking
- Invoice download
-----
# <a name="module-8-staff-backend-panel"></a>MODULE 8 — STAFF BACKEND PANEL
## <a name="main-dashboard-sections"></a>Main Dashboard Sections
- Dashboard
- Catalog
- Orders
- Customers
- Pricing
- Packing
- Accounts
- Purchase
- Attendance
- Payroll
- Reports
- Settings
-----
# <a name="module-9-role-permission-system"></a>MODULE 9 — ROLE & PERMISSION SYSTEM
# <a name="important-1"></a>IMPORTANT
One employee can handle multiple departments.

Example:

- Catalog
- Sales
- Purchase
## <a name="module-permissions"></a>Module Permissions
Each module has:

- View
- Create
- Edit
- Delete
- Export
-----
# <a name="staff-modules"></a>STAFF MODULES
## <a name="catalog"></a>Catalog
- Product editing
- Excel upload
- PDF generation
- JPG generation
- Product images
## <a name="sales"></a>Sales
- Customer follow-up
- Product sharing
- Order creation
- Quotation creation
## <a name="packing"></a>Packing
- Packing slips
- Shipping labels
- Dispatch updates
## <a name="accounts"></a>Accounts
- Ledger
- Payments
- Credit notes
- Statements
## <a name="purchase"></a>Purchase
- Purchase orders
- Supplier management
- Stock entries
-----
# <a name="module-10-order-management"></a>MODULE 10 — ORDER MANAGEMENT
## <a name="order-flow"></a>Order Flow
1. Customer places order
1. Sales reviews
1. Invoice generated
1. Packing team packs
1. Dispatch updated
1. Customer tracks shipment
## <a name="order-status"></a>Order Status
- Draft
- Submitted
- Approved
- Packed
- Shipped
- Delivered
- Cancelled
-----
# <a name="module-10a-shortage-backorder-control"></a>MODULE 10A — SHORTAGE / BACKORDER CONTROL
## <a name="rule"></a>Rule
Sales can take an order even when stock is not enough, but only if the product or the manager allows backorder.
## <a name="visibility"></a>Visibility
The system must clearly show:

- available stock
- requested quantity
- shortage quantity
- backorder quantity
- expected restock date if available
## <a name="allowed-actions"></a>Allowed Actions
- continue as backorder
- reduce quantity
- change item
- split order
- hold pending stock
## <a name="permission-based-control"></a>Permission Based Control
Only allowed staff roles can:

- mark a product as backorder-allowed
- override shortage rules
- approve negative stock handling
## <a name="recommended-status-labels"></a>Recommended Status Labels
- In Stock
- Low Stock
- Shortage
- Backorder
- Partial Fulfillment
- Pending Replenishment
## <a name="important-rule-2"></a>Important Rule
Negative stock must never be silent. It must always be visible as shortage or backorder in the quotation and order screen.

-----
# <a name="module-11-invoice-system"></a>MODULE 11 — INVOICE SYSTEM
## <a name="invoice-contains"></a>Invoice Contains
- Company logo
- Invoice number
- Customer details
- Shipping details
- Product image
- SKU
- Quantity
- Price
- Tax
- Shipping
- Grand total
- Payment status
## <a name="output-formats"></a>Output Formats
- PDF
- Print
- WhatsApp share
-----
# <a name="module-12-ledger-transaction-system"></a>MODULE 12 — LEDGER & TRANSACTION SYSTEM
## <a name="customer-can"></a>Customer Can
- View ledger
- View transactions
- Download statement
## <a name="customer-cannot"></a>Customer Cannot
- Edit records
- Delete payments
- Modify orders
## <a name="accounts-team-can"></a>Accounts Team Can
- Add payment
- Add credit/debit note
- Make adjustments
-----
# <a name="module-13-attendance-system"></a>MODULE 13 — ATTENDANCE SYSTEM
## <a name="daily-status"></a>Daily Status
- Present
- Absent
- Half Day
- Leave
## <a name="attendance-features"></a>Attendance Features
- Check-in
- Check-out
- Overtime
- Leave approval
-----
# <a name="module-14-payroll-system"></a>MODULE 14 — PAYROLL SYSTEM
## <a name="salary-calculation"></a>Salary Calculation
Based on:

- attendance
- leave
- overtime
- deductions
## <a name="monthly-output"></a>Monthly Output
- payable salary
- attendance summary
- payment status
-----
# <a name="module-15-reports"></a>MODULE 15 — REPORTS
## <a name="reports-needed"></a>Reports Needed
- Sales report
- Customer report
- Outstanding report
- Product performance
- Staff attendance
- Salary report
- Order report
- Packing report
-----
# <a name="module-16-security"></a>MODULE 16 — SECURITY
## <a name="very-important-rules"></a>Very Important Rules
### <a name="backend-controls-permissions"></a>Backend controls permissions
NOT frontend.
### <a name="every-request-checks"></a>Every request checks:
- user
- role
- permission
- module access
### <a name="audit-logs"></a>Audit Logs
Track:

- who edited
- what changed
- when changed
-----
# <a name="future-ai-ready-architecture"></a>FUTURE AI-READY ARCHITECTURE
## <a name="core-principle"></a>Core Principle
Design the backend as an API-first, modular system so future AI tools can be plugged in without changing the business foundation.
## <a name="must-have-design-rules"></a>Must-Have Design Rules
- Keep products, orders, customers, stock, pricing, and staff in separate modules
- Use clean REST or GraphQL APIs for all core actions
- Never hardcode business rules in the frontend
- Use event logs and audit trails for every important action
- Store structured data in tables, not inside PDFs or images
- Keep all media files separate from business records
- Use role-based permissions everywhere
- Keep each module independently replaceable
## <a name="ai-ready-modules"></a>AI-Ready Modules
The backend should later support AI tools for:

- sales assistance
- quotation suggestions
- customer follow-up reminders
- reorder prediction
- stock forecasting
- product tagging
- image search
- catalog auto-classification
- payment follow-up
- attendance and payroll summaries
- report generation
## <a name="integration-strategy"></a>Integration Strategy
Future AI tools should connect through:

- APIs
- webhooks
- background jobs
- event queues
- scheduled sync workers
## <a name="data-strategy-for-future-growth"></a>Data Strategy for Future Growth
Save clean structured fields now so AI tools can use them later, such as:

- customer source
- order status history
- product category
- barcode
- stock movement log
- quotation history
- approval history
- payment history
- staff activity log
## <a name="no-major-rebuild-rule"></a>No Major Rebuild Rule
The system should be built so that future AI features are added as extra services, not by rewriting the core website or backend.

-----
# <a name="recommended-tech-stack"></a>RECOMMENDED TECH STACK
## <a name="website"></a>Website
Next.js
## <a name="mobile-app"></a>Mobile App
React Native
## <a name="backend"></a>Backend
Node.js + NestJS
## <a name="database"></a>Database
PostgreSQL
## <a name="storage"></a>Storage
Supabase Storage or S3
## <a name="authentication"></a>Authentication
JWT
## <a name="permissions"></a>Permissions
RBAC + granular permissions

-----
# <a name="development-phases"></a>DEVELOPMENT PHASES
# <a name="phase-1-foundation"></a>PHASE 1 — FOUNDATION
- Authentication
- Customer registration
- Approval system
- Staff login
- Permissions
# <a name="phase-2-product-pricing"></a>PHASE 2 — PRODUCT & PRICING
- QuickSell sync
- Product display
- Pricing engine
- Group pricing
# <a name="phase-3-order-flow"></a>PHASE 3 — ORDER FLOW
- Cart
- Orders
- Invoice
- Packing workflow
- Shipment tracking
# <a name="phase-4-financials"></a>PHASE 4 — FINANCIALS
- Ledger
- Transactions
- Accounts module
- Statements
# <a name="phase-5-staff-system"></a>PHASE 5 — STAFF SYSTEM
- Attendance
- Payroll
- Reports
- Audit logs
# <a name="phase-6-mobile-optimization"></a>PHASE 6 — MOBILE OPTIMIZATION
- Customer app
- Push notifications
- WhatsApp integration
-----
# <a name="final-recommendation"></a>FINAL RECOMMENDATION
This system should feel:

- operationally simple
- visually clean
- role-focused
- mobile-first
- fast for staff
- safe for pricing
- scalable for future ERP growth

The biggest strength of this architecture is:

QuickSell handles catalog complexity. Your backend handles business control.

That keeps the system practical for real wholesale operations.
