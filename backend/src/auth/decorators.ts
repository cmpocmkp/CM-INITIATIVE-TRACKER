import { SetMetadata, createParamDecorator, ExecutionContext } from "@nestjs/common";

export const IS_PUBLIC = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ROLES_KEY = "roles";
export type AppRole = "SUPERADMIN" | "ADMIN" | "DEPARTMENT";
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);

export interface SessionUser {
  userId: string;
  username: string;
  name: string;
  role: AppRole;
  departmentId: string | null;
  departmentName: string | null;
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): SessionUser => {
  const req = ctx.switchToHttp().getRequest();
  return req.user as SessionUser;
});
