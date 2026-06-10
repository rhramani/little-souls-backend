const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
require('dotenv').config();

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  await prisma.$connect();

  // 1. Fetch products of catalogue
  const cat = await prisma.catalogue.findFirst({ where: { name: 'baby cap' }, include: { products: true } });
  if (!cat) {
    console.error('Catalogue not found');
    await prisma.$disconnect();
    return;
  }

  const prodMap = new Map();
  cat.products.forEach(p => {
    prodMap.set(p.id, p);
    prodMap.set(p.sku, p);
  });

  // 2. Read Catalogue.md
  const mdPath = '/Users/user/Raj/little-souls-flow/Catalogue-177935900645276.md';
  const content = fs.readFileSync(mdPath, 'utf8');
  const lines = content.split('\n');

  const newLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    if (lineNum === 1) {
      // Header line of Table 1
      newLines.push('|**Product Image**|**Barcode Image**|**Product id**|**Product Name**|**Sku**|**Product Price**|**Barcode**|');
    } else if (lineNum === 2) {
      // Separator line of Table 1
      newLines.push('| - | - | - | - | - | - | - |');
    } else if (lineNum >= 3 && lineNum <= 24) {
      // Table 1 data rows
      if (!line.trim() || line.trim() === '|-|' || line.startsWith('| - |')) {
        newLines.push(line);
        continue;
      }
      const parts = line.split('|').map(p => p.trim());
      // parts[0] is empty, parts[1] is image, parts[2] is id, parts[3] is name, parts[4] is sku, parts[5] is price
      const id = parts[2];
      const sku = parts[4];

      const p = prodMap.get(id) || prodMap.get(sku);
      if (p) {
        const barcodeImg = p.barcodeUrl ? `![barcode](${p.barcodeUrl})` : '';
        const barcodeVal = p.barcode || p.sku || '';
        // Construct new row
        newLines.push(`| ${parts[1]} | ${barcodeImg} | ${parts[2]} | ${parts[3]} | ${parts[4]} | ${parts[5]} | ${barcodeVal} |`);
      } else {
        // Fallback if not found in db
        newLines.push(`| ${parts[1]} | | ${parts[2]} | ${parts[3]} | ${parts[4]} | ${parts[5]} | |`);
      }
    } else {
      // Rest of the tables remain unchanged
      newLines.push(line);
    }
  }

  // Write back to file
  fs.writeFileSync(mdPath, newLines.join('\n'), 'utf8');
  console.log('Markdown file updated successfully!');

  await prisma.$disconnect();
}

main().catch(console.error);
