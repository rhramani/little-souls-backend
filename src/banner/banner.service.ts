import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBannerDto } from './dto/create-banner.dto';

@Injectable()
export class BannerService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBannerDto) {
    return this.prisma.banner.create({ data: { ...dto, isActive: dto.isActive ?? true, sortOrder: dto.sortOrder ?? 0 } });
  }

  async findAll(bannerType?: string, activeOnly = false) {
    const where: any = {};
    if (bannerType) where.bannerType = bannerType;
    if (activeOnly) where.isActive = true;

    return this.prisma.banner.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException(`Banner '${id}' not found.`);
    return banner;
  }

  async update(id: string, dto: Partial<CreateBannerDto>) {
    await this.findOne(id);
    return this.prisma.banner.update({ where: { id }, data: { ...dto } });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.banner.delete({ where: { id } });
    return { message: 'Banner deleted successfully.' };
  }
}
