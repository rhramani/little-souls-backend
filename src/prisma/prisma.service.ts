import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super();
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Successfully connected to MongoDB database');
    console.log(
      '\x1b[32m%s\x1b[0m',
      '🟢 Database connected successfully to MongoDB!',
    );
    await this.ensureSparseIndexes();
  }

  private async ensureSparseIndexes() {
    try {
      const res: any = await this.$runCommandRaw({ listIndexes: 'users' });
      const indexes = res?.cursor?.firstBatch || [];
      const target = indexes.find(
        (i: any) => i.name === 'users_customer_contact_id_key',
      );
      if (target && target.unique && !target.sparse) {
        this.logger.log(
          'Updating users_customer_contact_id_key index to sparse...',
        );
        await this.$runCommandRaw({
          dropIndexes: 'users',
          index: 'users_customer_contact_id_key',
        });
        await this.$runCommandRaw({
          createIndexes: 'users',
          indexes: [
            {
              key: { customer_contact_id: 1 },
              name: 'users_customer_contact_id_key',
              unique: true,
              sparse: true,
            },
          ],
        });
      }
    } catch (err) {
      this.logger.warn(`Could not verify sparse indexes: ${err.message}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
