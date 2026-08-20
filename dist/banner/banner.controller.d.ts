import { BannerService } from './banner.service';
import { CreateBannerDto } from './dto/create-banner.dto';
export declare class BannerController {
    private readonly bannerService;
    constructor(bannerService: BannerService);
    create(dto: CreateBannerDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        createdBy: string | null;
        isActive: boolean;
        title: string;
        imageUrl: string;
        sortOrder: number | null;
        label: string | null;
        bannerType: string;
        linkType: string;
        linkReferenceId: string | null;
    }>;
    findAll(bannerType?: string, activeOnly?: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        createdBy: string | null;
        isActive: boolean;
        title: string;
        imageUrl: string;
        sortOrder: number | null;
        label: string | null;
        bannerType: string;
        linkType: string;
        linkReferenceId: string | null;
    }[]>;
    findOne(id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        createdBy: string | null;
        isActive: boolean;
        title: string;
        imageUrl: string;
        sortOrder: number | null;
        label: string | null;
        bannerType: string;
        linkType: string;
        linkReferenceId: string | null;
    }>;
    update(id: string, dto: Partial<CreateBannerDto>): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        createdBy: string | null;
        isActive: boolean;
        title: string;
        imageUrl: string;
        sortOrder: number | null;
        label: string | null;
        bannerType: string;
        linkType: string;
        linkReferenceId: string | null;
    }>;
    remove(id: string): Promise<{
        message: string;
    }>;
}
