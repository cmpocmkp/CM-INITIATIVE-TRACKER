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

  /** 6:00 PM Pakistan time, every day — CMPO leadership digest. */
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

  /** 9:00 AM Pakistan time — remind departments that haven't filled today's sheet. */
  @Cron("0 9 * * *", { timeZone: "Asia/Karachi" })
  async scheduledReminders() {
    try {
      const res = await this.sendReminders();
      this.logger.log(`Reminders: ${JSON.stringify(res)}`);
    } catch (e) {
      this.logger.error(`Reminders failed: ${(e as Error).message}`);
    }
  }

  /** Departments (with an email set) that haven't submitted anything today get a reminder. */
  async sendReminders(): Promise<{ ok: boolean; reason?: string; sent: string[]; skipped: number }> {
    const transport = this.transport();
    if (!transport) return { ok: false, reason: "Gmail credentials not configured", sent: [], skipped: 0 };

    const d = await this.core.dashboard(SYSTEM_USER);
    const laggards = d.compliance.filter((c: any) => c.schemes > 0 && c.updatedToday === 0 && c.email);
    const appUrl = process.env.APP_URL || "#";
    const sent: string[] = [];

    for (const dept of laggards) {
      await transport.sendMail({
        from: `CM Initiative Tracker <${process.env.GMAIL_USER}>`,
        to: dept.email as string,
        subject: `Reminder: Daily progress entry pending — ${dept.code} · ${d.today}`,
        html: `
<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e5eaf0;border-radius:12px;overflow:hidden;">
  <div style="background:#0076a9;color:#fff;padding:16px 22px;">
    <b>CM Initiative Tracker</b><span style="opacity:.7"> · Government of Khyber Pakhtunkhwa</span>
  </div>
  <div style="padding:20px 22px;font-size:14px;color:#1e293b;line-height:1.6;">
    <p>Dear <b>${dept.name}</b>,</p>
    <p>Today's progress entry for your <b>${dept.schemes} priority scheme(s)</b> has not been submitted yet.
    Please fill your daily sheet — it takes a few minutes.</p>
    <p style="text-align:center;margin:22px 0;">
      <a href="${appUrl}/entry" style="background:#0076a9;color:#fff;text-decoration:none;padding:11px 26px;border-radius:8px;font-weight:600;">Fill Today's Sheet</a>
    </p>
    <p style="font-size:12px;color:#64748b;">Sign in with your department code <b>${dept.code}</b>. This reminder is sent each morning until the day's entry is received.</p>
  </div>
</div>`,
      });
      sent.push(dept.code);
    }
    return { ok: true, sent, skipped: laggards.length - sent.length };
  }

  /** One-time onboarding email: credentials + how to use. Sent per department that has an email. */
  async sendOnboarding(deptIds?: string[]): Promise<{ ok: boolean; reason?: string; sent: string[]; noEmail: string[] }> {
    const transport = this.transport();
    if (!transport) return { ok: false, reason: "Gmail credentials not configured", sent: [], noEmail: [] };

    const where = deptIds && deptIds.length ? { id: { in: deptIds } } : {};
    const depts = await this.prisma.department.findMany({
      where,
      include: { _count: { select: { schemes: true } } },
      orderBy: { name: "asc" },
    });
    const appUrl = process.env.APP_URL || "#";
    const defaultPwd = process.env.DEPARTMENT_DEFAULT_PASSWORD || "123456";
    const sent: string[] = [];
    const noEmail: string[] = [];

    for (const dept of depts) {
      if (!dept.email) {
        noEmail.push(dept.code);
        continue;
      }
      await transport.sendMail({
        from: `CM Initiative Tracker <${process.env.GMAIL_USER}>`,
        to: dept.email,
        subject: `Your login — CM Initiative Tracker (${dept.code})`,
        html: `
<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e5eaf0;border-radius:12px;overflow:hidden;">
  <div style="background:#0076a9;color:#fff;padding:16px 22px;">
    <b>CM Initiative Tracker</b><span style="opacity:.7"> · Government of Khyber Pakhtunkhwa</span>
  </div>
  <div style="padding:20px 22px;font-size:14px;color:#1e293b;line-height:1.6;">
    <p>Dear <b>${dept.name}</b>,</p>
    <p>The Chief Minister's Office is tracking daily progress of CM priority schemes.
    Your department has <b>${dept._count.schemes} scheme(s)</b> on the platform.</p>
    <table style="border-collapse:collapse;margin:14px 0;font-size:14px;">
      <tr><td style="padding:6px 14px;border:1px solid #e5eaf0;background:#f8fafc;">Web address</td><td style="padding:6px 14px;border:1px solid #e5eaf0;"><a href="${appUrl}">${appUrl}</a></td></tr>
      <tr><td style="padding:6px 14px;border:1px solid #e5eaf0;background:#f8fafc;">Username</td><td style="padding:6px 14px;border:1px solid #e5eaf0;"><b>${dept.code}</b></td></tr>
      <tr><td style="padding:6px 14px;border:1px solid #e5eaf0;background:#f8fafc;">Password</td><td style="padding:6px 14px;border:1px solid #e5eaf0;"><b>${defaultPwd}</b> <span style="color:#64748b;">(please change after first login)</span></td></tr>
    </table>
    <p><b>Every day:</b> open <a href="${appUrl}/entry">Daily Data Entry</a> and fill, for each scheme / work item:
    current phase, % complete from start, work done today, manpower &amp; machinery on site, site status, and any issues needing decisions.
    Figures are cumulative; the system computes the daily increase itself.</p>
    <p>You can add work items (e.g. individual underpasses) under any scheme with <b>+ Add work item</b>.</p>
    <p style="font-size:12px;color:#64748b;">A reminder is sent each morning if the day's entry is pending. Your data is visible only to your department and the CM Office.</p>
  </div>
</div>`,
      });
      sent.push(dept.code);
    }
    return { ok: true, sent, noEmail };
  }

  async send(): Promise<{ ok: boolean; reason?: string; recipients?: string[] }> {
    const transport = this.transport();
    if (!transport) return { ok: false, reason: "Gmail credentials not configured (GMAIL_USER / GMAIL_APP_PASSWORD)" };
    const to = this.recipients();
    if (!to.length) return { ok: false, reason: "No DIGEST_RECIPIENTS configured" };

    const html = await this.buildHtml();
    const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Karachi" });
    await transport.sendMail({
      from: `CM Initiative Tracker <${process.env.GMAIL_USER}>`,
      to: to.join(","),
      subject: `CM Initiative Tracker — Daily Progress Digest · ${today}`,
      html,
    });
    return { ok: true, recipients: to };
  }

  async buildHtml(): Promise<string> {
    const d = await this.core.dashboard(SYSTEM_USER);
    const pk = (n: number) =>
      Math.abs(n) >= 1000 ? `Rs ${(n / 1000).toFixed(1)} Bn` : `Rs ${n.toFixed(0)} M`;
    const pct = (n: number) => `${Math.round(n)}%`;

    const navy = "#0076a9";
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
      <div style="font-size:18px;font-weight:700;">CM Initiative Tracker — Daily Digest</div>
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
      ${
        (d.attention?.length ?? 0) > 0
          ? `<div style="margin-top:12px;padding:10px 12px;background:#fdeaea;border:1px solid #f3c4c4;border-radius:8px;font-size:12px;color:#991b1b;">
              <b>⚠ Sites halted / slow:</b><br/>${d.attention
                .map((a: any) => `${a.status === "HALTED" ? "⛔" : "🐢"} <b>${a.dept}</b> — ${a.name}${a.note ? ` <i>(${a.note})</i>` : ""}`)
                .join("<br/>")}
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
