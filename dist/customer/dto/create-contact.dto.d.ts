export declare class CreateContactDto {
    name: string;
    mobile: string;
    whatsappNumber?: string;
    email?: string;
    designation?: string;
    photoUrl?: string;
    loginAccess?: boolean;
    isPrimary?: boolean;
    canPlaceOrder?: boolean;
    canViewLedger?: boolean;
    canDownloadInvoice?: boolean;
}
