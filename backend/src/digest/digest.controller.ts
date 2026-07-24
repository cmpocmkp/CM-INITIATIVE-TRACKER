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

  /** Manually trigger the "fill your sheet" reminder to pending departments (attempt 1-4 escalates wording). */
  @Post("remind")
  remind(@Body() body: { attempt?: number }) {
    return this.digest.sendReminders(body?.attempt ?? 1);
  }

  /** Manually send the WhatsApp daily progress report to the leadership list. */
  @Post("whatsapp-report")
  whatsappReport() {
    return this.digest.sendWhatsappReport();
  }

}
