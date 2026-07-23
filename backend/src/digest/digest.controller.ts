import { Controller, Get, Post } from "@nestjs/common";
import { DigestService } from "./digest.service";
import { Roles } from "../auth/decorators";

@Controller("digest")
@Roles("SUPERADMIN", "ADMIN")
export class DigestController {
  constructor(private digest: DigestService) {}

  @Get("preview")
  preview() {
    return this.digest.buildHtml();
  }

  @Post("send")
  send() {
    return this.digest.send();
  }
}
