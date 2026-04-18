import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";

const ADMIN_USER = "Juan";

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || user.name !== ADMIN_USER) {
      throw new ForbiddenException("Acceso restringido al administrador");
    }
    return true;
  }
}
