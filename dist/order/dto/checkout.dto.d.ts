export declare class CheckoutDto {
    deliveryAddress?: string;
    billingAddress?: string;
    notes?: string;
    orderSource?: string;
    shippingCharge?: string;
    paymentMethod?: string;
    items?: any[];
    subTotal?: number;
    taxAmount?: number;
    taxPercent?: number;
    totalAmount?: number;
    withGst?: boolean;
    gstin?: string;
    contactName?: string;
    mobile?: string;
    email?: string;
}
