import { BadRequestException, Body, Controller, Get, Param, Post } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma.service";
import { Roles } from "../auth/decorators";

@Controller("admin")
@Roles("SUPERADMIN")
export class AdminController {
  constructor(private prisma: PrismaService) {}

  @Get("users")
  async users() {
    return this.prisma.user.findMany({
      orderBy: [{ role: "asc" }, { username: "asc" }],
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        lastLoginAt: true,
        createdAt: true,
        department: { select: { id: true, name: true, code: true } },
      },
    });
  }

  @Post("users/:id/password")
  async resetPassword(@Param("id") id: string, @Body() body: { password?: string }) {
    const password = (body.password || "").trim();
    if (password.length < 6) throw new BadRequestException("Password must be at least 6 characters");
    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    return { ok: true };
  }
}
