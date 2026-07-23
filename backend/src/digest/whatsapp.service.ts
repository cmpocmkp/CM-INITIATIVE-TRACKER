import { Injectable, Logger } from "@nestjs/common";

/**
 * WhatsApp sender — Meta WhatsApp Business Cloud API.
 * Configure via env:
 *   WHATSAPP_TOKEN            — permanent access token
 *   WHATSAPP_PHONE_NUMBER_ID  — sender phone-number id from the Meta app
 * Until both are set, send() is a safe no-op that reports "not configured".
 */
@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  get configured(): boolean {
    return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
  }

  /** to: international number without '+', e.g. 923001234567 */
  async send(to: string, text: string): Promise<{ ok: boolean; reason?: string }> {
    if (!this.configured) return { ok: false, reason: "WhatsApp not configured (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID)" };
    const clean = to.replace(/[^\d]/g, "");
    if (clean.length < 10) return { ok: false, reason: `invalid number: ${to}` };
    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: clean,
            type: "text",
            text: { preview_url: true, body: text },
          }),
        },
      );
      if (!res.ok) {
        const body = await res.text();
        this.logger.warn(`WhatsApp send failed (${res.status}): ${body.slice(0, 300)}`);
        return { ok: false, reason: `API ${res.status}` };
      }
      return { ok: true };
    } catch (e) {
      this.logger.error(`WhatsApp send error: ${(e as Error).message}`);
      return { ok: false, reason: (e as Error).message };
    }
  }
}
