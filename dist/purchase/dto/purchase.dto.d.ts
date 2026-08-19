export declare class CreateSupplierDto {
    name: string;
    companyName?: string;
    contactPerson?: string;
    mobile: string;
    email: string;
    gstNumber?: string;
    address: string;
    city: string;
    state: string;
    country: string;
    pincode: string;
    status?: string;
    notes?: string;
}
export declare class UpdateSupplierDto {
    name?: string;
    companyName?: string;
    contactPerson?: string;
    mobile?: string;
    email?: string;
    gstNumber?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    pincode?: string;
    status?: string;
    notes?: string;
}
export declare class CreatePurchasedProductDto {
    productImage?: string;
    name: string;
    sku: string;
    purchasePrice: number;
    sellingPrice?: number;
    quantity: number;
    unit: string;
    category?: string;
    brand?: string;
    supplierId: string;
    purchaseInvoiceId?: string;
    purchaseDate: string;
    description?: string;
    status?: string;
}
export declare class UpdatePurchasedProductDto {
    productImage?: string;
    name?: string;
    sku?: string;
    purchasePrice?: number;
    sellingPrice?: number;
    quantity?: number;
    unit?: string;
    category?: string;
    brand?: string;
    supplierId?: string;
    purchaseInvoiceId?: string;
    purchaseDate?: string;
    description?: string;
    status?: string;
    movedToCatalogId?: string;
    movedToCategoryId?: string;
    movedAt?: string;
}
export declare class CreatePurchaseInvoiceItemDto {
    productId?: string;
    name: string;
    sku: string;
    purchasePrice: number;
    sellingPrice?: number;
    quantity: number;
    unit: string;
    discountPercent: number;
    discountOther?: number;
    otherCharges?: number;
    taxPercent: number;
    total: number;
    productImage?: string;
    description?: string;
    category?: string;
    brand?: string;
}
export declare class CreatePurchaseInvoiceDto {
    invoiceNumber: string;
    invoiceDate: string;
    supplierId: string;
    businessState: string;
    withGst: boolean;
    gstRate: number;
    subtotal: number;
    discountAmount: number;
    discountPercent?: number;
    discountOther?: number;
    otherCharges?: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    grandTotal: number;
    items: CreatePurchaseInvoiceItemDto[];
}
export declare class CreateSupplierPaymentDto {
    supplierId: string;
    purchaseInvoiceId?: string;
    amount: number;
    paymentDate: string;
    paymentMode: string;
    referenceNumber?: string;
    notes?: string;
}
export declare class UpdateSupplierPaymentDto {
    supplierId?: string;
    purchaseInvoiceId?: string;
    amount?: number;
    paymentDate?: string;
    paymentMode?: string;
    referenceNumber?: string;
    notes?: string;
}
