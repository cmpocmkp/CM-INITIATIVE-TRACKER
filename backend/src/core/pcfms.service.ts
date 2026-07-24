import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import * as https from "https";
import { PrismaService } from "../prisma.service";

/**
 * PCFMS (P&D KP) CM Portal integration — pulls the government's own record for
 * every coded scheme so Category (A/B), budget, releases and expenditure fill
 * themselves. Departments keep reporting only physical progress & site status.
 *
 * Auth: OAuth password grant (token lives ~7 days, cached in-process).
 * Nightly cron 06:30 PKT + manual trigger from the Reports page.
 */

const BASE = process.env.PCFMS_BASE || "https://pcfms.pndkp.gov.pk:9002";
// The FY YearID PCFMS currently serves (2026 = FY 2026-27); bump each July.
const YEAR_ID = Number(process.env.PCFMS_YEAR_ID || 2026);

interface AdpRow {
  SchemeCode: number | string;
  SchemeName: string;
  SectorName: string;
  StatusCode: string;
  Forum: string;
  Cost: number | null;
  SchemeStatus: string;
  overall_status: string;
}
interface FinRow {
  YearID: string | number;
  OrignalBudget: number | null;
  FinalBudget: number | null;
  ProgReleases: number | null;
  ProgressiveExp: number | null;
}

@Injectable()
export class PcfmsService {
  private readonly logger = new Logger(PcfmsService.name);
  private token: { value: string; expires: number } | null = null;
  private running = false;
  lastResult: { at: string; ok: boolean; matched?: number; updated?: number; error?: string } | null = null;

  constructor(private prisma: PrismaService) {}

  private request<T>(path: string, opts: { method: string; body?: string; headers?: Record<string, string> }): Promise<T> {
    const url = new URL(BASE + path);
    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: url.hostname,
          port: url.port || 443,
          path: url.pathname + url.search,
          method: opts.method,
          headers: opts.headers,
          rejectUnauthorized: false, // government endpoint serves a cert Node distrusts
          timeout: 60000,
        },
        (res) => {
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", () => {
            if ((res.statusCode ?? 500) >= 400) return reject(new Error(`PCFMS ${res.statusCode}: ${data.slice(0, 200)}`));
            try {
              resolve(JSON.parse(data) as T);
            } catch {
              reject(new Error(`PCFMS non-JSON response: ${data.slice(0, 120)}`));
            }
          });
        },
      );
      req.on("error", reject);
      req.on("timeout", () => req.destroy(new Error("PCFMS timeout")));
      if (opts.body) req.write(opts.body);
      req.end();
    });
  }

  private async getToken(): Promise<string> {
    if (this.token && Date.now() < this.token.expires) return this.token.value;
    const user = process.env.PCFMS_USERNAME;
    const pass = process.env.PCFMS_PASSWORD;
    if (!user || !pass) throw new Error("PCFMS_USERNAME / PCFMS_PASSWORD not configured");
    const body = new URLSearchParams({ grant_type: "password", UserName: user, Password: pass }).toString();
    const r = await this.request<{ access_token: string; expires_in: number }>("/oauth/token", {
      method: "POST",
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": String(Buffer.byteLength(body)) },
    });
    // refresh a day early
    this.token = { value: r.access_token, expires: Date.now() + Math.max(3600, r.expires_in - 86400) * 1000 };
    return r.access_token;
  }

  private async portal<T>(task: Record<string, unknown>): Promise<T[]> {
    const token = await this.getToken();
    const body = JSON.stringify(task);
    const r = await this.request<{ CODE: string; Data: T[] }>("/api/pcfmsservices/getcmportaldata", {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": String(Buffer.byteLength(body)),
        Authorization: `Bearer ${token}`,
      },
    });
    return r.Data ?? [];
  }

  /** 06:30 PKT daily — refresh the government position before the working day. */
  @Cron("30 6 * * *", { timeZone: "Asia/Karachi" })
  scheduledSync() {
    return this.sync().catch((e) => this.logger.error(`PCFMS nightly sync failed: ${e.message}`));
  }

  async sync(): Promise<{ ok: boolean; matched?: number; updated?: number; error?: string }> {
    if (this.running) return { ok: false, error: "sync already running" };
    this.running = true;
    const startedAt = new Date().toISOString();
    try {
      const schemes = await this.prisma.scheme.findMany({
        where: { adpCode: { not: null } },
        select: { id: true, adpCode: true },
      });
      const byCode = new Map<string, string>();
      for (const s of schemes) {
        const m = /\d{6}/.exec(s.adpCode ?? "");
        if (m) byCode.set(m[0], s.id);
      }

      // 1) One list call gives category/status/tag for everything.
      const adp = await this.portal<AdpRow>({ Task: "GetSchemeDetails", YearID: YEAR_ID, SectorID: "" });
      const adpBy = new Map(adp.map((r) => [String(r.SchemeCode), r]));

      let matched = 0;
      let updated = 0;
      for (const [code, id] of byCode) {
        const row = adpBy.get(code);
        if (!row) continue;
        matched++;
        // 2) Per-scheme live money.
        let fin: FinRow | undefined;
        try {
          const rows = await this.portal<FinRow>({ Task: "GetSchemeFinancialDetail", SchemeCode: Number(code) });
          fin = rows.find((f) => String(f.YearID) === String(YEAR_ID)) ?? rows[0];
        } catch (e) {
          this.logger.warn(`fin detail failed for ${code}: ${(e as Error).message}`);
        }
        await this.prisma.scheme.update({
          where: { id },
          data: {
            pcfmsCategory: (row.StatusCode ?? "").trim() || null,
            pcfmsForum: (row.Forum ?? "").trim() || null,
            pcfmsTag: (row.SchemeStatus ?? "").trim() || null,
            pcfmsOverallStatus: (row.overall_status ?? "").trim() || null,
            pcfmsBudget: fin?.FinalBudget ?? null,
            pcfmsReleases: fin?.ProgReleases ?? null,
            pcfmsExpenditure: fin?.ProgressiveExp ?? null,
            pcfmsSyncedAt: new Date(),
          },
        });
        updated++;
      }
      this.lastResult = { at: startedAt, ok: true, matched, updated };
      this.logger.log(`PCFMS sync done: ${updated}/${byCode.size} schemes updated (matched ${matched})`);
      return { ok: true, matched, updated };
    } catch (e) {
      const error = (e as Error).message;
      this.lastResult = { at: startedAt, ok: false, error };
      this.logger.error(`PCFMS sync failed: ${error}`);
      return { ok: false, error };
    } finally {
      this.running = false;
    }
  }
}
