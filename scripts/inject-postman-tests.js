const fs = require('fs');
const path = require('path');

const collectionPath = path.join(__dirname, '../Little-Souls-B2B.postman_collection.json');
const collection = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));

// Helper to construct Postman script event block
function makeTestEvent(lines) {
  return {
    listen: 'test',
    script: {
      exec: lines,
      type: 'text/javascript'
    }
  };
}

// Generate test code based on request name and method
function generateTests(name, method) {
  const lines = [];

  // 1. Status Code Check
  let expectedStatus = 200;
  if (method === 'POST') {
    // Standard POSTs return 201 Created in NestJS unless customized (like Login or webhooks)
    const isCustomPost = ['Login', 'Logout', 'Verify OTP', 'Forgot Password', 'Reset Password', 'Send OTP', 'Attendance Check-in', 'Attendance Check-out', 'Verify Payment', 'Reject Payment', 'Approve Customer', 'Reject Customer', 'Webhook Callback (Mock)', 'Submit Image Task'].some(n => name.includes(n));
    expectedStatus = isCustomPost ? 200 : 201;
  } else if (method === 'DELETE') {
    expectedStatus = 200;
  }

  lines.push(`pm.test("Status code is ${expectedStatus}", function () {`);
  lines.push(`    pm.response.to.have.status(${expectedStatus});`);
  lines.push(`});`);
  lines.push(``);

  // 2. Format / Header Check
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

  // 3. Extract environment/session variables automatically on success
  if (expectedStatus === 200 || expectedStatus === 201) {
    lines.push(`if (pm.response.code === ${expectedStatus}) {`);
    lines.push(`    var jsonData = pm.response.json();`);
    
    // Auth Token extraction
    if (name === 'Login' || name === 'Verify OTP') {
      lines.push(`    if (jsonData.token) {`);
      lines.push(`        pm.environment.set("token", jsonData.token);`);
      lines.push(`    }`);
    }
    
    // Customer ID extraction
    if (name === 'Register Customer') {
      lines.push(`    if (jsonData.customer && jsonData.customer.id) {`);
      lines.push(`        pm.environment.set("customerId", jsonData.customer.id);`);
      lines.push(`    }`);
    }
    
    // Product ID extraction
    if (name === 'Create Product') {
      lines.push(`    if (jsonData.id) {`);
      lines.push(`        pm.environment.set("productId", jsonData.id);`);
      lines.push(`    }`);
    }

    // Category ID extraction
    if (name === 'Create Category') {
      lines.push(`    if (jsonData.id) {`);
      lines.push(`        pm.environment.set("categoryId", jsonData.id);`);
      lines.push(`    }`);
    }
    
    // Pricing Group ID extraction
    if (name === 'Create Pricing Group') {
      lines.push(`    if (jsonData.id) {`);
      lines.push(`        pm.environment.set("pricingGroupId", jsonData.id);`);
      lines.push(`    }`);
    }
    
    // Cart Item ID extraction
    if (name === 'Add to Cart') {
      lines.push(`    if (jsonData.items && jsonData.items.length > 0) {`);
      lines.push(`        pm.environment.set("cartItemId", jsonData.items[0].id);`);
      lines.push(`    }`);
    }
    
    // Order ID extraction
    if (name === 'Checkout') {
      lines.push(`    if (jsonData.id) {`);
      lines.push(`        pm.environment.set("orderId", jsonData.id);`);
      lines.push(`    }`);
    }
    
    // Payment ID extraction
    if (name === 'Record Payment') {
      lines.push(`    if (jsonData.id) {`);
      lines.push(`        pm.environment.set("paymentId", jsonData.id);`);
      lines.push(`    }`);
    }
    
    // Import ID extraction
    if (name === 'Start Import') {
      lines.push(`    if (jsonData.id) {`);
      lines.push(`        pm.environment.set("importId", jsonData.id);`);
      lines.push(`    }`);
    }
    
    // Supplier ID extraction
    if (name === 'Create Supplier') {
      lines.push(`    if (jsonData.id) {`);
      lines.push(`        pm.environment.set("supplierId", jsonData.id);`);
      lines.push(`    }`);
    }
    
    // Purchase Order ID extraction
    if (name === 'Create Purchase Order') {
      lines.push(`    if (jsonData.id) {`);
      lines.push(`        pm.environment.set("poId", jsonData.id);`);
      lines.push(`    }`);
    }
    
    // Support Ticket ID extraction
    if (name === 'Create Ticket') {
      lines.push(`    if (jsonData.id) {`);
      lines.push(`        pm.environment.set("ticketId", jsonData.id);`);
      lines.push(`    }`);
    }
    
    lines.push(`}`);
  }

  return lines;
}

// Recursive function to process collection items
function processItem(item) {
  if (item.request) {
    const tests = generateTests(item.name, item.request.method);
    if (tests.length > 0) {
      // Find and remove existing test event if it exists
      if (!item.event) {
        item.event = [];
      }
      const testEventIndex = item.event.findIndex(e => e.listen === 'test');
      if (testEventIndex > -1) {
        item.event.splice(testEventIndex, 1);
      }
      item.event.push(makeTestEvent(tests));
    }
  }

  if (item.item && Array.isArray(item.item)) {
    item.item.forEach(processItem);
  }
}

// Traverse the whole collection
collection.item.forEach(processItem);

fs.writeFileSync(collectionPath, JSON.stringify(collection, null, 2));
console.log('Postman collection successfully updated with programmatic tests!');
