import { Body, Controller, Get, Post } from "@nestjs/common";
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

  /** Send credentials/onboarding email to departments (all with email, or a subset). */
  @Post("onboarding")
  onboarding(@Body() body: { departmentIds?: string[] }) {
    return this.digest.sendOnboarding(body?.departmentIds);
  }

  /** Manually trigger the "fill your sheet" reminder to pending departments. */
  @Post("remind")
  remind() {
    return this.digest.sendReminders();
  }
}
