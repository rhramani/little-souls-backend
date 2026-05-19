import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserType } from '@prisma/client';
import { ROLES_KEY } from './decorators/roles.decorator';
import { PERMISSIONS_KEY } from './decorators/permissions.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserType[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles && !requiredPermissions) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      return false;
    }

    // Super Admin bypasses all checks
    if (user.userType === UserType.SUPER_ADMIN) {
      return true;
    }

    // Role check
    if (requiredRoles) {
      const hasRole = requiredRoles.includes(user.userType);
      if (!hasRole) {
        throw new ForbiddenException('You do not have the required user type role to access this resource');
      }
    }

    // Permission check
    if (requiredPermissions) {
      // Gather all permissions across all roles of the user
      const userPermissions: string[] = [];
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

      // Check for Customer Contact specific permissions
      if (user.userType === UserType.CUSTOMER && user.customerContact) {
        if (user.customerContact.canPlaceOrder) userPermissions.push('PLACE_ORDER');
        if (user.customerContact.canViewLedger) userPermissions.push('VIEW_LEDGER');
        if (user.customerContact.canDownloadInvoice) userPermissions.push('DOWNLOAD_INVOICE');
      }

      const hasAllPermissions = requiredPermissions.every((perm) =>
        userPermissions.includes(perm),
      );

      if (!hasAllPermissions) {
        throw new ForbiddenException('You do not have the necessary permissions to perform this action');
      }
    }

    return true;
  }
}
