"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var PdfService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdfService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const config_1 = require("@nestjs/config");
const axios_1 = __importDefault(require("axios"));
const PDFDocument = require("pdfkit");
let PdfService = PdfService_1 = class PdfService {
    prisma;
    configService;
    logger = new common_1.Logger(PdfService_1.name);
    constructor(prisma, configService) {
        this.prisma = prisma;
        this.configService = configService;
    }
    async fetchImageBuffer(url) {
        try {
            const response = await axios_1.default.get(url, {
                responseType: 'arraybuffer',
                timeout: 5000,
                headers: { 'Cache-Control': 'no-cache' },
            });
            return Buffer.from(response.data);
        }
        catch (err) {
            this.logger.warn(`Could not fetch product image from ${url}: ${err}`);
            return null;
        }
    }
    async generateInvoicePdf(invoice) {
        const settings = await this.prisma.setting.findFirst().catch(() => null);
        const businessName = settings?.businessName || 'Little Souls';
        const companyAddress = settings?.companyAddress || '';
        const companyGstin = settings?.companyGstin || settings?.gstin || '';
        let logoBuffer = null;
        if (settings?.businessLogoUrl) {
            let logoUrl = settings.businessLogoUrl;
            if (logoUrl.startsWith('/uploads/')) {
                const r2Public = (this.configService.get('R2_PUBLIC_URL') || '').replace(/\/+$/, '');
                logoUrl = r2Public ? `${r2Public}${logoUrl}` : logoUrl;
            }
            logoBuffer = await this.fetchImageBuffer(logoUrl);
        }
        const itemsWithImages = await Promise.all((invoice.items || []).map(async (item) => {
            const imageUrl = item.productImageUrl || null;
            const imageBuffer = imageUrl
                ? await this.fetchImageBuffer(imageUrl)
                : null;
            return { ...item, imageBuffer };
        }));
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);
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
                .text(`Date:       ${new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}`, { align: 'right' })
                .text(`Due Date:   ${new Date(invoice.dueDate).toLocaleDateString('en-IN')}`, { align: 'right' })
                .text(`Status:     ${invoice.paymentStatus}`, { align: 'right' });
            if (logoBuffer) {
                try {
                    doc.image(logoBuffer, 50, 40, { fit: [140, 36] });
                }
                catch {
                    doc
                        .fontSize(16)
                        .font('Helvetica-Bold')
                        .fillColor('#9c5e43')
                        .text(businessName, 50, 45);
                }
            }
            else {
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
            doc.moveDown(3);
            const sepY = doc.y;
            doc
                .moveTo(50, sepY)
                .lineTo(550, sepY)
                .strokeColor('#dddddd')
                .lineWidth(0.5)
                .stroke();
            doc.moveDown(1);
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
                .text(invoice.customer?.businessName || 'Customer', 50, addrY + 12);
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
                .text(invoice.shippingAddress || invoice.billingAddress || 'Same as billing', 300, addrY + 12, { width: 220 });
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
            let currentY = tableStartY + 20;
            itemsWithImages.forEach((item, idx) => {
                if (idx % 2 === 0) {
                    doc.rect(50, currentY, 500, ROW_HEIGHT).fill('#fdf6f2');
                }
                if (item.imageBuffer) {
                    try {
                        doc.image(item.imageBuffer, COL.img + 1, currentY + 4, {
                            width: IMG_SIZE,
                            height: IMG_SIZE,
                        });
                    }
                    catch (e) {
                        this.logger.warn(`Could not embed image for item ${item.sku}: ${e}`);
                        doc
                            .rect(COL.img + 1, currentY + 4, IMG_SIZE, IMG_SIZE)
                            .fill('#eeeeee');
                    }
                }
                else {
                    doc
                        .rect(COL.img + 1, currentY + 4, IMG_SIZE, IMG_SIZE)
                        .fill('#eeeeee');
                }
                const name = item.productName && item.productName.length > 35
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
                    .text(`Rs. ${Number(item.price).toFixed(2)}`, COL.price, currentY + 14, { width: 45, align: 'right' })
                    .text(`Rs. ${Number(item.lineTotal).toFixed(2)}`, COL.total, currentY + 14, { width: 65, align: 'right' });
                doc
                    .moveTo(50, currentY + ROW_HEIGHT)
                    .lineTo(550, currentY + ROW_HEIGHT)
                    .strokeColor('#e8e0db')
                    .lineWidth(0.3)
                    .stroke();
                currentY += ROW_HEIGHT;
                if (currentY > 700) {
                    doc.addPage();
                    currentY = 50;
                }
            });
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
                doc.text(`- Rs. ${Number(invoice.discountTotal).toFixed(2)}`, valX, currentY, { width: 70, align: 'right' });
                currentY += 16;
            }
            if (Number(invoice.taxTotal) > 0) {
                doc.text('Tax (GST):', totalsX, currentY);
                doc.text(`Rs. ${Number(invoice.taxTotal).toFixed(2)}`, valX, currentY, { width: 70, align: 'right' });
                currentY += 16;
            }
            if (Number(invoice.shippingCharge) > 0) {
                doc.text('Shipping:', totalsX, currentY);
                doc.text(`Rs. ${Number(invoice.shippingCharge).toFixed(2)}`, valX, currentY, { width: 70, align: 'right' });
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
            doc
                .fontSize(8)
                .font('Helvetica-Oblique')
                .fillColor('#aaaaaa')
                .text('This is a computer-generated document. No signature is required.', 50, 750, { align: 'center', width: 500 })
                .text('Thank you for your business!', 50, 762, {
                align: 'center',
                width: 500,
            });
            doc.end();
        });
    }
};
exports.PdfService = PdfService;
exports.PdfService = PdfService = PdfService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], PdfService);
//# sourceMappingURL=pdf.service.js.map