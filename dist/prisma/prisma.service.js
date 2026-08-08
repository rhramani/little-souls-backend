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
var PrismaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
let PrismaService = PrismaService_1 = class PrismaService extends client_1.PrismaClient {
    logger = new common_1.Logger(PrismaService_1.name);
    constructor() {
        super();
    }
    async onModuleInit() {
        await this.$connect();
        this.logger.log('Successfully connected to MongoDB database');
        console.log('\x1b[32m%s\x1b[0m', '🟢 Database connected successfully to MongoDB!');
        await this.ensureSparseIndexes();
    }
    async ensureSparseIndexes() {
        try {
            const res = await this.$runCommandRaw({ listIndexes: 'users' });
            const indexes = res?.cursor?.firstBatch || [];
            const target = indexes.find((i) => i.name === 'users_customer_contact_id_key');
            if (target && target.unique && !target.sparse) {
                this.logger.log('Updating users_customer_contact_id_key index to sparse...');
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
        }
        catch (err) {
            this.logger.warn(`Could not verify sparse indexes: ${err.message}`);
        }
    }
    async onModuleDestroy() {
        await this.$disconnect();
    }
};
exports.PrismaService = PrismaService;
exports.PrismaService = PrismaService = PrismaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], PrismaService);
//# sourceMappingURL=prisma.service.js.map