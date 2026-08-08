"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BannerService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let BannerService = class BannerService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(dto) {
        return this.prisma.banner.create({
            data: {
                ...dto,
                isActive: dto.isActive ?? true,
                sortOrder: dto.sortOrder ?? 0,
            },
        });
    }
    async findAll(bannerType, activeOnly = false) {
        const where = {};
        if (bannerType)
            where.bannerType = bannerType;
        if (activeOnly)
            where.isActive = true;
        return this.prisma.banner.findMany({
            where,
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        });
    }
    async findOne(id) {
        const banner = await this.prisma.banner.findUnique({ where: { id } });
        if (!banner)
            throw new common_1.NotFoundException(`Banner '${id}' not found.`);
        return banner;
    }
    async update(id, dto) {
        await this.findOne(id);
        return this.prisma.banner.update({ where: { id }, data: { ...dto } });
    }
    async remove(id) {
        await this.findOne(id);
        await this.prisma.banner.delete({ where: { id } });
        return { message: 'Banner deleted successfully.' };
    }
};
exports.BannerService = BannerService;
exports.BannerService = BannerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BannerService);
//# sourceMappingURL=banner.service.js.map