import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import * as nodemailer from "nodemailer";
import { PrismaService } from "../prisma.service";
import { CoreService } from "../core/core.service";
import { SessionUser } from "../auth/decorators";

const SYSTEM_USER: SessionUser = {
  userId: "system",
  username: "system",
  name: "System",
  role: "SUPERADMIN",
  departmentId: null,
  departmentName: null,
};

@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);

  constructor(
    private prisma: PrismaService,
    private core: CoreService,
  ) {}

  private transport() {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;
    if (!user || !pass) return null;
    return nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
  }

  recipients(): string[] {
    return (process.env.DIGEST_RECIPIENTS || process.env.GMAIL_USER || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  /** 6:00 PM Pakistan time, every day. */
  @Cron("0 18 * * *", { timeZone: "Asia/Karachi" })
  async scheduled() {
    this.logger.log("Running daily digest cron…");
    try {
      const res = await this.send();
      this.logger.log(`Digest: ${JSON.stringify(res)}`);
    } catch (e) {
      this.logger.error(`Digest failed: ${(e as Error).message}`);
    }
  }

  async send(): Promise<{ ok: boolean; reason?: string; recipients?: string[] }> {
    const transport = this.transport();
    if (!transport) return { ok: false, reason: "Gmail credentials not configured (GMAIL_USER / GMAIL_APP_PASSWORD)" };
    const to = this.recipients();
    if (!to.length) return { ok: false, reason: "No DIGEST_RECIPIENTS configured" };

    const html = await this.buildHtml();
    const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Karachi" });
    await transport.sendMail({
      from: `CM Initiative Sector <${process.env.GMAIL_USER}>`,
      to: to.join(","),
      subject: `CM Initiative Sector — Daily Progress Digest · ${today}`,
      html,
    });
    return { ok: true, recipients: to };
  }

  async buildHtml(): Promise<string> {
    const d = await this.core.dashboard(SYSTEM_USER);
    const pk = (n: number) =>
      Math.abs(n) >= 1000 ? `Rs ${(n / 1000).toFixed(1)} Bn` : `Rs ${n.toFixed(0)} M`;
    const pct = (n: number) => `${Math.round(n)}%`;

    const navy = "#0b1f3a";
    const initRows = d.initiatives
      .map(
        (i: any) => `
        <tr>
          <td style="padding:6px 10px;border-bottom:1px solid #e5eaf0;font-size:13px;color:#0b1f3a;">
            <b>#${i.number}</b> ${i.shortName}
            <div style="color:#64748b;font-size:11px;">${i.leadDepartment?.code ?? ""} · ${i.schemes} scheme(s)</div>
          </td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5eaf0;font-size:13px;text-align:right;">${pk(i.alloc)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5eaf0;font-size:13px;text-align:right;">${pk(i.spent)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5eaf0;font-size:13px;text-align:right;">
            <span style="display:inline-block;min-width:44px;padding:2px 8px;border-radius:99px;background:${i.avgPhysical >= 67 ? "#e7f4ec" : i.avgPhysical >= 34 ? "#fdf3e2" : "#fdeaea"};color:${i.avgPhysical >= 67 ? "#166534" : i.avgPhysical >= 34 ? "#92400e" : "#991b1b"};">${pct(i.avgPhysical)}</span>
          </td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5eaf0;font-size:13px;text-align:center;">${i.updatedToday > 0 ? "✅" : "—"}</td>
        </tr>`,
      )
      .join("");

    const laggards = d.compliance
      .filter((c: any) => c.schemes > 0 && c.updatedToday === 0)
      .map((c: any) => c.code)
      .join(", ");

    return `
<div style="font-family:Segoe UI,Arial,sans-serif;background:#f4f6f9;padding:24px;">
  <div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5eaf0;">
    <div style="background:${navy};padding:20px 24px;color:#fff;">
      <div style="font-size:18px;font-weight:700;">CM Initiative Sector — Daily Digest</div>
      <div style="font-size:12px;opacity:.75;margin-top:2px;">Khyber Pakhtunkhwa · Chief Minister's Priority Initiatives &amp; Sectors · ${d.today}</div>
    </div>
    <div style="padding:20px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
        <tr>
          ${[
            ["Priority Schemes", String(d.totals.count)],
            ["ADP Allocation", pk(d.totals.totalAlloc)],
            ["Expenditure", pk(d.totals.totalSpent)],
            ["Physical Progress", pct(d.totals.avgPhysical)],
            ["Updated Today", `${d.totals.updatedToday}/${d.totals.count}`],
          ]
            .map(
              ([label, value]) => `
            <td style="padding:10px;border:1px solid #e5eaf0;border-radius:8px;text-align:center;">
              <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.4px;">${label}</div>
              <div style="font-size:16px;font-weight:700;color:${navy};margin-top:2px;">${value}</div>
            </td>`,
            )
            .join('<td style="width:8px;"></td>')}
        </tr>
      </table>

      <div style="font-size:14px;font-weight:700;color:${navy};margin:18px 0 8px;">21 Focus Initiatives</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5eaf0;border-radius:8px;">
        <tr style="background:#f8fafc;">
          <th align="left" style="padding:8px 10px;font-size:11px;color:#64748b;text-transform:uppercase;">Initiative</th>
          <th align="right" style="padding:8px 10px;font-size:11px;color:#64748b;text-transform:uppercase;">Alloc</th>
          <th align="right" style="padding:8px 10px;font-size:11px;color:#64748b;text-transform:uppercase;">Spent</th>
          <th align="right" style="padding:8px 10px;font-size:11px;color:#64748b;text-transform:uppercase;">Physical</th>
          <th align="center" style="padding:8px 10px;font-size:11px;color:#64748b;text-transform:uppercase;">Today</th>
        </tr>
        ${initRows}
      </table>

      ${
        laggards
          ? `<div style="margin-top:16px;padding:10px 12px;background:#fdf3e2;border:1px solid #f5d9a8;border-radius:8px;font-size:12px;color:#92400e;">
              <b>No update submitted today:</b> ${laggards}
            </div>`
          : ""
      }

      <div style="margin-top:20px;text-align:center;">
        <a href="${process.env.APP_URL || "#"}" style="display:inline-block;background:${navy};color:#fff;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:13px;font-weight:600;">Open Live Dashboard</a>
      </div>
    </div>
    <div style="padding:12px 24px;background:#f8fafc;border-top:1px solid #e5eaf0;font-size:11px;color:#94a3b8;text-align:center;">
      Chief Minister's Policy &amp; Reform Unit (CMPO) · Government of Khyber Pakhtunkhwa
    </div>
  </div>
</div>`;
  }
}
