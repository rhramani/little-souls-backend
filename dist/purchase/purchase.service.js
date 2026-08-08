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
            include: { supplier: true },
            orderBy: { createdAt: 'desc' },
        });
    }
    async findOnePurchasedProduct(id) {
        const product = await this.prisma.purchasedProduct.findUnique({
            where: { id },
            include: { supplier: true },
        });
        if (!product) {
            throw new common_1.NotFoundException(`Purchased product with ID "${id}" not found.`);
        }
        return product;
    }
    async createPurchasedProduct(dto) {
        await this.findOneSupplier(dto.supplierId);
        const skuExists = await this.prisma.purchasedProduct.findUnique({
            where: { sku: dto.sku },
        });
        if (skuExists) {
            throw new common_1.ConflictException(`A purchased product with SKU "${dto.sku}" already exists.`);
        }
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
        if (dto.sku) {
            const skuExists = await this.prisma.purchasedProduct.findUnique({
                where: { sku: dto.sku },
            });
            if (skuExists && skuExists.id !== id) {
                throw new common_1.ConflictException(`SKU "${dto.sku}" is already in use by another product.`);
            }
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
                    cgstAmount: dto.cgstAmount,
                    sgstAmount: dto.sgstAmount,
                    igstAmount: dto.igstAmount,
                    grandTotal: dto.grandTotal,
                },
            });
            const itemsData = dto.items.map((item) => ({
                purchaseInvoiceId: invoice.id,
                productId: item.productId,
                name: item.name,
                sku: item.sku,
                purchasePrice: item.purchasePrice,
                quantity: item.quantity,
                unit: item.unit,
                discountPercent: item.discountPercent,
                taxPercent: item.taxPercent,
                total: item.total,
            }));
            await tx.purchaseInvoiceItem.createMany({
                data: itemsData,
            });
            return tx.purchaseInvoice.findUnique({
                where: { id: invoice.id },
                include: {
                    supplier: true,
                    items: true,
                },
            });
        });
    }
    async findAllSupplierPayments() {
        return this.prisma.supplierPayment.findMany({
            include: { supplier: true },
            orderBy: { createdAt: 'desc' },
        });
    }
    async createSupplierPayment(dto) {
        await this.findOneSupplier(dto.supplierId);
        return this.prisma.supplierPayment.create({
            data: {
                supplierId: dto.supplierId,
                amount: dto.amount,
                paymentDate: new Date(dto.paymentDate),
                paymentMode: dto.paymentMode,
                referenceNumber: dto.referenceNumber,
                notes: dto.notes,
            },
            include: { supplier: true },
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