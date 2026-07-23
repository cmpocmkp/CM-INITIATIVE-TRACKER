import "reflect-metadata";
// Load env from backend/.env (and root .env) regardless of cwd — Railway injects
// real env vars, so missing files are fine.
import * as dotenv from "dotenv";
import { join as jpath } from "path";
dotenv.config({ path: jpath(__dirname, "..", ".env") });
dotenv.config({ path: jpath(process.cwd(), "backend", ".env") });
dotenv.config({ path: jpath(process.cwd(), ".env") });
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import { join } from "path";
import * as fs from "fs";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.use(cookieParser());
  app.setGlobalPrefix("api");

  // Serve the built frontend (monolith deployment).
  const dist = [
    join(process.cwd(), "frontend", "dist"),
    join(__dirname, "..", "..", "frontend", "dist"),
  ].find((p) => fs.existsSync(p));
  if (dist) {
    app.useStaticAssets(dist);
    const express = app.getHttpAdapter().getInstance();
    // SPA fallback: any non-API GET serves index.html
    express.get(/^(?!\/api).*/, (_req: unknown, res: { sendFile: (p: string) => void }) =>
      res.sendFile(join(dist, "index.html")),
    );
  }

  const port = Number(process.env.PORT || 4000);
  await app.listen(port, "0.0.0.0");
  console.log(`CM INITIATIVE SECTOR backend running on :${port} (frontend: ${dist ?? "dev proxy"})`);
}

bootstrap();
