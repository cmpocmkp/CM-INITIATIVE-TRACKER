import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { PrismaService } from "../prisma.service";

@Global()
@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.AUTH_SECRET || "dev-secret-change-me",
    }),
  ],
  controllers: [AuthController],
  providers: [PrismaService, { provide: APP_GUARD, useClass: AuthGuard }],
  exports: [PrismaService],
})
export class AuthModule {}
