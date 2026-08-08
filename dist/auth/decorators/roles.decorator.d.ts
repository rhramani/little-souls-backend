import { UserType } from '@prisma/client';
export declare const ROLES_KEY = "roles";
export declare const Roles: (...roles: UserType[]) => import("@nestjs/common").CustomDecorator<string>;
