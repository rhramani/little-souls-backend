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
    items: PosOrderItemDto[];
    paymentMethod?: string;
    discountTotal?: number;
    taxPercent?: number;
    withGst?: boolean;
}
export {};
