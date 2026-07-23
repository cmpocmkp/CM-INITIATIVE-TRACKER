import { Module } from "@nestjs/common";
import { CoreModule } from "../core/core.module";
import { DigestController } from "./digest.controller";
import { DigestService } from "./digest.service";
import { WhatsappService } from "./whatsapp.service";

@Module({
  imports: [CoreModule],
  controllers: [DigestController],
  providers: [DigestService, WhatsappService],
})
export class DigestModule {}
