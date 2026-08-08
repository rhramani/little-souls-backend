import { PrismaService } from '../prisma/prisma.service';
import { CreateBannerDto } from './dto/create-banner.dto';
export declare class BannerService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(dto: CreateBannerDto): Promise<{
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        imageUrl: string;
        sortOrder: number | null;
        createdBy: string | null;
        label: string | null;
        bannerType: string;
        linkType: string;
        linkReferenceId: string | null;
    }>;
    findAll(bannerType?: string, activeOnly?: boolean): Promise<{
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        imageUrl: string;
        sortOrder: number | null;
        createdBy: string | null;
        label: string | null;
        bannerType: string;
        linkType: string;
        linkReferenceId: string | null;
    }[]>;
    findOne(id: string): Promise<{
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        imageUrl: string;
        sortOrder: number | null;
        createdBy: string | null;
        label: string | null;
        bannerType: string;
        linkType: string;
        linkReferenceId: string | null;
    }>;
    update(id: string, dto: Partial<CreateBannerDto>): Promise<{
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        imageUrl: string;
        sortOrder: number | null;
        createdBy: string | null;
        label: string | null;
        bannerType: string;
        linkType: string;
        linkReferenceId: string | null;
    }>;
    remove(id: string): Promise<{
        message: string;
    }>;
}
