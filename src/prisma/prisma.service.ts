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
    await this.syncOrderLedgerInconsistencies();
  }

  async syncOrderLedgerInconsistencies() {
    try {
      this.logger.log('Checking for out-of-sync order, invoice, and ledger records...');
      const orders = await this.order.findMany({
        where: {
          orderStatus: { in: ['APPROVED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'] },
        },
        include: {
          invoices: true,
          items: true,
        },
      });

      for (const order of orders) {
        if (order.orderStatus === 'CANCELLED') {
          for (const invoice of order.invoices) {
            if (invoice.status !== 'CANCELLED') {
              await this.invoice.update({
                where: { id: invoice.id },
                data: { status: 'CANCELLED' },
              });
            }
            await this.ledgerEntry.updateMany({
              where: {
                OR: [{ referenceId: invoice.id }, { referenceId: order.id }],
                transactionStatus: { not: 'CANCELLED' },
              },
              data: { transactionStatus: 'CANCELLED' },
            });
          }
          continue;
        }

        // Active orders
        for (const invoice of order.invoices) {
          if (
            invoice.grandTotal !== order.grandTotal ||
            invoice.taxTotal !== order.taxTotal ||
            invoice.subTotal !== order.subTotal
          ) {
            this.logger.log(
              `Syncing invoice ${invoice.invoiceNumber} (order ${order.orderNumber}): grandTotal ${invoice.grandTotal} -> ${order.grandTotal}`,
            );
            await this.invoice.update({
              where: { id: invoice.id },
              data: {
                subTotal: order.subTotal,
                discountTotal: order.discountTotal,
                taxTotal: order.taxTotal,
                grandTotal: order.grandTotal,
                taxableAmount: order.subTotal,
              },
            });
          }

          const ledgerEntries = await this.ledgerEntry.findMany({
            where: {
              OR: [{ referenceId: invoice.id }, { referenceId: order.id }],
              entryType: 'INVOICE',
            },
          });

          for (const entry of ledgerEntries) {
            if (entry.debit !== order.grandTotal && entry.transactionStatus !== 'CANCELLED') {
              this.logger.log(
                `Syncing ledgerEntry ${entry.id} (customer ${order.customerId}): debit ${entry.debit} -> ${order.grandTotal}`,
              );
              await this.ledgerEntry.update({
                where: { id: entry.id },
                data: {
                  debit: order.grandTotal,
                },
              });
            }
          }
        }
      }
      this.logger.log('Order and ledger synchronization complete.');
    } catch (err) {
      this.logger.warn(`Could not complete order/ledger sync: ${err.message}`);
    }
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
