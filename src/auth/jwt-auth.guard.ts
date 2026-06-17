import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    if (request.method === 'OPTIONS') {
      return true;
    }
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      if (info && info.name === 'TokenExpiredError') {
        console.log(
          `[DEBUG] JwtAuthGuard auth failed: JWT expired at ${info.expiredAt}`,
        );
      } else if (info && info.message) {
        console.log(`[DEBUG] JwtAuthGuard auth failed: ${info.message}`);
      } else {
        console.log('[DEBUG] JwtAuthGuard auth failed:', { err, user, info });
      }
      throw (
        err ||
        new UnauthorizedException('Authentication token is invalid or missing')
      );
    }
    return user;
  }
}
