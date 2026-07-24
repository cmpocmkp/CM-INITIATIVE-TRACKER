import { Injectable, Logger } from "@nestjs/common";

/**
 * WhatsApp sender — two providers, first configured wins:
 *
 * 1) TWILIO (primary)
 *    TWILIO_ACCOUNT_SID      — AC…
 *    TWILIO_API_KEY_SID      — SK…
 *    TWILIO_API_KEY_SECRET   — secret for the API key
 *    TWILIO_WHATSAPP_FROM    — sender, default sandbox "whatsapp:+14155238886"
 *    (Sandbox: each recipient must once send "join <code>" to +1 415 523 8886.)
 *
 * 2) META WhatsApp Business Cloud API (fallback)
 *    WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID
 *
 * Until one provider is configured, send() is a safe no-op.
 */
@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  private get twilioConfigured(): boolean {
    return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_API_KEY_SID && process.env.TWILIO_API_KEY_SECRET);
  }

  private get metaConfigured(): boolean {
    return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
  }

  get configured(): boolean {
    return this.twilioConfigured || this.metaConfigured;
  }

  private normalize(to: string): string | null {
    let clean = to.replace(/[^\d]/g, "");
    if (clean.startsWith("0") && clean.length === 11) clean = "92" + clean.slice(1); // 03xx → 923xx
    return clean.length >= 10 ? clean : null;
  }

  /** to: international number without '+', e.g. 923001234567 (PK local 03xx auto-converts) */
  async send(to: string, text: string): Promise<{ ok: boolean; reason?: string }> {
    const clean = this.normalize(to);
    if (!clean) return { ok: false, reason: `invalid number: ${to}` };
    if (this.twilioConfigured) return this.sendTwilio(clean, text);
    if (this.metaConfigured) return this.sendMeta(clean, text);
    return { ok: false, reason: "WhatsApp not configured (Twilio or Meta env vars missing)" };
  }

  /**
   * Template send (Twilio Content API) — required for business-initiated
   * WhatsApp messages outside a 24h session. variables: {"1":"…","2":"…"}
   */
  async sendTemplate(to: string, contentSid: string, variables: Record<string, string>): Promise<{ ok: boolean; reason?: string }> {
    if (!this.twilioConfigured) return { ok: false, reason: "Twilio not configured" };
    const clean = this.normalize(to);
    if (!clean) return { ok: false, reason: `invalid number: ${to}` };
    try {
      const sid = process.env.TWILIO_ACCOUNT_SID as string;
      const from = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";
      const auth = Buffer.from(`${process.env.TWILIO_API_KEY_SID}:${process.env.TWILIO_API_KEY_SECRET}`).toString("base64");
      const body = new URLSearchParams({
        To: `whatsapp:+${clean}`,
        From: from,
        ContentSid: contentSid,
        ContentVariables: JSON.stringify(variables),
      });
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      const data = (await res.json()) as { sid?: string; status?: string; message?: string; code?: number };
      if (!res.ok) {
        this.logger.warn(`Twilio template send failed (${res.status}): ${data.message ?? ""} [code ${data.code ?? "?"}]`);
        return { ok: false, reason: `Twilio ${res.status}: ${data.message ?? "error"}` };
      }
      this.logger.log(`Twilio template ${contentSid.slice(0, 10)} queued ${data.sid} -> +${clean}`);
      return { ok: true };
    } catch (e) {
      this.logger.error(`Twilio template send error: ${(e as Error).message}`);
      return { ok: false, reason: (e as Error).message };
    }
  }

  private async sendTwilio(clean: string, text: string): Promise<{ ok: boolean; reason?: string }> {
    try {
      const sid = process.env.TWILIO_ACCOUNT_SID as string;
      const from = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";
      const auth = Buffer.from(`${process.env.TWILIO_API_KEY_SID}:${process.env.TWILIO_API_KEY_SECRET}`).toString("base64");
      const body = new URLSearchParams({ To: `whatsapp:+${clean}`, From: from, Body: text });
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      const data = (await res.json()) as { sid?: string; status?: string; message?: string; code?: number };
      if (!res.ok) {
        this.logger.warn(`Twilio send failed (${res.status}): ${data.message ?? ""} [code ${data.code ?? "?"}]`);
        return { ok: false, reason: `Twilio ${res.status}: ${data.message ?? "error"}` };
      }
      this.logger.log(`Twilio WhatsApp queued ${data.sid} -> +${clean} (${data.status})`);
      return { ok: true };
    } catch (e) {
      this.logger.error(`Twilio send error: ${(e as Error).message}`);
      return { ok: false, reason: (e as Error).message };
    }
  }

  private async sendMeta(clean: string, text: string): Promise<{ ok: boolean; reason?: string }> {
    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: clean, type: "text", text: { preview_url: true, body: text } }),
      });
      if (!res.ok) {
        const body = await res.text();
        this.logger.warn(`Meta WhatsApp send failed (${res.status}): ${body.slice(0, 300)}`);
        return { ok: false, reason: `API ${res.status}` };
      }
      return { ok: true };
    } catch (e) {
      this.logger.error(`Meta WhatsApp send error: ${(e as Error).message}`);
      return { ok: false, reason: (e as Error).message };
    }
  }
}
