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
exports.CartService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let CartService = class CartService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getOrCreateCart(customerId, contactId) {
        if (!customerId) {
            throw new common_1.UnauthorizedException('Customer authentication required to access cart.');
        }
        let cart = await this.prisma.cart.findFirst({
            where: {
                customerId,
                status: 'ACTIVE',
            },
            include: {
                items: {
                    include: {
                        product: {
                            include: {
                                images: {
                                    orderBy: { sortOrder: 'asc' },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (!cart) {
            cart = await this.prisma.cart.create({
                data: {
                    customerId,
                    customerContactId: contactId || null,
                    status: 'ACTIVE',
                },
                include: {
                    items: {
                        include: {
                            product: {
                                include: {
                                    images: {
                                        orderBy: { sortOrder: 'asc' },
                                    },
                                },
                            },
                        },
                    },
                },
            });
        }
        return cart;
    }
    async checkCataloguePublished(product) {
        if (!Array.isArray(product.catalogueIds) || product.catalogueIds.length === 0) {
            return;
        }
        const publishedCatalogues = await this.prisma.catalogue.findMany({
            where: {
                id: { in: product.catalogueIds },
                isPublished: true,
            },
            select: { id: true },
        });
        if (publishedCatalogues.length === 0) {
            throw new common_1.BadRequestException(`Product '${product.name}' belongs to a catalogue that is no longer published.`);
        }
    }
    async getB2BProductPrice(productId, customerId) {
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
        });
        const customer = await this.prisma.customer.findUnique({
            where: { id: customerId },
            select: { pricingGroupId: true },
        });
        if (!customer) {
            throw new common_1.NotFoundException('Customer profile not found.');
        }
        if (!customer.pricingGroupId) {
            if (product && product.productPrice)
                return product.productPrice;
            return 0;
        }
        const pricing = await this.prisma.productPricing.findUnique({
            where: {
                productId_pricingGroupId: {
                    productId,
                    pricingGroupId: customer.pricingGroupId,
                },
            },
        });
        if (!pricing) {
            if (product && product.productPrice)
                return product.productPrice;
            return 0;
        }
        return pricing.price;
    }
    async addToCart(customerId, contactId, dto) {
        const { productId, quantity } = dto;
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
        });
        if (!product || !product.isActive) {
            throw new common_1.NotFoundException('Product is inactive or does not exist.');
        }
        await this.checkCataloguePublished(product);
        if (quantity > product.stockQuantity) {
            throw new common_1.BadRequestException(`Quantity requested '${quantity}' exceeds available stock of ${product.stockQuantity} units. Please reduce quantity or select a different product.`);
        }
        const price = await this.getB2BProductPrice(productId, customerId);
        const cart = await this.getOrCreateCart(customerId, contactId);
        const existingItem = cart.items.find((item) => item.productId === productId);
        if (existingItem) {
            const newQuantity = existingItem.quantity + quantity;
            if (newQuantity > product.stockQuantity) {
                throw new common_1.BadRequestException(`Total quantity in cart '${newQuantity}' would exceed available stock of ${product.stockQuantity} units. Please reduce quantity.`);
            }
            const lineTotal = price * newQuantity;
            await this.prisma.cartItem.update({
                where: { id: existingItem.id },
                data: {
                    quantity: newQuantity,
                    price,
                    lineTotal,
                },
            });
        }
        else {
            const lineTotal = price * quantity;
            await this.prisma.cartItem.create({
                data: {
                    cartId: cart.id,
                    productId,
                    quantity,
                    price,
                    lineTotal,
                },
            });
        }
        return this.getOrCreateCart(customerId, contactId);
    }
    async updateItemQuantity(customerId, contactId, cartItemId, dto) {
        const { quantity } = dto;
        const cart = await this.getOrCreateCart(customerId, contactId);
        const cartItem = cart.items.find((item) => item.id === cartItemId);
        if (!cartItem) {
            throw new common_1.NotFoundException('Cart item not found in your active cart.');
        }
        const product = cartItem.product;
        await this.checkCataloguePublished(product);
        if (quantity > product.stockQuantity) {
            throw new common_1.BadRequestException(`Quantity requested '${quantity}' exceeds available stock of ${product.stockQuantity} units for ${product.name}. Please reduce quantity.`);
        }
        const price = await this.getB2BProductPrice(product.id, customerId);
        const lineTotal = price * quantity;
        await this.prisma.cartItem.update({
            where: { id: cartItemId },
            data: {
                quantity,
                price,
                lineTotal,
            },
        });
        return this.getOrCreateCart(customerId, contactId);
    }
    async removeItem(customerId, contactId, cartItemId) {
        const cart = await this.getOrCreateCart(customerId, contactId);
        const cartItem = cart.items.find((item) => item.id === cartItemId);
        if (!cartItem) {
            throw new common_1.NotFoundException('Cart item not found in your active cart.');
        }
        await this.prisma.cartItem.delete({
            where: { id: cartItemId },
        });
        return this.getOrCreateCart(customerId, contactId);
    }
    async clearCart(customerId, contactId) {
        const cart = await this.getOrCreateCart(customerId, contactId);
        await this.prisma.cartItem.deleteMany({
            where: { cartId: cart.id },
        });
        return this.getOrCreateCart(customerId, contactId);
    }
};
exports.CartService = CartService;
exports.CartService = CartService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CartService);
//# sourceMappingURL=cart.service.js.map