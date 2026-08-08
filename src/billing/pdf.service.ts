import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import PDFDocument = require('pdfkit');

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Fetch an image URL and return it as a Buffer.
   * Returns null if the image cannot be fetched (silently fails so PDF still generates).
   */
  private async fetchImageBuffer(url: string): Promise<Buffer | null> {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 5000,
        headers: { 'Cache-Control': 'no-cache' },
      });
      return Buffer.from(response.data);
    } catch (err) {
      this.logger.warn(`Could not fetch product image from ${url}: ${err}`);
      return null;
    }
  }

  async generateInvoicePdf(invoice: any): Promise<Buffer> {
    const settings = await this.prisma.setting.findFirst().catch(() => null);
    const businessName = settings?.businessName || 'Little Souls';
    const companyAddress = settings?.companyAddress || '';
    const companyGstin =
      (settings as any)?.companyGstin || (settings as any)?.gstin || '';

    let logoBuffer: Buffer | null = null;
    if (settings?.businessLogoUrl) {
      let logoUrl = settings.businessLogoUrl;
      if (logoUrl.startsWith('/uploads/')) {
        const r2Public = (
          this.configService.get<string>('R2_PUBLIC_URL') || ''
        ).replace(/\/+$/, '');
        logoUrl = r2Public ? `${r2Public}${logoUrl}` : logoUrl;
      }
      logoBuffer = await this.fetchImageBuffer(logoUrl);
    }

    // Pre-fetch all product images before starting PDF (async, outside promise)
    const itemsWithImages = await Promise.all(
      (invoice.items || []).map(async (item: any) => {
        const imageUrl = item.productImageUrl || null;
        const imageBuffer = imageUrl
          ? await this.fetchImageBuffer(imageUrl)
          : null;
        return { ...item, imageBuffer };
      }),
    );

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // ─── HEADER ───────────────────────────────────────────────────────────────
      doc
        .fontSize(22)
        .font('Helvetica-Bold')
        .fillColor('#9c5e43')
        .text('INVOICE', { align: 'right' });

      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#555555')
        .text(`Invoice No: ${invoice.invoiceNumber}`, { align: 'right' })
        .text(
          `Date:       ${new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}`,
          { align: 'right' },
        )
        .text(
          `Due Date:   ${new Date(invoice.dueDate).toLocaleDateString('en-IN')}`,
          { align: 'right' },
        )
        .text(`Status:     ${invoice.paymentStatus}`, { align: 'right' });

      // ─── COMPANY INFO / LOGO ───────────────────────────────────────────────────
      if (logoBuffer) {
        try {
          doc.image(logoBuffer, 50, 40, { fit: [140, 36] });
        } catch {
          doc
            .fontSize(16)
            .font('Helvetica-Bold')
            .fillColor('#9c5e43')
            .text(businessName, 50, 45);
        }
      } else {
        doc
          .fontSize(16)
          .font('Helvetica-Bold')
          .fillColor('#9c5e43')
          .text(businessName, 50, 45);
      }

      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#555555');

      if (companyAddress) {
        doc.text(companyAddress, 50, 68);
      }
      if (companyGstin) {
        doc.text(`GSTIN: ${companyGstin}`, 50, companyAddress ? 80 : 68);
      }

      // Separator line
      doc.moveDown(3);
      const sepY = doc.y;
      doc
        .moveTo(50, sepY)
        .lineTo(550, sepY)
        .strokeColor('#dddddd')
        .lineWidth(0.5)
        .stroke();
      doc.moveDown(1);

      // ─── BILL TO / SHIP TO ────────────────────────────────────────────────────
      const addrY = doc.y;

      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#888888')
        .text('BILL TO', 50, addrY);
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#404040')
        .text(
          invoice.customer?.businessName || 'Customer',
          50,
          addrY + 12,
        );
      doc.font('Helvetica').fontSize(9).fillColor('#555555');
      if (invoice.gstin) {
        doc.text(`GSTIN: ${invoice.gstin}`, 50, doc.y);
      }
      if (invoice.billingAddress) {
        doc.text(invoice.billingAddress, 50, doc.y, { width: 220 });
      }

      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#888888')
        .text('SHIP TO', 300, addrY);
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#555555')
        .text(
          invoice.shippingAddress || invoice.billingAddress || 'Same as billing',
          300,
          addrY + 12,
          { width: 220 },
        );

      // ─── TABLE ────────────────────────────────────────────────────────────────
      const tableStartY = Math.max(doc.y, addrY + 80) + 15;
      const ROW_HEIGHT = 44;
      const IMG_SIZE = 36;
      const COL = {
        img: 50,
        sku: 100,
        name: 185,
        qty: 355,
        price: 405,
        total: 475,
      };

      // Table header background
      doc.rect(50, tableStartY, 500, 18).fill('#9c5e43');

      doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
      doc.text('Img', COL.img, tableStartY + 5, { width: 45 });
      doc.text('SKU', COL.sku, tableStartY + 5, { width: 80 });
      doc.text('Product', COL.name, tableStartY + 5, { width: 165 });
      doc.text('Qty', COL.qty, tableStartY + 5, {
        width: 45,
        align: 'right',
      });
      doc.text('Price', COL.price, tableStartY + 5, {
        width: 45,
        align: 'right',
      });
      doc.text('Total', COL.total, tableStartY + 5, {
        width: 65,
        align: 'right',
      });

      // Table rows
      let currentY = tableStartY + 20;

      itemsWithImages.forEach((item: any, idx: number) => {
        // Zebra striping
        if (idx % 2 === 0) {
          doc.rect(50, currentY, 500, ROW_HEIGHT).fill('#fdf6f2');
        }

        // Product image
        if (item.imageBuffer) {
          try {
            doc.image(item.imageBuffer, COL.img + 1, currentY + 4, {
              width: IMG_SIZE,
              height: IMG_SIZE,
            });
          } catch (e) {
            this.logger.warn(
              `Could not embed image for item ${item.sku}: ${e}`,
            );
            // Draw grey placeholder
            doc
              .rect(COL.img + 1, currentY + 4, IMG_SIZE, IMG_SIZE)
              .fill('#eeeeee');
          }
        } else {
          // Grey placeholder box
          doc
            .rect(COL.img + 1, currentY + 4, IMG_SIZE, IMG_SIZE)
            .fill('#eeeeee');
        }

        // Trim name
        const name =
          item.productName && item.productName.length > 35
            ? item.productName.substring(0, 35) + '...'
            : item.productName || 'Unknown';

        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#404040')
          .text(item.sku || '-', COL.sku, currentY + 14, { width: 80 })
          .text(name, COL.name, currentY + 14, { width: 165 })
          .text(String(item.quantity), COL.qty, currentY + 14, {
            width: 45,
            align: 'right',
          })
          .text(
            `Rs. ${Number(item.price).toFixed(2)}`,
            COL.price,
            currentY + 14,
            { width: 45, align: 'right' },
          )
          .text(
            `Rs. ${Number(item.lineTotal).toFixed(2)}`,
            COL.total,
            currentY + 14,
            { width: 65, align: 'right' },
          );

        // Row separator
        doc
          .moveTo(50, currentY + ROW_HEIGHT)
          .lineTo(550, currentY + ROW_HEIGHT)
          .strokeColor('#e8e0db')
          .lineWidth(0.3)
          .stroke();

        currentY += ROW_HEIGHT;

        // New page if needed
        if (currentY > 700) {
          doc.addPage();
          currentY = 50;
        }
      });

      // ─── TOTALS ───────────────────────────────────────────────────────────────
      currentY += 10;

      doc.font('Helvetica').fontSize(9).fillColor('#555555');

      const totalsX = 370;
      const valX = 480;

      doc.text('Subtotal:', totalsX, currentY);
      doc.text(`Rs. ${Number(invoice.subTotal).toFixed(2)}`, valX, currentY, {
        width: 70,
        align: 'right',
      });
      currentY += 16;

      if (Number(invoice.discountTotal) > 0) {
        doc.text('Discount:', totalsX, currentY);
        doc.text(
          `- Rs. ${Number(invoice.discountTotal).toFixed(2)}`,
          valX,
          currentY,
          { width: 70, align: 'right' },
        );
        currentY += 16;
      }

      if (Number(invoice.taxTotal) > 0) {
        doc.text('Tax (GST):', totalsX, currentY);
        doc.text(
          `Rs. ${Number(invoice.taxTotal).toFixed(2)}`,
          valX,
          currentY,
          { width: 70, align: 'right' },
        );
        currentY += 16;
      }

      if (Number(invoice.shippingCharge) > 0) {
        doc.text('Shipping:', totalsX, currentY);
        doc.text(
          `Rs. ${Number(invoice.shippingCharge).toFixed(2)}`,
          valX,
          currentY,
          { width: 70, align: 'right' },
        );
        currentY += 16;
      }

      doc
        .moveTo(totalsX, currentY)
        .lineTo(550, currentY)
        .strokeColor('#9c5e43')
        .lineWidth(0.7)
        .stroke();
      currentY += 8;

      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#9c5e43')
        .text('Grand Total:', totalsX, currentY)
        .text(`Rs. ${Number(invoice.grandTotal).toFixed(2)}`, valX, currentY, {
          width: 70,
          align: 'right',
        });

      // ─── FOOTER ───────────────────────────────────────────────────────────────
      doc
        .fontSize(8)
        .font('Helvetica-Oblique')
        .fillColor('#aaaaaa')
        .text(
          'This is a computer-generated document. No signature is required.',
          50,
          750,
          { align: 'center', width: 500 },
        )
        .text('Thank you for your business!', 50, 762, {
          align: 'center',
          width: 500,
        });

      doc.end();
    });
  }
}
