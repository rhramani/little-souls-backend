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
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
