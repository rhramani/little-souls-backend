import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
export declare class PdfService {
    private readonly prisma;
    private readonly configService;
    private readonly logger;
    constructor(prisma: PrismaService, configService: ConfigService);
    private fetchImageBuffer;
    generateInvoicePdf(invoice: any): Promise<Buffer>;
}
