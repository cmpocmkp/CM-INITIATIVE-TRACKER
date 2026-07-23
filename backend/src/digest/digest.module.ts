import { Module } from "@nestjs/common";
import { CoreModule } from "../core/core.module";
import { DigestController } from "./digest.controller";
import { DigestService } from "./digest.service";

@Module({
  imports: [CoreModule],
  controllers: [DigestController],
  providers: [DigestService],
})
export class DigestModule {}
