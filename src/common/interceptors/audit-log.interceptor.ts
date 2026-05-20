import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, url, user, body } = req;

    // We only want to log mutations
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    if (!isMutation) {
      return next.handle();
    }

    const userId = user?.id; // Assuming JWT auth populates req.user
    if (!userId) {
      return next.handle(); // If no authenticated user, skip (like public routes)
    }

    return next.handle().pipe(
      tap(async () => {
        try {
          // Fire and forget logging
          const action = `${method} ${url}`;
          const moduleMatch = url.split('/')[2]; // /api/module/...
          
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
        } catch (error) {
          console.error('Failed to write audit log:', error);
        }
      }),
    );
  }
}
