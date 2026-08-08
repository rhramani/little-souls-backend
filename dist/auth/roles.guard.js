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
exports.RolesGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const client_1 = require("@prisma/client");
const roles_decorator_1 = require("./decorators/roles.decorator");
const permissions_decorator_1 = require("./decorators/permissions.decorator");
let RolesGuard = class RolesGuard {
    reflector;
    constructor(reflector) {
        this.reflector = reflector;
    }
    canActivate(context) {
        const request = context.switchToHttp().getRequest();
        if (request.method === 'OPTIONS') {
            return true;
        }
        const requiredRoles = this.reflector.getAllAndOverride(roles_decorator_1.ROLES_KEY, [context.getHandler(), context.getClass()]);
        const requiredPermissions = this.reflector.getAllAndOverride(permissions_decorator_1.PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
        if (!requiredRoles && !requiredPermissions) {
            return true;
        }
        const { user } = context.switchToHttp().getRequest();
        if (!user) {
            return false;
        }
        if (user.userType === client_1.UserType.SUPER_ADMIN) {
            return true;
        }
        if (requiredRoles) {
            const hasRole = requiredRoles.includes(user.userType);
            if (!hasRole) {
                throw new common_1.ForbiddenException('You do not have the required user type role to access this resource');
            }
        }
        if (requiredPermissions) {
            const userPermissions = [];
            if (user.userRoles) {
                for (const userRole of user.userRoles) {
                    if (userRole.role?.rolePermissions) {
                        for (const rp of userRole.role.rolePermissions) {
                            if (rp.permission?.module && rp.permission?.action) {
                                userPermissions.push(`${rp.permission.module}:${rp.permission.action}`);
                            }
                        }
                    }
                }
            }
            if (user.userType === client_1.UserType.CUSTOMER && user.customerContact) {
                if (user.customerContact.canPlaceOrder)
                    userPermissions.push('PLACE_ORDER');
                if (user.customerContact.canViewLedger)
                    userPermissions.push('VIEW_LEDGER');
                if (user.customerContact.canDownloadInvoice)
                    userPermissions.push('DOWNLOAD_INVOICE');
            }
            const hasAllPermissions = requiredPermissions.every((perm) => userPermissions.includes(perm));
            if (!hasAllPermissions) {
                throw new common_1.ForbiddenException('You do not have the necessary permissions to perform this action');
            }
        }
        return true;
    }
};
exports.RolesGuard = RolesGuard;
exports.RolesGuard = RolesGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector])
], RolesGuard);
//# sourceMappingURL=roles.guard.js.map