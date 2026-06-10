const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { randomUUID } = require('crypto');
const bwipjs = require('bwip-js');
require('dotenv').config();

// ── R2 upload helper ──────────────────────────────────────────────
function createR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const endpoint = accountId && accountId.startsWith('http') ? accountId : `https://${accountId}.r2.cloudflarestorage.com`;
  return new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });
}

async function uploadBuffer(s3, buffer, mimetype, originalname) {
  const sanitizedName = originalname.replace(/[^a-zA-Z0-9.]/g, '_').replace(/__+/g, '_');
  const key = `uploads/${randomUUID()}_${sanitizedName}`;
  await s3.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: mimetype,
  }));
  const basePublicUrl = process.env.R2_PUBLIC_URL.replace(/\/+$/, '');
  return `${basePublicUrl}/${key}`;
}

// ── Barcode generation ────────────────────────────────────────────
async function generateBarcode(sku) {
  return bwipjs.toBuffer({
    bcid: 'code128',
    text: sku,
    scale: 3,
    height: 10,
    includetext: true,
    textxalign: 'center',
  });
}

// ── Slug helper ───────────────────────────────────────────────────
function slugify(text) {
  return text.toString().toLowerCase().trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ── Parse the markdown ────────────────────────────────────────────
function parseMd(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  // Table 1 data rows: lines 3-10, 14, 16-21 (1-indexed)
  const t1DataLines = [3,4,5,6,7,8,9,10, 14, 16,17,18,19,20,21];
  // Table 3 (picture urls): lines 49-56, 59, 61-66 (1-indexed)
  const t3DataLines = [49,50,51,52,53,54,55,56, 59, 61,62,63,64,65,66];

  const products = [];
  for (let idx = 0; idx < t1DataLines.length; idx++) {
    const t1Line = lines[t1DataLines[idx] - 1];
    const t3Line = lines[t3DataLines[idx] - 1];
    if (!t1Line) continue;

    const t1Parts = t1Line.split('|').map(p => p.trim());
    // t1Parts: [empty, ProductImage, BarcodeImage, ProductId, ProductName, Sku, ProductPrice, Barcode, empty]
    const sku = t1Parts[5];
    const name = t1Parts[4];
    const price = parseFloat(t1Parts[6]);
    const barcode = t1Parts[7] || sku;

    // Extract picture URL from table 3
    let pictureUrl = null;
    if (t3Line) {
      const t3Parts = t3Line.split('|').map(p => p.trim());
      // t3Parts: [empty, description, pictureUrl, ...]
      pictureUrl = t3Parts[2] || null;
    }

    products.push({ sku, name, price: isNaN(price) ? 0 : price, barcode, pictureUrl });
  }
  return products;
}

// ── Main ──────────────────────────────────────────────────────────
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  const s3 = createR2Client();

  await prisma.$connect();

  const CATALOGUE_ID = '4d974dd6-4876-4ec0-a5dd-296e5efa7a73';
  const CATEGORY_ID = 'feaa26a7-2705-44c5-9ce7-b60cd528f3de'; // Uncategorized

  const mdPath = '/Users/user/Raj/little-souls-flow/Catalogue-177935900645276.md';
  const products = parseMd(mdPath);
  console.log(`Parsed ${products.length} products from Markdown`);

  for (const item of products) {
    // Check if product already exists by SKU
    const existing = await prisma.product.findUnique({ where: { sku: item.sku } });
    if (existing) {
      console.log(`⏩ SKU ${item.sku} already exists (id: ${existing.id}), skipping creation`);
      continue;
    }

    // 1. Generate barcode image and upload to R2
    let barcodeUrl = null;
    try {
      const barcodeBuffer = await generateBarcode(item.sku);
      barcodeUrl = await uploadBuffer(s3, barcodeBuffer, 'image/png', `${item.sku}_barcode.png`);
      console.log(`  ✅ Barcode uploaded: ${barcodeUrl}`);
    } catch (err) {
      console.error(`  ❌ Barcode generation failed for ${item.sku}:`, err.message);
    }

    // 2. Create the product
    const slug = `${slugify(item.name)}-${slugify(item.sku)}`;
    const product = await prisma.product.create({
      data: {
        sku: item.sku,
        name: item.name,
        slug,
        productPrice: item.price,
        barcode: item.barcode,
        barcodeUrl,
        productPictureUrl: item.pictureUrl,
        productImage: item.pictureUrl,
        description: null,
        stockQuantity: 100,
        stockStatus: 'IN_STOCK',
        isActive: true,
        moq: 1,
        categoryId: CATEGORY_ID,
        catalogueId: CATALOGUE_ID,
      },
    });
    console.log(`  ✅ Created product: ${product.name} (SKU: ${product.sku}, ID: ${product.id})`);

    // 3. Create ProductImage record if picture URL exists
    if (item.pictureUrl) {
      await prisma.productImage.create({
        data: {
          productId: product.id,
          originalUrl: item.pictureUrl,
          isPrimary: true,
          sortOrder: 0,
          cleaningStatus: 'NOT_REQUIRED',
        },
      });
      console.log(`  ✅ ProductImage created for ${product.sku}`);
    }
  }

  // Final check
  const cat = await prisma.catalogue.findFirst({
    where: { id: CATALOGUE_ID },
    include: { products: true },
  });
  console.log(`\n🎉 Done! Catalogue "${cat.name}" now has ${cat.products.length} products.`);

  await prisma.$disconnect();
  pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
