import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { IS_PUBLIC, ROLES_KEY, AppRole, SessionUser } from "./decorators";

export const COOKIE_NAME = "cm_session";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwt: JwtService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const token: string | undefined = req.cookies?.[COOKIE_NAME];
    if (!token) throw new UnauthorizedException("Not signed in");

    let user: SessionUser;
    try {
      user = await this.jwt.verifyAsync<SessionUser>(token);
    } catch {
      throw new UnauthorizedException("Session expired — sign in again");
    }
    req.user = user;

    const roles = this.reflector.getAllAndOverride<AppRole[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (roles && roles.length && !roles.includes(user.role)) {
      throw new ForbiddenException("You do not have access to this resource");
    }
    return true;
  }
}
