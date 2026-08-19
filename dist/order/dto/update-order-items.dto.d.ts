export declare class UpdateOrderItemDto {
    productId: string;
    quantity: number;
    price: number;
    taxPercent?: number;
}
export declare class UpdateOrderItemsDto {
    items: UpdateOrderItemDto[];
    discountTotal?: number;
    taxPercent?: number;
    taxAmount?: number;
    packingCharges?: number;
    packingCtnNote?: string;
    otherCharges?: number;
    otherChargesNote?: string;
    otherDeduction?: number;
    otherDeductionNote?: string;
    discountType?: string;
    discountPercent?: number;
}
