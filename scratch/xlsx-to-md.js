const ExcelJS = require('exceljs');
const path = require('path');

async function main() {
  const xlsxPath = '/Users/user/.gemini/antigravity-ide/brain/dca7efd6-cdcf-4f2f-9b93-8035f9b5e953/products.xlsx';
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(xlsxPath);
  const sheet = workbook.worksheets[0];

  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    // Get values of all cells
    const vals = [];
    row.eachCell((cell) => {
      vals.push(cell.value);
    });
    // We only care about key columns for the summary table:
    // Col 1: Product Image (url string)
    // Col 3: Product ID
    // Col 4: SKU
    // Col 5: Name
    // Col 8: Price
    // Col 9: Discounted Price
    // Col 10: Stock
    // Col 12: MOQ
    if (rowNumber === 1) {
      rows.push(['SKU', 'Product Name', 'Price', 'Discounted Price', 'Stock Qty', 'MOQ', 'System ID']);
    } else {
      const getVal = (colIdx) => {
        const cell = row.getCell(colIdx);
        if (!cell || cell.value === null || cell.value === undefined) return '';
        if (typeof cell.value === 'object') {
          return cell.value.result || cell.value.text || '';
        }
        return cell.value.toString();
      };
      rows.push([
        getVal(4), // SKU
        getVal(5), // Name
        getVal(8), // Price
        getVal(9), // Discounted Price
        getVal(10), // Stock
        getVal(12), // MOQ
        getVal(3)  // ID
      ]);
    }
  });

  // Print Markdown table
  const colWidths = rows[0].map((_, colIdx) => Math.max(...rows.map(r => r[colIdx].length)));
  
  rows.forEach((row, rowIndex) => {
    const formattedRow = row.map((cell, colIdx) => cell.padEnd(colWidths[colIdx])).join(' | ');
    console.log(`| ${formattedRow} |`);
    if (rowIndex === 0) {
      const separator = colWidths.map(w => '-'.repeat(w)).join(' | ');
      console.log(`| ${separator} |`);
    }
  });
}

main().catch(console.error);
