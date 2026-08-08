export declare class CreateCustomerDto {
    name: string;
    email?: string;
    mobile: string;
    businessName: string;
    businessType?: string;
    gstin?: string;
    billingAddressLine1?: string;
    billingAddressLine2?: string;
    billingCity?: string;
    billingState?: string;
    billingPincode?: string;
    billingCountry?: string;
    shippingAddressLine1?: string;
    shippingAddressLine2?: string;
    shippingCity?: string;
    shippingState?: string;
    shippingPincode?: string;
    shippingCountry?: string;
    storePhotoUrl?: string;
    customerSource?: string;
    pricingGroupId?: string;
    designation?: string;
    whatsapp?: string;
    creditLimit?: string | number | null;
    customerCode?: string;
    mainContactNumber?: string;
}
