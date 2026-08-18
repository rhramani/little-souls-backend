declare class PosOrderItemDto {
    productId: string;
    quantity: number;
    price: number;
}
export declare class PosCheckoutDto {
    customerId?: string;
    walkInName?: string;
    walkInMobile?: string;
    walkInGstin?: string;
    walkInPricingGroupId?: string;
    transportName?: string;
    ctn?: string;
    items: PosOrderItemDto[];
    paymentMethod?: string;
    discountTotal?: number;
    discountType?: string;
    discountPercent?: number;
    otherDeduction?: number;
    otherDeductionNote?: string;
    packingCharges?: number;
    packingCtnNote?: string;
    otherCharges?: number;
    otherChargesNote?: string;
    taxPercent?: number;
    taxAmount?: number;
    withGst?: boolean;
}
export {};
