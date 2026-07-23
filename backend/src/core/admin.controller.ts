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
        email: true,
        phone: true,
        passwordPlain: true, // SUPERADMIN-only route (class guard)
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
    await this.prisma.user.update({ where: { id }, data: { passwordHash, passwordPlain: password } });
    return { ok: true };
  }

  /** Set a user's contact details (email + phone). */
  @Post("users/:id/contact")
  async setUserContact(@Param("id") id: string, @Body() body: { email?: string; phone?: string }) {
    const email = (body.email || "").trim().toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException("Invalid email address");
    }
    const phone = (body.phone || "").replace(/[^\d]/g, "");
    if (phone && (phone.length < 10 || phone.length > 15)) {
      throw new BadRequestException("Phone must be international format, e.g. 923001234567");
    }
    await this.prisma.user.update({ where: { id }, data: { email: email || null, phone: phone || null } });
    return { ok: true, email: email || null, phone: phone || null };
  }

  /** Set / clear a department's focal-person email + WhatsApp number (onboarding + reminders). */
  @Post("departments/:id/email")
  async setDepartmentContact(@Param("id") id: string, @Body() body: { email?: string; phone?: string }) {
    const email = (body.email || "").trim().toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException("Invalid email address");
    }
    const data: { email: string | null; phone?: string | null } = { email: email || null };
    if (body.phone !== undefined) {
      const phone = (body.phone || "").replace(/[^\d]/g, "");
      if (phone && (phone.length < 10 || phone.length > 15)) {
        throw new BadRequestException("Phone must be international format, e.g. 923001234567");
      }
      data.phone = phone || null;
    }
    await this.prisma.department.update({ where: { id }, data });
    return { ok: true, ...data };
  }
}
