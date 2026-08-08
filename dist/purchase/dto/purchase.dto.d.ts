export declare class CreateSupplierDto {
    name: string;
    companyName: string;
    contactPerson: string;
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
    purchaseDate?: string;
    description?: string;
    status?: string;
    movedToCatalogId?: string;
    movedAt?: string;
}
export declare class CreatePurchaseInvoiceItemDto {
    productId: string;
    name: string;
    sku: string;
    purchasePrice: number;
    quantity: number;
    unit: string;
    discountPercent: number;
    taxPercent: number;
    total: number;
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
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    grandTotal: number;
    items: CreatePurchaseInvoiceItemDto[];
}
export declare class CreateSupplierPaymentDto {
    supplierId: string;
    amount: number;
    paymentDate: string;
    paymentMode: string;
    referenceNumber?: string;
    notes?: string;
}
