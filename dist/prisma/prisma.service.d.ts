import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
export declare class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger;
    constructor();
    onModuleInit(): Promise<void>;
    syncOrderLedgerInconsistencies(): Promise<void>;
    private ensureSparseIndexes;
    onModuleDestroy(): Promise<void>;
}
