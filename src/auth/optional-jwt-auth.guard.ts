import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    // If there is an error or no user, do NOT throw. Return null so the request proceeds as anonymous.
    if (err || !user) {
      return null;
    }
    return user;
  }
}
