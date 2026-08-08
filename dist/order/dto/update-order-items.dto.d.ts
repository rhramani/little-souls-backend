export declare class UpdateOrderItemDto {
    productId: string;
    quantity: number;
    price: number;
}
export declare class UpdateOrderItemsDto {
    items: UpdateOrderItemDto[];
    discountTotal?: number;
    taxPercent?: number;
}
