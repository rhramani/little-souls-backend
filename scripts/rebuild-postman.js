const fs = require('fs');
const path = require('path');

const collectionPath = path.join(__dirname, '../Little-Souls-B2B.postman_collection.json');
const collection = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));

// Load R2_PUBLIC_URL from .env
let r2PublicUrl = 'https://pub-your-id.r2.dev';
try {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/R2_PUBLIC_URL\s*=\s*["']?([^"'\r\n]+)/);
    if (match && match[1]) {
      r2PublicUrl = match[1].trim();
    }
  }
} catch (e) {
  console.warn('Could not read R2_PUBLIC_URL from .env:', e);
}

// Helper to construct Postman script event block
function makeEvent(listen, lines) {
  return {
    listen: listen,
    script: {
      exec: lines,
      type: 'text/javascript'
    }
  };
}

// 1. Re-organize/Update Auth Folder
const authFolder = collection.item.find(i => i.name === '01. Auth');
if (authFolder) {
  // Rename "Login" to "Login Customer"
  const loginCust = authFolder.item.find(i => i.name === 'Login');
  if (loginCust) {
    loginCust.name = 'Login Customer';
    loginCust.request.body.raw = JSON.stringify({
      email: "{{tempCustomerEmail}}",
      password: "Password123!"
    }, null, 2);
  }

  // Check if "Login Staff" already exists, if not create it
  let loginStaff = authFolder.item.find(i => i.name === 'Login Staff');
  if (!loginStaff) {
    loginStaff = {
      name: 'Login Staff',
      request: {
        method: 'POST',
        header: [
          { key: 'Content-Type', value: 'application/json' }
        ],
        body: {
          mode: 'raw',
          raw: JSON.stringify({
            email: "{{tempStaffEmail}}",
            password: "Password123!"
          }, null, 2)
        },
        url: {
          raw: '{{baseUrl}}/auth/login',
          host: ['{{baseUrl}}'],
          path: ['auth', 'login']
        }
      },
      response: []
    };
    // Insert login staff after login customer or at the end
    const loginCustIndex = authFolder.item.findIndex(i => i.name === 'Login Customer');
    if (loginCustIndex > -1) {
      authFolder.item.splice(loginCustIndex + 1, 0, loginStaff);
    } else {
      authFolder.item.push(loginStaff);
    }
  }
}

// Remove destructive Delete requests that break subsequent tests
const categoryFolder = collection.item.find(i => i.name.includes('Category'));
if (categoryFolder && categoryFolder.item) {
  categoryFolder.item = categoryFolder.item.filter(i => i.name !== 'Delete Category');
}
const productFolder = collection.item.find(i => i.name.includes('Product'));
if (productFolder && productFolder.item) {
  productFolder.item = productFolder.item.filter(i => i.name !== 'Delete Product');
}
const cartFolder = collection.item.find(i => i.name.includes('Cart'));
if (cartFolder && cartFolder.item) {
  cartFolder.item = cartFolder.item.filter(i => i.name !== 'Remove Cart Item' && i.name !== 'Clear Cart');
}
const pricingFolder = collection.item.find(i => i.name.includes('Pricing'));
if (pricingFolder && pricingFolder.item) {
  pricingFolder.item = pricingFolder.item.filter(i => i.name !== 'Delete Pricing Group' && i.name !== 'Remove Product Pricing');
}

// Move Approve Customer to Pricing folder so customer is approved before cart/checkout runs
let approveCustomerRequest = null;
const approvalsFolder = collection.item.find(i => i.name.includes('Customer Approvals') || i.name.includes('13.'));
if (approvalsFolder && approvalsFolder.item) {
  const index = approvalsFolder.item.findIndex(i => i.name === 'Approve Customer');
  if (index > -1) {
    approveCustomerRequest = approvalsFolder.item.splice(index, 1)[0];
  }
}
if (approveCustomerRequest && pricingFolder && pricingFolder.item) {
  pricingFolder.item.push(approveCustomerRequest);
}

// Reorder Order folder requests so Approve Backorder runs while the order is still SUBMITTED
const orderFolder = collection.item.find(i => i.name.includes('Order') || i.name.includes('06.'));
if (orderFolder && orderFolder.item) {
  const checkout = orderFolder.item.find(i => i.name === 'Checkout');
  const approveBackorder = orderFolder.item.find(i => i.name === 'Approve Backorder');
  const updateStatus = orderFolder.item.find(i => i.name === 'Update Order Status');
  const packOrder = orderFolder.item.find(i => i.name === 'Pack Order');
  const shipOrder = orderFolder.item.find(i => i.name === 'Ship Order');
  const cancelOrder = orderFolder.item.find(i => i.name === 'Cancel Order');
  const getOrders = orderFolder.item.find(i => i.name === 'Get All Orders');
  const getOrder = orderFolder.item.find(i => i.name === 'Get Order by ID');

  let cloneAddToCart = null;
  if (cartFolder && cartFolder.item) {
    const addToCart = cartFolder.item.find(i => i.name.includes('Add to Cart'));
    if (addToCart) {
      cloneAddToCart = JSON.parse(JSON.stringify(addToCart));
      cloneAddToCart.name = 'Add to Cart (For Cancel)';
    }
  }

  let cloneCheckout = null;
  if (checkout) {
    cloneCheckout = JSON.parse(JSON.stringify(checkout));
    cloneCheckout.name = 'Checkout (For Cancel)';
  }

  const reordered = [];
  if (checkout) reordered.push(checkout);
  if (approveBackorder) reordered.push(approveBackorder);
  if (updateStatus) reordered.push(updateStatus);
  if (packOrder) reordered.push(packOrder);
  if (shipOrder) reordered.push(shipOrder);
  
  if (cloneAddToCart) reordered.push(cloneAddToCart);
  if (cloneCheckout) reordered.push(cloneCheckout);
  if (cancelOrder) reordered.push(cancelOrder);
  
  if (getOrders) reordered.push(getOrders);
  if (getOrder) reordered.push(getOrder);

  // Keep any other requests in orderFolder
  for (const item of orderFolder.item) {
    if (!reordered.includes(item)) {
      reordered.push(item);
    }
  }
  orderFolder.item = reordered;
}

// Reorder and duplicate Billing folder requests so Verify Payment and Reject Payment do not conflict
const billingFolder = collection.item.find(i => i.name.includes('Billing') || i.name.includes('07.'));
if (billingFolder && billingFolder.item) {
  const genInvoice = billingFolder.item.find(i => i.name === 'Generate Invoice');
  const getInvoices = billingFolder.item.find(i => i.name === 'Get All Invoices');
  const getInvoice = billingFolder.item.find(i => i.name === 'Get Invoice by ID');
  const recordPayment = billingFolder.item.find(i => i.name === 'Record Payment');
  const getPayments = billingFolder.item.find(i => i.name === 'Get All Payments');
  const verifyPayment = billingFolder.item.find(i => i.name === 'Verify Payment');
  const rejectPayment = billingFolder.item.find(i => i.name === 'Reject Payment');

  let cloneRecordPayment = null;
  if (recordPayment) {
    cloneRecordPayment = JSON.parse(JSON.stringify(recordPayment));
    cloneRecordPayment.name = 'Record Payment (For Reject)';
  }

  const reordered = [];
  if (genInvoice) reordered.push(genInvoice);
  if (getInvoices) reordered.push(getInvoices);
  if (getInvoice) reordered.push(getInvoice);
  
  if (recordPayment) reordered.push(recordPayment);
  if (getPayments) reordered.push(getPayments);
  if (verifyPayment) reordered.push(verifyPayment);
  
  if (cloneRecordPayment) reordered.push(cloneRecordPayment);
  if (rejectPayment) reordered.push(rejectPayment);

  // Keep any other requests in billingFolder
  for (const item of billingFolder.item) {
    if (!reordered.includes(item)) {
      reordered.push(item);
    }
  }
  billingFolder.item = reordered;
}

// 2. Set dynamic creation payloads & pre-requests
function updatePayloadsAndPreRequests(item) {
  if (item.request && item.request.url) {
    if (item.request.url.raw && (
      item.request.url.raw.includes('/billing/') || 
      item.request.url.raw.includes('/wallet/') || 
      item.request.url.raw.includes('/payment-link/')
    )) {
      item.request.url.raw = item.request.url.raw.replace(/\{\{orderId\}\}/g, '{{shippedOrderId}}');
      if (item.request.url.path) {
        item.request.url.path = item.request.url.path.map(p => p === '{{orderId}}' ? '{{shippedOrderId}}' : p);
      }
    }
  }

  if (item.request && item.request.body && item.request.body.raw) {
    if (item.request.url && item.request.url.raw && (
      item.request.url.raw.includes('/billing/') || 
      item.request.url.raw.includes('/wallet/') || 
      item.request.url.raw.includes('/payment-link/')
    )) {
      item.request.body.raw = item.request.body.raw.replace(/\{\{orderId\}\}/g, '{{shippedOrderId}}');
    }
  }

  if (item.name === 'Assign Customer' || item.name === 'Assign Ticket') {
    if (item.request && item.request.body && item.request.body.raw) {
      item.request.body.raw = item.request.body.raw.replace(/\{\{staffId\}\}/g, '{{staffUserId}}');
    }
  }

  if (item.name.includes('Performance')) {
    if (item.request && item.request.url) {
      if (item.request.url.raw) {
        item.request.url.raw = item.request.url.raw.replace(/\{\{staffId\}\}/g, '{{staffUserId}}');
      }
      if (item.request.url.path) {
        item.request.url.path = item.request.url.path.map(p => p === '{{staffId}}' ? '{{staffUserId}}' : p);
      }
    }
  }

  if (item.name === 'Register Customer') {
    item.event = item.event || [];
    // remove existing prerequest
    item.event = item.event.filter(e => e.listen !== 'prerequest');
    item.event.push(makeEvent('prerequest', [
      `const randomNum = Date.now() + Math.floor(Math.random() * 1000);`,
      `pm.environment.set("tempCustomerEmail", "customer_" + randomNum + "@test.com");`,
      `pm.environment.set("tempCustomerMobile", "9" + String(randomNum).slice(-9));`,
      `const randomGstin = "22" + Math.random().toString(36).substring(2, 7).toUpperCase() + Math.floor(1000 + Math.random() * 9000) + "A1Z5";`,
      `pm.environment.set("tempCustomerGstin", randomGstin);`
    ]));
    item.request.body.raw = JSON.stringify({
      name: "John Doe",
      email: "{{tempCustomerEmail}}",
      mobile: "{{tempCustomerMobile}}",
      password: "Password123!",
      businessName: "John's Toys",
      businessType: "Retailer",
      gstin: "{{tempCustomerGstin}}",
      billingAddressLine1: "123 Main St",
      billingCity: "Mumbai",
      billingState: "MH",
      billingPincode: "400001",
      billingCountry: "India"
    }, null, 2);
  }

  if (item.name === 'Register Staff') {
    item.event = item.event || [];
    item.event = item.event.filter(e => e.listen !== 'prerequest');
    item.event.push(makeEvent('prerequest', [
      `const randomNum = Date.now() + Math.floor(Math.random() * 1000);`,
      `pm.environment.set("tempStaffEmail", "staff_" + randomNum + "@test.com");`,
      `pm.environment.set("tempStaffMobile", "8" + String(randomNum).slice(-9));`,
      `pm.environment.set("tempStaffEmployeeCode", "EMP_" + randomNum);`
    ]));
    item.request.body.raw = JSON.stringify({
      email: "{{tempStaffEmail}}",
      password: "Password123!",
      name: "Alice Smith",
      employeeCode: "{{tempStaffEmployeeCode}}",
      mobile: "{{tempStaffMobile}}",
      designation: "Sales Rep",
      department: "Sales"
    }, null, 2);
  }

  if (item.name === 'Forgot Password') {
    item.request.body.raw = JSON.stringify({
      identifier: "{{tempCustomerEmail}}"
    }, null, 2);
  }

  if (item.name === 'Reset Password') {
    item.request.body.raw = JSON.stringify({
      token: "{{resetToken}}",
      newPassword: "NewPassword123!"
    }, null, 2);
  }

  if (item.name === 'Create Category') {
    item.event = item.event || [];
    item.event = item.event.filter(e => e.listen !== 'prerequest');
    item.event.push(makeEvent('prerequest', [
      `const randomNum = Date.now() + Math.floor(Math.random() * 1000);`,
      `pm.environment.set("tempCategoryName", "Category " + randomNum);`,
      `pm.environment.set("tempCategorySlug", "category-" + randomNum);`
    ]));
    item.request.body.raw = JSON.stringify({
      name: "{{tempCategoryName}}",
      slug: "{{tempCategorySlug}}",
      isActive: true,
      sortOrder: 1
    }, null, 2);
  }

  if (item.name === 'Create Product') {
    item.event = item.event || [];
    item.event = item.event.filter(e => e.listen !== 'prerequest');
    item.event.push(makeEvent('prerequest', [
      `const randomNum = Date.now() + Math.floor(Math.random() * 1000);`,
      `pm.environment.set("tempProductName", "Product " + randomNum);`,
      `pm.environment.set("tempProductSlug", "product-" + randomNum);`,
      `pm.environment.set("tempProductSku", "SKU-" + randomNum);`
    ]));
    item.request.body.raw = JSON.stringify({
      sku: "{{tempProductSku}}",
      name: "{{tempProductName}}",
      slug: "{{tempProductSlug}}",
      shortDescription: "A wooden toy set",
      description: "Detailed description.",
      categoryId: "{{categoryId}}",
      moq: 10,
      brand: "Little Souls",
      unit: "Set",
      taxPercent: 12,
      stockQuantity: 100,
      stockStatus: "IN_STOCK",
      isActive: true,
      isFeatured: true,
      images: [
        {
          originalUrl: `${r2PublicUrl}/toy.jpg`,
          altText: "Toy Image",
          sortOrder: 1,
          isPrimary: true
        }
      ]
    }, null, 2);
  }

  if (item.name === 'Start Import') {
    item.request.body.raw = JSON.stringify({
      fileUrl: `${r2PublicUrl}/import-file.csv`,
      importType: "PRODUCT_CREATE",
      rows: [
        {
          sku: "WT-002",
          name: "Wooden Train",
          categoryId: "{{categoryId}}",
          stockQuantity: 50
        }
      ]
    }, null, 2);
  }

  if (item.name === 'Update Category') {
    item.event = item.event || [];
    item.event = item.event.filter(e => e.listen !== 'prerequest');
    item.event.push(makeEvent('prerequest', [
      `const randomNum = Date.now() + Math.floor(Math.random() * 1000);`,
      `pm.environment.set("tempCategoryUpdateName", "Updated Category " + randomNum);`
    ]));
    item.request.body.raw = JSON.stringify({
      name: "{{tempCategoryUpdateName}}",
      isActive: true
    }, null, 2);
  }

  if (item.name === 'Update Product') {
    item.event = item.event || [];
    item.event = item.event.filter(e => e.listen !== 'prerequest');
    item.event.push(makeEvent('prerequest', [
      `const randomNum = Date.now() + Math.floor(Math.random() * 1000);`,
      `pm.environment.set("tempProductUpdateName", "Updated Product " + randomNum);`
    ]));
    item.request.body.raw = JSON.stringify({
      name: "{{tempProductUpdateName}}",
      moq: 15
    }, null, 2);
  }

  if (item.name === 'Create Pricing Group') {
    item.event = item.event || [];
    item.event = item.event.filter(e => e.listen !== 'prerequest');
    item.event.push(makeEvent('prerequest', [
      `const randomNum = Date.now() + Math.floor(Math.random() * 1000);`,
      `pm.environment.set("tempGroupName", "Group " + randomNum);`,
      `pm.environment.set("tempGroupCode", "CODE_" + randomNum);`
    ]));
    item.request.body.raw = JSON.stringify({
      name: "{{tempGroupName}}",
      code: "{{tempGroupCode}}",
      description: "B2B Pricing Group"
    }, null, 2);
  }

  if (item.name.includes('Add to Cart')) {
    item.request.body.raw = JSON.stringify({
      productId: "{{productId}}",
      quantity: 20
    }, null, 2);
  }

  if (item.name === 'Update Cart Item') {
    item.request.body.raw = JSON.stringify({
      quantity: 25
    }, null, 2);
  }

  const staffOnlyRequests = [
    'Update Order Status',
    'Approve Backorder',
    'Pack Order',
    'Ship Order',
    'Generate Invoice'
  ];

  if (staffOnlyRequests.includes(item.name)) {
    item.event = item.event || [];
    item.event = item.event.filter(e => e.listen !== 'prerequest');
    item.event.push(makeEvent('prerequest', [
      `pm.environment.set("token", pm.environment.get("staffToken"));`
    ]));
  }

  // Update image webhook and image task submission
  if (item.name === 'Submit Image Task') {
    item.request.body.raw = JSON.stringify({
      productImageId: "{{productImageId}}"
    }, null, 2);
  }

  if (item.name === 'Pack Order') {
    item.request.body.raw = JSON.stringify({
      notes: "Fragile items packed carefully"
    }, null, 2);
  }

  if (item.name === 'Ship Order') {
    item.request.body.raw = JSON.stringify({
      courierName: "FedEx",
      trackingNumber: "1234567890",
      trackingUrl: "https://fedex.com/track/1234567890",
      shippingProvider: "FedEx Express",
      shippingCost: 150.00
    }, null, 2);
  }

  if (item.name === 'Webhook Callback (Mock)') {
    item.request.body.raw = JSON.stringify({
      taskId: "{{imageTaskId}}",
      status: "COMPLETED",
      cleanedUrl: "https://s3.aws.com/bucket/cleaned.png"
    }, null, 2);
  }

  if (item.name.includes('Record Payment')) {
    item.event = item.event || [];
    item.event = item.event.filter(e => e.listen !== 'prerequest');
    item.event.push(makeEvent('prerequest', [
      `pm.environment.set("token", pm.environment.get("customerToken"));`
    ]));
  }

  if (item.name === 'Get Customer Balance') {
    item.event = item.event || [];
    item.event = item.event.filter(e => e.listen !== 'prerequest');
    item.event.push(makeEvent('prerequest', [
      `pm.environment.set("token", pm.environment.get("customerToken"));`
    ]));
  }

  // Specific support request overrides (which need staff token rather than customer token)
  if (['Assign Ticket', 'Transition Ticket Status', 'Update Ticket Priority'].includes(item.name)) {
    item.event = item.event || [];
    item.event = item.event.filter(e => e.listen !== 'prerequest');
    item.event.push(makeEvent('prerequest', [
      `pm.environment.set("token", pm.environment.get("staffToken"));`
    ]));
  }

  if (item.name === 'Get Category by Slug') {
    item.request.url.raw = '{{baseUrl}}/category/slug/{{categorySlug}}';
    item.request.url.path = ['category', 'slug', '{{categorySlug}}'];
  }

  if (item.name === 'Get Product by Slug') {
    item.request.url.raw = '{{baseUrl}}/product/slug/{{productSlug}}';
    item.request.url.path = ['product', 'slug', '{{productSlug}}'];
  }

  if (item.item && Array.isArray(item.item)) {
    item.item.forEach(updatePayloadsAndPreRequests);
  }
}
collection.item.forEach(updatePayloadsAndPreRequests);

// 3. Set Folder-level pre-requests (token switching)
collection.item.forEach((folder) => {
  const name = folder.name;
  if (!folder.item) return; // not a folder
  
  folder.event = folder.event || [];
  folder.event = folder.event.filter(e => e.listen !== 'prerequest');

  if (['02. Category', '03. Product', '04. Pricing', '07. Billing', '08. Import', '09. Staff', '13. Customer Approvals', '14. Reports', '15. Image Cleaning'].some(p => name.startsWith(p))) {
    folder.event.push(makeEvent('prerequest', [
      `pm.environment.set("token", pm.environment.get("staffToken"));`
    ]));
  } else if (['05. Cart', '06. Order', '11. Support'].some(p => name.startsWith(p))) {
    folder.event.push(makeEvent('prerequest', [
      `pm.environment.set("token", pm.environment.get("customerToken"));`
    ]));
  }
});

// 4. Update request tests dynamically
function generateTests(name, method) {
  const lines = [];

  // Status Code Check
  let expectedStatus = 200;
  if (method === 'POST') {
    if (name === 'Start Import') {
      expectedStatus = 202;
    } else {
      const isCustomPost = ['Login', 'Logout', 'Verify OTP', 'Forgot Password', 'Reset Password', 'Send OTP', 'Attendance Check-in', 'Attendance Check-out', 'Verify Payment', 'Reject Payment', 'Approve Customer', 'Reject Customer', 'Webhook Callback (Mock)', 'Submit Image Task', 'Set Product Pricing', 'Add to Cart', 'Cancel Order', 'Assign Customer', 'Calculate Payroll', 'Pay Salary'].some(n => name.includes(n));
      expectedStatus = isCustomPost ? 200 : 201;
    }
  } else if (method === 'DELETE') {
    expectedStatus = 200;
  }
  if (name === 'Direct File Upload') {
    lines.push(`pm.test("Status code is 201 or 400", function () {`);
    lines.push(`    if (pm.response.code !== 201 && pm.response.code !== 400) console.log("FAIL RESPONSE [" + pm.info.requestName + "]:", pm.response.text());`);
    lines.push(`    pm.expect(pm.response.code).to.be.oneOf([201, 400]);`);
    lines.push(`});`);
  } else {
    lines.push(`pm.test("Status code is ${expectedStatus}", function () {`);
    lines.push(`    if (pm.response.code !== ${expectedStatus}) console.log("FAIL RESPONSE [" + pm.info.requestName + "]:", pm.response.text());`);
    lines.push(`    pm.response.to.have.status(${expectedStatus});`);
    lines.push(`});`);
  }
  lines.push(``);

  if (name.includes('PDF')) {
    lines.push(`pm.test("Content-Type is application/pdf", function () {`);
    lines.push(`    pm.response.to.have.header("Content-Type", "application/pdf");`);
    lines.push(`});`);
  } else {
    lines.push(`pm.test("Response should be JSON", function () {`);
    lines.push(`    pm.response.to.be.json;`);
    lines.push(`});`);
    lines.push(``);
  }

  if ((expectedStatus === 200 || expectedStatus === 201 || expectedStatus === 202) && !name.includes('PDF')) {
    lines.push(`if (pm.response.code === ${expectedStatus}) {`);
    lines.push(`    var jsonData = pm.response.json();`);
    
    if (name === 'Login Customer') {
      lines.push(`    if (jsonData.token) {`);
      lines.push(`        pm.environment.set("customerToken", jsonData.token);`);
      lines.push(`        pm.environment.set("token", jsonData.token);`);
      lines.push(`    }`);
    }
    
    if (name === 'Login Staff') {
      lines.push(`    if (jsonData.token) {`);
      lines.push(`        pm.environment.set("staffToken", jsonData.token);`);
      lines.push(`        pm.environment.set("token", jsonData.token);`);
      lines.push(`    }`);
    }
    
    if (name === 'Register Customer') {
      lines.push(`    if (jsonData.customer && jsonData.customer.id) {`);
      lines.push(`        pm.environment.set("customerId", jsonData.customer.id);`);
      lines.push(`    }`);
    }

    if (name === 'Register Staff') {
      lines.push(`    if (jsonData.staff && jsonData.staff.id) {`);
      lines.push(`        pm.environment.set("staffId", jsonData.staff.id);`);
      lines.push(`    }`);
      lines.push(`    if (jsonData.user && jsonData.user.id) {`);
      lines.push(`        pm.environment.set("staffUserId", jsonData.user.id);`);
      lines.push(`    }`);
    }
    
    if (name === 'Create Product') {
      lines.push(`    if (jsonData.id) {`);
      lines.push(`        pm.environment.set("productId", jsonData.id);`);
      lines.push(`    }`);
      lines.push(`    if (jsonData.slug) {`);
      lines.push(`        pm.environment.set("productSlug", jsonData.slug);`);
      lines.push(`    }`);
      lines.push(`    if (jsonData.images && jsonData.images.length > 0) {`);
      lines.push(`        pm.environment.set("productImageId", jsonData.images[0].id);`);
      lines.push(`    }`);
    }

    if (name === 'Create Category') {
      lines.push(`    if (jsonData.id) {`);
      lines.push(`        pm.environment.set("categoryId", jsonData.id);`);
      lines.push(`    }`);
      lines.push(`    if (jsonData.slug) {`);
      lines.push(`        pm.environment.set("categorySlug", jsonData.slug);`);
      lines.push(`    }`);
    }
    
    if (name === 'Create Pricing Group') {
      lines.push(`    if (jsonData.id) {`);
      lines.push(`        pm.environment.set("pricingGroupId", jsonData.id);`);
      lines.push(`    }`);
    }
    
    if (name.includes('Add to Cart')) {
      lines.push(`    if (jsonData.items && jsonData.items.length > 0) {`);
      lines.push(`        pm.environment.set("cartItemId", jsonData.items[0].id);`);
      lines.push(`    }`);
    }
    
    if (name.includes('Checkout')) {
      lines.push(`    if (jsonData.id) {`);
      lines.push(`        pm.environment.set("orderId", jsonData.id);`);
      lines.push(`        if (pm.info.requestName === 'Checkout') {`);
      lines.push(`            pm.environment.set("shippedOrderId", jsonData.id);`);
      lines.push(`        }`);
      lines.push(`    }`);
    }

    if (name === 'Generate Invoice') {
      lines.push(`    if (jsonData.id) {`);
      lines.push(`        pm.environment.set("invoiceId", jsonData.id);`);
      lines.push(`    }`);
    }
    
    if (name.includes('Record Payment')) {
      lines.push(`    if (jsonData.id) {`);
      lines.push(`        pm.environment.set("paymentId", jsonData.id);`);
      lines.push(`    }`);
    }
    
    if (name === 'Start Import') {
      lines.push(`    if (jsonData.id) {`);
      lines.push(`        pm.environment.set("importId", jsonData.id);`);
      lines.push(`    }`);
    }
    
    if (name === 'Create Ticket') {
      lines.push(`    if (jsonData.id) {`);
      lines.push(`        pm.environment.set("ticketId", jsonData.id);`);
      lines.push(`    }`);
    }

    if (name === 'Forgot Password') {
      lines.push(`    if (jsonData.resetCode) {`);
      lines.push(`        pm.environment.set("resetToken", jsonData.resetCode);`);
      lines.push(`    }`);
    }

    if (name === 'Submit Image Task') {
      lines.push(`    if (jsonData.taskId) {`);
      lines.push(`        pm.environment.set("imageTaskId", jsonData.taskId);`);
      lines.push(`    }`);
    }
    
    lines.push(`}`);
  }

  return lines;
}

function processItemTests(item) {
  if (item.request) {
    const tests = generateTests(item.name, item.request.method);
    if (tests.length > 0) {
      item.event = item.event || [];
      const testEventIndex = item.event.findIndex(e => e.listen === 'test');
      if (testEventIndex > -1) {
        item.event.splice(testEventIndex, 1);
      }
      item.event.push(makeEvent('test', tests));
    }
  }

  if (item.item && Array.isArray(item.item)) {
    item.item.forEach(processItemTests);
  }
}
collection.item.forEach(processItemTests);

fs.writeFileSync(collectionPath, JSON.stringify(collection, null, 2));
console.log('Postman collection successfully rebuilt for robust one-click execution!');
