export declare class CatalogueImageDto {
    url: string;
    filename: string;
}
export declare class CreateCatalogueDto {
    name: string;
    description?: string;
    imageUrl?: string;
    isPublished?: boolean;
    images?: CatalogueImageDto[];
}
