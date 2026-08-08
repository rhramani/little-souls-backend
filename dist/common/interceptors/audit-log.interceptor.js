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
exports.AuditLogInterceptor = void 0;
const common_1 = require("@nestjs/common");
const operators_1 = require("rxjs/operators");
const prisma_service_1 = require("../../prisma/prisma.service");
let AuditLogInterceptor = class AuditLogInterceptor {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    intercept(context, next) {
        const req = context.switchToHttp().getRequest();
        const { method, url, user, body } = req;
        const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
        if (!isMutation) {
            return next.handle();
        }
        const userId = user?.id;
        if (!userId) {
            return next.handle();
        }
        return next.handle().pipe((0, operators_1.tap)(async () => {
            try {
                const action = `${method} ${url}`;
                const moduleMatch = url.split('/')[2];
                await this.prisma.auditLog.create({
                    data: {
                        userId,
                        action,
                        module: (moduleMatch || 'UNKNOWN').toUpperCase().substring(0, 50),
                        referenceId: null,
                        oldData: null,
                        newData: JSON.stringify(body),
                        ipAddress: req.ip,
                        userAgent: req.headers['user-agent']?.substring(0, 255),
                    },
                });
            }
            catch (error) {
                console.error('Failed to write audit log:', error);
            }
        }));
    }
};
exports.AuditLogInterceptor = AuditLogInterceptor;
exports.AuditLogInterceptor = AuditLogInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AuditLogInterceptor);
//# sourceMappingURL=audit-log.interceptor.js.map