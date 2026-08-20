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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let PurchaseService = class PurchaseService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAllSuppliers() {
        return this.prisma.supplier.findMany({
            include: {
                purchasedProducts: true,
                purchaseInvoices: true,
                supplierPayments: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async findOneSupplier(id) {
        const supplier = await this.prisma.supplier.findUnique({
            where: { id },
        });
        if (!supplier) {
            throw new common_1.NotFoundException(`Supplier with ID "${id}" not found.`);
        }
        return supplier;
    }
    async createSupplier(dto) {
        return this.prisma.supplier.create({
            data: {
                name: dto.name,
                companyName: dto.companyName,
                contactPerson: dto.contactPerson,
                mobile: dto.mobile,
                email: dto.email,
                gstNumber: dto.gstNumber,
                address: dto.address,
                city: dto.city,
                state: dto.state,
                country: dto.country,
                pincode: dto.pincode,
                status: dto.status || 'Active',
                notes: dto.notes,
            },
        });
    }
    async updateSupplier(id, dto) {
        await this.findOneSupplier(id);
        return this.prisma.supplier.update({
            where: { id },
            data: dto,
        });
    }
    async removeSupplier(id) {
        await this.findOneSupplier(id);
        const productCount = await this.prisma.purchasedProduct.count({
            where: { supplierId: id },
        });
        if (productCount > 0) {
            throw new common_1.ConflictException(`Cannot delete supplier because it is linked to ${productCount} purchased product(s).`);
        }
        return this.prisma.supplier.delete({
            where: { id },
        });
    }
    async findAllPurchasedProducts() {
        return this.prisma.purchasedProduct.findMany({
            include: {
                supplier: true,
                purchaseInvoice: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async findOnePurchasedProduct(id) {
        const product = await this.prisma.purchasedProduct.findUnique({
            where: { id },
            include: {
                supplier: true,
                purchaseInvoice: true,
            },
        });
        if (!product) {
            throw new common_1.NotFoundException(`Purchased product with ID "${id}" not found.`);
        }
        return product;
    }
    async createPurchasedProduct(dto) {
        await this.findOneSupplier(dto.supplierId);
        return this.prisma.purchasedProduct.create({
            data: {
                productImage: dto.productImage,
                name: dto.name,
                sku: dto.sku,
                purchasePrice: dto.purchasePrice,
                sellingPrice: dto.sellingPrice,
                quantity: dto.quantity,
                unit: dto.unit || 'PCS',
                category: dto.category,
                brand: dto.brand,
                supplierId: dto.supplierId,
                purchaseInvoiceId: dto.purchaseInvoiceId,
                purchaseDate: new Date(dto.purchaseDate),
                description: dto.description,
                status: dto.status || 'Active',
            },
        });
    }
    async updatePurchasedProduct(id, dto) {
        await this.findOnePurchasedProduct(id);
        if (dto.supplierId) {
            await this.findOneSupplier(dto.supplierId);
        }
        const data = { ...dto };
        if (dto.purchaseDate) {
            data.purchaseDate = new Date(dto.purchaseDate);
        }
        if (dto.movedAt) {
            data.movedAt = new Date(dto.movedAt);
        }
        return this.prisma.purchasedProduct.update({
            where: { id },
            data,
        });
    }
    async repeatPurchasedProduct(dto) {
        const existing = await this.prisma.purchasedProduct.findFirst({
            where: {
                sku: { equals: dto.sku, mode: 'insensitive' },
                ...(dto.supplierId ? { supplierId: dto.supplierId } : {}),
            },
            include: {
                supplier: true,
            },
        });
        if (!existing) {
            throw new common_1.NotFoundException(`Purchased product with SKU "${dto.sku}" not found.`);
        }
        const supplierId = dto.supplierId || existing.supplierId;
        const purchasePrice = dto.purchasePrice !== undefined && dto.purchasePrice !== null
            ? Number(dto.purchasePrice)
            : existing.purchasePrice;
        const qty = Number(dto.quantity);
        const lineTotal = purchasePrice * qty;
        const purchaseDate = new Date(dto.date);
        return this.prisma.$transaction(async (tx) => {
            let invoice = await tx.purchaseInvoice.findUnique({
                where: { invoiceNumber: dto.invoiceNumber },
                include: { items: true },
            });
            if (invoice) {
                const existingItem = invoice.items?.find((it) => it.sku.toLowerCase() === dto.sku.toLowerCase());
                if (existingItem) {
                    await tx.purchaseInvoiceItem.update({
                        where: { id: existingItem.id },
                        data: {
                            quantity: existingItem.quantity + qty,
                            total: existingItem.total + lineTotal,
                        },
                    });
                }
                else {
                    await tx.purchaseInvoiceItem.create({
                        data: {
                            purchaseInvoiceId: invoice.id,
                            productId: existing.id,
                            name: existing.name,
                            sku: existing.sku,
                            purchasePrice: purchasePrice,
                            sellingPrice: existing.sellingPrice || null,
                            quantity: qty,
                            unit: existing.unit,
                            discountPercent: 0,
                            discountOther: 0,
                            otherCharges: 0,
                            taxPercent: invoice.gstRate || 0,
                            total: lineTotal,
                        },
                    });
                }
                invoice = await tx.purchaseInvoice.update({
                    where: { id: invoice.id },
                    data: {
                        subtotal: invoice.subtotal + lineTotal,
                        grandTotal: invoice.grandTotal + lineTotal,
                    },
                    include: {
                        supplier: true,
                        items: true,
                        purchasedProducts: true,
                    },
                });
            }
            else {
                invoice = await tx.purchaseInvoice.create({
                    data: {
                        invoiceNumber: dto.invoiceNumber,
                        invoiceDate: purchaseDate,
                        supplierId: supplierId,
                        businessState: existing.supplier?.state || 'Other',
                        withGst: false,
                        gstRate: 0,
                        subtotal: lineTotal,
                        discountAmount: 0,
                        discountPercent: 0,
                        discountOther: 0,
                        otherCharges: 0,
                        cgstAmount: 0,
                        sgstAmount: 0,
                        igstAmount: 0,
                        grandTotal: lineTotal,
                        items: {
                            create: [
                                {
                                    productId: existing.id,
                                    name: existing.name,
                                    sku: existing.sku,
                                    purchasePrice: purchasePrice,
                                    sellingPrice: existing.sellingPrice || null,
                                    quantity: qty,
                                    unit: existing.unit,
                                    discountPercent: 0,
                                    discountOther: 0,
                                    otherCharges: 0,
                                    taxPercent: 0,
                                    total: lineTotal,
                                },
                            ],
                        },
                    },
                    include: {
                        supplier: true,
                        items: true,
                        purchasedProducts: true,
                    },
                });
            }
            const currentMovedQty = existing.movedQuantity !== null && existing.movedQuantity !== undefined
                ? existing.movedQuantity
                : existing.movedToCatalogId
                    ? existing.quantity
                    : 0;
            const updatedProduct = await tx.purchasedProduct.update({
                where: { id: existing.id },
                data: {
                    quantity: existing.quantity + qty,
                    movedQuantity: currentMovedQty,
                    purchasePrice: purchasePrice,
                    purchaseDate: purchaseDate,
                    purchaseInvoiceId: invoice.id,
                },
                include: {
                    supplier: true,
                    purchaseInvoice: true,
                },
            });
            return {
                product: updatedProduct,
                invoice,
            };
        });
    }
    async removePurchasedProduct(id) {
        await this.findOnePurchasedProduct(id);
        return this.prisma.purchasedProduct.delete({
            where: { id },
        });
    }
    async findAllPurchaseInvoices() {
        return this.prisma.purchaseInvoice.findMany({
            include: {
                supplier: true,
                items: true,
                purchasedProducts: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async createPurchaseInvoice(dto) {
        await this.findOneSupplier(dto.supplierId);
        const invExists = await this.prisma.purchaseInvoice.findUnique({
            where: { invoiceNumber: dto.invoiceNumber },
        });
        if (invExists) {
            throw new common_1.ConflictException(`Invoice number "${dto.invoiceNumber}" already exists.`);
        }
        return this.prisma.$transaction(async (tx) => {
            const invoice = await tx.purchaseInvoice.create({
                data: {
                    invoiceNumber: dto.invoiceNumber,
                    invoiceDate: new Date(dto.invoiceDate),
                    supplierId: dto.supplierId,
                    businessState: dto.businessState,
                    withGst: dto.withGst,
                    gstRate: dto.gstRate,
                    subtotal: dto.subtotal,
                    discountAmount: dto.discountAmount,
                    discountPercent: dto.discountPercent !== undefined ? dto.discountPercent : 0,
                    discountOther: dto.discountOther !== undefined ? dto.discountOther : 0,
                    otherCharges: dto.otherCharges !== undefined ? dto.otherCharges : 0,
                    cgstAmount: dto.cgstAmount,
                    sgstAmount: dto.sgstAmount,
                    igstAmount: dto.igstAmount,
                    grandTotal: dto.grandTotal,
                },
            });
            const itemsData = dto.items.map((item) => ({
                purchaseInvoiceId: invoice.id,
                productId: item.productId || null,
                name: item.name,
                sku: item.sku,
                purchasePrice: item.purchasePrice,
                sellingPrice: item.sellingPrice || null,
                quantity: item.quantity,
                unit: item.unit,
                discountPercent: item.discountPercent,
                discountOther: item.discountOther || 0,
                otherCharges: item.otherCharges || 0,
                taxPercent: item.taxPercent,
                total: item.total,
            }));
            await tx.purchaseInvoiceItem.createMany({
                data: itemsData,
            });
            for (const item of dto.items) {
                const existingProducts = await tx.purchasedProduct.findMany({
                    where: {
                        sku: item.sku,
                        supplierId: dto.supplierId,
                    },
                });
                if (existingProducts.length > 0) {
                    const existing = existingProducts[0];
                    const currentMovedQty = existing.movedQuantity !== null && existing.movedQuantity !== undefined
                        ? existing.movedQuantity
                        : existing.movedToCatalogId
                            ? existing.quantity
                            : 0;
                    await tx.purchasedProduct.update({
                        where: { id: existing.id },
                        data: {
                            quantity: existing.quantity + item.quantity,
                            movedQuantity: currentMovedQty,
                            purchasePrice: item.purchasePrice,
                            sellingPrice: item.sellingPrice || existing.sellingPrice,
                            purchaseDate: new Date(dto.invoiceDate),
                            purchaseInvoiceId: invoice.id,
                            name: item.name,
                            productImage: item.productImage || existing.productImage,
                            description: item.description || existing.description,
                        },
                    });
                }
                else {
                    await tx.purchasedProduct.create({
                        data: {
                            name: item.name,
                            sku: item.sku,
                            purchasePrice: item.purchasePrice,
                            sellingPrice: item.sellingPrice,
                            quantity: item.quantity,
                            unit: item.unit,
                            supplierId: dto.supplierId,
                            purchaseInvoiceId: invoice.id,
                            purchaseDate: new Date(dto.invoiceDate),
                            productImage: item.productImage,
                            description: item.description,
                            category: item.category,
                            brand: item.brand,
                            status: 'Active',
                        },
                    });
                }
            }
            return tx.purchaseInvoice.findUnique({
                where: { id: invoice.id },
                include: {
                    supplier: true,
                    items: true,
                    purchasedProducts: true,
                },
            });
        });
    }
    async updatePurchaseInvoice(id, dto) {
        const existingInv = await this.prisma.purchaseInvoice.findUnique({
            where: { id },
            include: { items: true },
        });
        if (!existingInv) {
            throw new common_1.NotFoundException(`Purchase invoice with ID "${id}" not found.`);
        }
        if (dto.supplierId) {
            await this.findOneSupplier(dto.supplierId);
        }
        return this.prisma.$transaction(async (tx) => {
            await tx.purchaseInvoice.update({
                where: { id },
                data: {
                    invoiceNumber: dto.invoiceNumber,
                    invoiceDate: new Date(dto.invoiceDate),
                    supplierId: dto.supplierId,
                    businessState: dto.businessState,
                    withGst: dto.withGst,
                    gstRate: dto.gstRate,
                    subtotal: dto.subtotal,
                    discountAmount: dto.discountAmount,
                    discountPercent: dto.discountPercent !== undefined ? dto.discountPercent : 0,
                    discountOther: dto.discountOther !== undefined ? dto.discountOther : 0,
                    otherCharges: dto.otherCharges !== undefined ? dto.otherCharges : 0,
                    cgstAmount: dto.cgstAmount,
                    sgstAmount: dto.sgstAmount,
                    igstAmount: dto.igstAmount,
                    grandTotal: dto.grandTotal,
                },
            });
            await tx.purchaseInvoiceItem.deleteMany({
                where: { purchaseInvoiceId: id },
            });
            const itemsData = dto.items.map((item) => ({
                purchaseInvoiceId: id,
                productId: item.productId || null,
                name: item.name,
                sku: item.sku,
                purchasePrice: item.purchasePrice,
                sellingPrice: item.sellingPrice || null,
                quantity: item.quantity,
                unit: item.unit,
                discountPercent: item.discountPercent,
                discountOther: item.discountOther || 0,
                otherCharges: item.otherCharges || 0,
                taxPercent: item.taxPercent,
                total: item.total,
            }));
            await tx.purchaseInvoiceItem.createMany({
                data: itemsData,
            });
            return tx.purchaseInvoice.findUnique({
                where: { id },
                include: {
                    supplier: true,
                    items: true,
                    purchasedProducts: true,
                },
            });
        });
    }
    async removePurchaseInvoice(id) {
        const invoice = await this.prisma.purchaseInvoice.findUnique({
            where: { id },
            include: { items: true },
        });
        if (!invoice) {
            throw new common_1.NotFoundException(`Purchase invoice with ID "${id}" not found.`);
        }
        return this.prisma.$transaction(async (tx) => {
            await tx.supplierPayment.deleteMany({
                where: {
                    OR: [
                        { purchaseInvoiceId: id },
                        { referenceNumber: { equals: invoice.invoiceNumber, mode: 'insensitive' } },
                        { referenceNumber: { equals: `INV-${invoice.invoiceNumber}`, mode: 'insensitive' } },
                        { referenceNumber: { contains: invoice.invoiceNumber, mode: 'insensitive' } },
                        { notes: { contains: invoice.invoiceNumber, mode: 'insensitive' } },
                    ],
                },
            });
            for (const item of invoice.items) {
                const existingProducts = await tx.purchasedProduct.findMany({
                    where: {
                        sku: { equals: item.sku, mode: 'insensitive' },
                        supplierId: invoice.supplierId,
                    },
                });
                for (const prod of existingProducts) {
                    const remainingQty = prod.quantity - item.quantity;
                    if (remainingQty > 0) {
                        const otherInvoiceItems = await tx.purchaseInvoiceItem.findMany({
                            where: {
                                sku: { equals: item.sku, mode: 'insensitive' },
                                purchaseInvoice: {
                                    id: { not: id },
                                    supplierId: invoice.supplierId,
                                },
                            },
                            include: {
                                purchaseInvoice: true,
                            },
                            orderBy: {
                                purchaseInvoice: {
                                    invoiceDate: 'desc',
                                },
                            },
                        });
                        const fallbackInvoiceItem = otherInvoiceItems[0];
                        const fallbackInvoice = fallbackInvoiceItem?.purchaseInvoice;
                        const currentMovedQty = prod.movedQuantity !== null && prod.movedQuantity !== undefined
                            ? prod.movedQuantity
                            : prod.movedToCatalogId
                                ? prod.quantity
                                : 0;
                        await tx.purchasedProduct.update({
                            where: { id: prod.id },
                            data: {
                                quantity: remainingQty,
                                movedQuantity: Math.min(currentMovedQty, remainingQty),
                                purchaseInvoiceId: fallbackInvoice ? fallbackInvoice.id : null,
                                purchasePrice: fallbackInvoiceItem
                                    ? fallbackInvoiceItem.purchasePrice
                                    : prod.purchasePrice,
                                purchaseDate: fallbackInvoice
                                    ? fallbackInvoice.invoiceDate
                                    : prod.purchaseDate,
                            },
                        });
                    }
                    else {
                        await tx.purchasedProduct.delete({
                            where: { id: prod.id },
                        });
                    }
                }
            }
            const orphanedProducts = await tx.purchasedProduct.findMany({
                where: { purchaseInvoiceId: id },
            });
            for (const orphan of orphanedProducts) {
                await tx.purchasedProduct.delete({
                    where: { id: orphan.id },
                });
            }
            await tx.purchaseInvoiceItem.deleteMany({
                where: { purchaseInvoiceId: id },
            });
            return tx.purchaseInvoice.delete({
                where: { id },
            });
        });
    }
    async findAllSupplierPayments() {
        return this.prisma.supplierPayment.findMany({
            include: { supplier: true, purchaseInvoice: true },
            orderBy: { createdAt: 'desc' },
        });
    }
    async createSupplierPayment(dto) {
        await this.findOneSupplier(dto.supplierId);
        return this.prisma.supplierPayment.create({
            data: {
                supplierId: dto.supplierId,
                purchaseInvoiceId: dto.purchaseInvoiceId || null,
                amount: dto.amount,
                paymentDate: new Date(dto.paymentDate),
                paymentMode: dto.paymentMode,
                referenceNumber: dto.referenceNumber,
                notes: dto.notes,
            },
            include: { supplier: true, purchaseInvoice: true },
        });
    }
    async updateSupplierPayment(id, dto) {
        const payment = await this.prisma.supplierPayment.findUnique({
            where: { id },
        });
        if (!payment) {
            throw new common_1.NotFoundException(`Supplier payment with ID "${id}" not found.`);
        }
        if (dto.supplierId) {
            await this.findOneSupplier(dto.supplierId);
        }
        return this.prisma.supplierPayment.update({
            where: { id },
            data: {
                supplierId: dto.supplierId,
                purchaseInvoiceId: dto.purchaseInvoiceId !== undefined ? dto.purchaseInvoiceId : payment.purchaseInvoiceId,
                amount: dto.amount !== undefined ? dto.amount : payment.amount,
                paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : payment.paymentDate,
                paymentMode: dto.paymentMode || payment.paymentMode,
                referenceNumber: dto.referenceNumber !== undefined ? dto.referenceNumber : payment.referenceNumber,
                notes: dto.notes !== undefined ? dto.notes : payment.notes,
            },
            include: { supplier: true, purchaseInvoice: true },
        });
    }
    async removeSupplierPayment(id) {
        const payment = await this.prisma.supplierPayment.findUnique({
            where: { id },
        });
        if (!payment) {
            throw new common_1.NotFoundException(`Supplier payment with ID "${id}" not found.`);
        }
        return this.prisma.supplierPayment.delete({
            where: { id },
        });
    }
};
exports.PurchaseService = PurchaseService;
exports.PurchaseService = PurchaseService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PurchaseService);
//# sourceMappingURL=purchase.service.js.map