import { Body, Controller, Get, Post, Res, UnauthorizedException } from "@nestjs/common";
import { Response } from "express";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma.service";
import { Public, CurrentUser, SessionUser } from "./decorators";
import { COOKIE_NAME } from "./auth.guard";

const WEEK = 60 * 60 * 24 * 7;

@Controller("auth")
export class AuthController {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  @Public()
  @Post("login")
  async login(
    @Body() body: { username?: string; password?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const username = (body.username || "").trim();
    const password = body.password || "";
    if (!username || !password) throw new UnauthorizedException("Username and password are required");

    const user = await this.prisma.user.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
      include: { department: true },
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid username or password");
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const payload: SessionUser = {
      userId: user.id,
      username: user.username,
      name: user.name,
      role: user.role as SessionUser["role"],
      departmentId: user.departmentId,
      departmentName: user.department?.name ?? null,
    };
    const token = await this.jwt.signAsync(payload, { expiresIn: "7d" });

    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: WEEK * 1000,
    });
    return { ok: true, user: payload };
  }

  @Public()
  @Post("logout")
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(COOKIE_NAME, { path: "/" });
    return { ok: true };
  }

  @Get("me")
  me(@CurrentUser() user: SessionUser) {
    return { user };
  }
}
