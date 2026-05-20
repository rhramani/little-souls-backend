const fs = require('fs');
const path = require('path');

const collectionPath = path.join(__dirname, '../Little-Souls-B2B.postman_collection.json');
const collectionRaw = fs.readFileSync(collectionPath, 'utf8');
const collection = JSON.parse(collectionRaw);

function createRequest(name, method, urlPath, bodyContent) {
  const req = {
    name,
    request: {
      method,
      header: [
        { key: 'Authorization', value: 'Bearer {{token}}', type: 'text' },
        { key: 'Content-Type', value: 'application/json', type: 'text' }
      ],
      url: {
        raw: `{{baseUrl}}/${urlPath}`,
        host: ['{{baseUrl}}'],
        path: urlPath.split('/')
      }
    },
    response: []
  };
  
  if (method === 'POST' || method === 'PATCH' || method === 'PUT') {
    req.request.body = {
      mode: 'raw',
      raw: bodyContent || '{\n\n}'
    };
  }
  
  return req;
}

// 01. Auth
const authFolder = collection.item.find(i => i.name === '01. Auth');
if (authFolder && !authFolder.item.find(i => i.name === 'Send OTP')) {
  authFolder.item.push(
    createRequest('Send OTP', 'POST', 'auth/otp/send', '{\n  "mobile": "9876543210"\n}'),
    createRequest('Verify OTP', 'POST', 'auth/otp/verify', '{\n  "mobile": "9876543210",\n  "otp": "123456"\n}')
  );
}

// 03. Product
const productFolder = collection.item.find(i => i.name === '03. Product');
if (productFolder && !productFolder.item.find(i => i.name === 'Add Product Video')) {
  productFolder.item.push(
    createRequest('Add Product Video', 'POST', 'product/{{productId}}/video', '{\n  "videoUrl": "https://youtube.com/watch?v=123",\n  "videoType": "PRODUCT_VIDEO",\n  "title": "Unboxing Video",\n  "thumbnailUrl": "https://img.youtube.com/vi/123/0.jpg"\n}'),
    createRequest('Add Product Catalog', 'POST', 'product/{{productId}}/catalog', '{\n  "title": "Summer Collection 2026",\n  "fileUrl": "https://s3.aws.com/bucket/catalog.pdf",\n  "fileType": "PDF"\n}')
  );
}

// 06. Order
const orderFolder = collection.item.find(i => i.name === '06. Order');
if (orderFolder && !orderFolder.item.find(i => i.name === 'Pack Order')) {
  orderFolder.item.push(
    createRequest('Approve Backorder', 'PATCH', 'order/{{orderId}}/backorder/approve', ''),
    createRequest('Pack Order', 'POST', 'order/{{orderId}}/pack', '{\n  "boxes": 2,\n  "weight": 15.5,\n  "notes": "Fragile items packed carefully"\n}'),
    createRequest('Ship Order', 'POST', 'order/{{orderId}}/ship', '{\n  "courierName": "FedEx",\n  "trackingNumber": "1234567890",\n  "trackingUrl": "https://fedex.com/track/1234567890",\n  "estimatedDeliveryDate": "2026-06-01T00:00:00.000Z"\n}')
  );
}

// 07. Billing
const billingFolder = collection.item.find(i => i.name === '07. Billing');
if (billingFolder && !billingFolder.item.find(i => i.name === 'Create Credit Note')) {
  billingFolder.item.push(
    createRequest('Create Credit Note', 'POST', 'billing/ledger/credit-note', '{\n  "customerId": "{{customerId}}",\n  "amount": 500,\n  "reason": "Returned damaged goods"\n}'),
    createRequest('Create Debit Note', 'POST', 'billing/ledger/debit-note', '{\n  "customerId": "{{customerId}}",\n  "amount": 150,\n  "reason": "Extra shipping charges"\n}')
  );
}

// 09. Staff
const staffFolder = collection.item.find(i => i.name === '09. Staff');
if (staffFolder && !staffFolder.item.find(i => i.name === 'Attendance Check-in')) {
  staffFolder.item.push(
    createRequest('Attendance Check-in', 'POST', 'staff/attendance/check-in', '{\n  "latitude": 19.0760,\n  "longitude": 72.8777,\n  "photoUrl": "https://s3.aws.com/bucket/selfie.jpg"\n}'),
    createRequest('Attendance Check-out', 'POST', 'staff/attendance/check-out', '{\n  "latitude": 19.0765,\n  "longitude": 72.8770,\n  "notes": "Left early for meeting"\n}'),
    createRequest('Calculate Payroll', 'POST', 'staff/payroll/calculate/{{staffId}}', '{\n  "month": 5,\n  "year": 2026\n}')
  );
}

// 14. Reports
let reportFolder = collection.item.find(i => i.name === '14. Reports');
if (!reportFolder) {
  reportFolder = { name: '14. Reports', item: [] };
  collection.item.push(reportFolder);
}
if (!reportFolder.item.find(i => i.name === 'Sales Report')) {
  reportFolder.item.push(
    createRequest('Sales Report', 'GET', 'report/sales?startDate=2026-05-01&endDate=2026-05-31'),
    createRequest('Outstanding Report', 'GET', 'report/outstanding'),
    createRequest('Attendance Report', 'GET', 'report/attendance?startDate=2026-05-01&endDate=2026-05-31')
  );
}

// 15. Image Cleaning
let imageCleaningFolder = collection.item.find(i => i.name === '15. Image Cleaning');
if (!imageCleaningFolder) {
  imageCleaningFolder = { name: '15. Image Cleaning', item: [] };
  collection.item.push(imageCleaningFolder);
}
if (!imageCleaningFolder.item.find(i => i.name === 'Submit Image Task')) {
  imageCleaningFolder.item.push(
    createRequest('Submit Image Task', 'POST', 'image-cleaning/submit', '{\n  "productImageId": "uuid-of-product-image"\n}'),
    createRequest('Webhook Callback (Mock)', 'POST', 'image-cleaning/webhook', '{\n  "taskId": "uuid-of-task",\n  "status": "COMPLETED",\n  "cleanedUrl": "https://s3.aws.com/bucket/cleaned.png"\n}')
  );
}

// 12. Upload - Add Direct Upload
const uploadFolder = collection.item.find(i => i.name.includes('Upload') || i.name.includes('12.'));
if (uploadFolder && !uploadFolder.item.find(i => i.name === 'Direct File Upload')) {
  const directUploadRequest = {
    name: 'Direct File Upload',
    request: {
      method: 'POST',
      header: [
        { key: 'Authorization', value: 'Bearer {{token}}', type: 'text' }
      ],
      body: {
        mode: 'formdata',
        formdata: [
          {
            key: 'file',
            type: 'file',
            src: []
          }
        ]
      },
      url: {
        raw: '{{baseUrl}}/upload',
        host: ['{{baseUrl}}'],
        path: ['upload']
      }
    },
    response: []
  };
  uploadFolder.item.push(directUploadRequest);
}

fs.writeFileSync(collectionPath, JSON.stringify(collection, null, 2));
console.log('Postman collection updated successfully!');
