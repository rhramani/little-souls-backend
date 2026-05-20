import { Injectable } from '@nestjs/common';
import PDFDocument = require('pdfkit');

@Injectable()
export class PdfService {
  async generateInvoicePdf(invoice: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
      doc.on('error', reject);

      // Header
      doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .text('INVOICE', { align: 'right' });
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(`Invoice Number: ${invoice.invoiceNumber}`, { align: 'right' })
        .text(`Date: ${invoice.invoiceDate.toLocaleDateString()}`, { align: 'right' })
        .text(`Due Date: ${invoice.dueDate.toLocaleDateString()}`, { align: 'right' })
        .text(`Status: ${invoice.paymentStatus}`, { align: 'right' });

      // Company Info (Hardcoded for Little Souls)
      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .text('Little Souls B2B', 50, 50);
      doc
        .fontSize(10)
        .font('Helvetica')
        .text('123 Wholesale Street', 50, 70)
        .text('Mumbai, India 400001', 50, 85)
        .text('GSTIN: 27AABCU9603R1ZM', 50, 100);

      doc.moveDown(3);

      // Bill To
      doc.font('Helvetica-Bold').text('Bill To:');
      doc.font('Helvetica').text(invoice.customer.businessName);
      if (invoice.gstin) {
        doc.text(`GSTIN: ${invoice.gstin}`);
      }
      if (invoice.billingAddress) {
        doc.text(invoice.billingAddress);
      }

      // Ship To
      doc.moveDown();
      doc.font('Helvetica-Bold').text('Ship To:');
      doc.font('Helvetica').text(invoice.shippingAddress || invoice.billingAddress || 'N/A');

      doc.moveDown(3);

      // Table Header
      const tableTop = doc.y;
      doc.font('Helvetica-Bold');
      doc.text('SKU', 50, tableTop);
      doc.text('Product Name', 120, tableTop);
      doc.text('Qty', 350, tableTop);
      doc.text('Price', 400, tableTop);
      doc.text('Total', 480, tableTop, { align: 'right' });

      doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

      // Table Rows
      let currentY = tableTop + 25;
      doc.font('Helvetica');

      invoice.items.forEach((item: any) => {
        doc.text(item.sku, 50, currentY);
        // Trim name if too long
        const name = item.productName.length > 30 ? item.productName.substring(0, 30) + '...' : item.productName;
        doc.text(name, 120, currentY);
        doc.text(item.quantity.toString(), 350, currentY);
        doc.text(item.price.toFixed(2), 400, currentY);
        doc.text(item.lineTotal.toFixed(2), 480, currentY, { align: 'right' });
        currentY += 20;

        // Add a new page if we run out of space
        if (currentY > 700) {
          doc.addPage();
          currentY = 50;
        }
      });

      doc.moveTo(50, currentY).lineTo(550, currentY).stroke();
      currentY += 15;

      // Totals
      doc.font('Helvetica-Bold');
      doc.text('Subtotal:', 400, currentY);
      doc.text(invoice.subTotal.toFixed(2), 480, currentY, { align: 'right' });
      currentY += 20;

      if (invoice.discountTotal > 0) {
        doc.text('Discount:', 400, currentY);
        doc.text(`-${invoice.discountTotal.toFixed(2)}`, 480, currentY, { align: 'right' });
        currentY += 20;
      }

      doc.text('Tax (GST):', 400, currentY);
      doc.text(invoice.taxTotal.toFixed(2), 480, currentY, { align: 'right' });
      currentY += 20;

      doc.text('Shipping:', 400, currentY);
      doc.text(invoice.shippingCharge.toFixed(2), 480, currentY, { align: 'right' });
      currentY += 20;

      doc.moveTo(400, currentY).lineTo(550, currentY).stroke();
      currentY += 10;

      doc.fontSize(12);
      doc.text('Grand Total:', 380, currentY);
      doc.text(`Rs. ${invoice.grandTotal.toFixed(2)}`, 480, currentY, { align: 'right' });

      // Footer
      doc.fontSize(10).font('Helvetica-Oblique').text('Thank you for your business!', 50, 750, { align: 'center', width: 500 });

      doc.end();
    });
  }
}
