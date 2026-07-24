import { Injectable, NotFoundException } from "@nestjs/common";
import PDFDocument = require("pdfkit");
import { PrismaService } from "../prisma.service";
import { effectivePhysical, reportingDay } from "./core.service";

/**
 * One-page PDF reports + data-consistency reconciliation.
 * Monochrome house style: Helvetica, thin rules, no color.
 */

const M = 46; // page margin
const W = 595.28 - M * 2; // A4 width minus margins

function pdfToBuffer(doc: InstanceType<typeof PDFDocument>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

const fmtM = (n: number | null | undefined): string => {
  if (n == null) return "—";
  if (Math.abs(n) >= 1000) return `Rs ${(n / 1000).toLocaleString("en", { maximumFractionDigits: 1 })} Bn`;
  return `Rs ${n.toLocaleString("en", { maximumFractionDigits: 1 })} M`;
};
const pct = (n: number | null | undefined): string => (n == null ? "—" : `${Math.round(n)}%`);
const clean = (n: string): string => n.replace(/\s*\(PRP\)\.?/g, "");

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  private header(doc: InstanceType<typeof PDFDocument>, title: string, subtitle: string) {
    doc.font("Helvetica").fontSize(8).fillColor("#666666");
    doc.text("GOVERNMENT OF KHYBER PAKHTUNKHWA", M, M, { width: W });
    doc.text("Chief Minister Policy Office — CM Initiative Tracker", { width: W });
    doc.moveTo(M, doc.y + 6).lineTo(M + W, doc.y + 6).lineWidth(0.7).strokeColor("#111111").stroke();
    doc.moveDown(0.9);
    doc.font("Helvetica").fontSize(17).fillColor("#111111").text(title, { width: W });
    if (subtitle) doc.fontSize(9).fillColor("#555555").text(subtitle, { width: W });
    doc.moveDown(0.6);
  }

  private kpiRow(doc: InstanceType<typeof PDFDocument>, items: Array<[string, string]>) {
    const y = doc.y;
    const cw = W / items.length;
    items.forEach(([label, value], i) => {
      const x = M + i * cw;
      doc.font("Helvetica").fontSize(7).fillColor("#777777").text(label.toUpperCase(), x, y, { width: cw - 8 });
      doc.font("Helvetica").fontSize(13).fillColor("#111111").text(value, x, y + 10, { width: cw - 8 });
    });
    doc.y = y + 34;
    doc.x = M;
  }

  /** ── One-pager for a single initiative ─────────────────────── */
  async initiativeOnePager(id: string): Promise<{ buffer: Buffer; filename: string }> {
    const init = await this.prisma.initiative.findUnique({
      where: { id },
      include: {
        leadDepartment: { select: { name: true, code: true } },
        updates: { orderBy: { reportDate: "desc" }, take: 1 },
        schemes: {
          include: {
            department: { select: { code: true, name: true } },
            updates: { orderBy: { reportDate: "desc" }, take: 1 },
            subProjects: { include: { updates: { orderBy: { reportDate: "desc" }, take: 1 } } },
          },
          orderBy: { totalCost: "desc" },
        },
      },
    });
    if (!init) throw new NotFoundException("Initiative not found");

    let cost = 0, alloc = 0, spent = 0, physW = 0, w = 0, pcfmsBudget = 0, pcfmsRel = 0, catA = 0;
    for (const s of init.schemes) {
      cost += s.totalCost ?? 0;
      alloc += s.adpAllocation ?? 0;
      spent += s.updates[0]?.expenditure ?? 0;
      const weight = (s.totalCost ?? 0) > 0 ? (s.totalCost as number) : 1;
      w += weight;
      physW += (effectivePhysical(s) ?? 0) * weight;
      pcfmsBudget += s.pcfmsBudget ?? 0;
      pcfmsRel += s.pcfmsReleases ?? 0;
      if (s.pcfmsCategory === "A") catA++;
    }
    const phys = init.schemes.length ? (w ? physW / w : 0) : init.updates[0]?.physicalProgressPct ?? 0;

    const doc = new PDFDocument({ size: "A4", margin: M });
    const week = reportingDay().toISOString().slice(0, 10);
    this.header(
      doc,
      `Initiative ${init.number} — ${init.shortName}`,
      `${clean(init.name)}   ·   Lead: ${init.leadDepartment?.name ?? "—"}   ·   reporting week of ${week}`,
    );

    this.kpiRow(doc, [
      ["Schemes", String(init.schemes.length)],
      ["Cost", fmtM(cost)],
      ["FY Allocation", fmtM(alloc)],
      ["Released (P&D)", fmtM(pcfmsRel)],
      ["Expenditure", fmtM(spent)],
      ["Physical", pct(phys)],
    ]);

    if (init.schemes.length) {
      doc.fontSize(8).fillColor("#555555").text(
        `P&D position: ${catA} of ${init.schemes.length} schemes Category A (approved) · P&D FY budget ${fmtM(pcfmsBudget)}`,
        M, doc.y, { width: W },
      );
      doc.moveDown(0.7);

      // table header
      const cols = [
        { key: "code", label: "CODE", w: 44 },
        { key: "name", label: "SCHEME", w: 216 },
        { key: "dept", label: "DEPT", w: 52 },
        { key: "alloc", label: "ALLOC (M)", w: 62, right: true },
        { key: "phys", label: "PHYS", w: 34, right: true },
        { key: "stage", label: "STAGE", w: 74 },
      ];
      let y = doc.y;
      let x = M;
      doc.font("Helvetica").fontSize(6.5).fillColor("#777777");
      for (const c of cols) {
        doc.text(c.label, x, y, { width: c.w, align: c.right ? "right" : "left" });
        x += c.w + 6;
      }
      y += 11;
      doc.moveTo(M, y - 2).lineTo(M + W, y - 2).lineWidth(0.5).strokeColor("#bbbbbb").stroke();

      const maxRows = 20;
      const rows = init.schemes.slice(0, maxRows);
      for (const s of rows) {
        const vals: Record<string, string> = {
          code: (s.adpCode ?? "—").slice(0, 8),
          name: clean(s.name).slice(0, 62),
          dept: s.department?.code ?? "—",
          alloc: s.adpAllocation != null ? s.adpAllocation.toLocaleString("en", { maximumFractionDigits: 1 }) : "—",
          phys: pct(effectivePhysical(s)),
          stage: (s.stage ?? "").replace(/_/g, " ").toLowerCase(),
        };
        x = M;
        doc.font("Helvetica").fontSize(7.5).fillColor("#222222");
        const rowH = 14;
        for (const c of cols) {
          doc.text(vals[c.key], x, y, { width: c.w, align: c.right ? "right" : "left", ellipsis: true, height: rowH, lineBreak: false });
          x += c.w + 6;
        }
        y += rowH;
        doc.moveTo(M, y - 3).lineTo(M + W, y - 3).lineWidth(0.3).strokeColor("#e5e5e5").stroke();
      }
      if (init.schemes.length > maxRows) {
        doc.font("Helvetica").fontSize(7.5).fillColor("#777777").text(`… and ${init.schemes.length - maxRows} more schemes`, M, y + 2);
        y += 14;
      }
      doc.y = y;
    } else {
      doc.fontSize(9).fillColor("#555555").text("Scheme-less initiative — progress is reported directly by the lead department.", M, doc.y, { width: W });
    }

    // latest narrative
    const u = init.updates[0];
    if (u?.narrative || u?.bottlenecks) {
      doc.moveDown(0.8);
      doc.font("Helvetica").fontSize(7).fillColor("#777777").text("LATEST REPORT", M, doc.y);
      if (u?.narrative) doc.font("Helvetica").fontSize(8.5).fillColor("#222222").text(u.narrative.slice(0, 300), { width: W });
      if (u?.bottlenecks) doc.font("Helvetica").fontSize(8.5).fillColor("#111111").text(`Issues: ${u.bottlenecks.slice(0, 240)}`, { width: W });
    }

    doc.page.margins.bottom = 0;
    doc.fontSize(6.5).fillColor("#999999").text(
      `Generated ${new Date(Date.now() + 5 * 3600e3).toISOString().replace("T", " ").slice(0, 16)} PKT · CM Initiative Tracker · weekly collection (Mondays) · figures in Rs Million unless stated`,
      M, 806, { width: W, lineBreak: false },
    );

    return { buffer: await pdfToBuffer(doc), filename: `Initiative-${init.number}-OnePager.pdf` };
  }

  /** ── Official schemes: ONE page, card grid, app dark theme ── */
  async schemesListPdf(): Promise<{ buffer: Buffer; filename: string }> {
    const schemes = await this.prisma.scheme.findMany({
      where: { isOfficial: true },
      include: { department: { select: { code: true } } },
      orderBy: [{ sector: "asc" }, { adpAllocation: "desc" }],
    });

    const doc = new PDFDocument({ size: "A4", margin: 0 });
    const PW = 595.28;
    const PH = 841.89;

    // App background: charcoal with soft light wisps (radial approximations)
    doc.rect(0, 0, PW, PH).fill("#1d2024");
    doc.save();
    for (const [cx, cy, r, op] of [
      [PW * 0.82, -40, 260, 0.10],
      [-30, PH * 0.35, 220, 0.07],
      [PW * 0.5, PH + 30, 240, 0.08],
    ] as Array<[number, number, number, number]>) {
      doc.circle(cx, cy, r).fillOpacity(op).fill("#ffffff");
    }
    doc.restore().fillOpacity(1);

    // Header
    doc.font("Helvetica").fontSize(7.5).fillColor("#9aa0a6");
    doc.text("GOVERNMENT OF KHYBER PAKHTUNKHWA · CHIEF MINISTER POLICY OFFICE", 30, 24, { width: PW - 60 });
    doc.font("Helvetica").fontSize(15).fillColor("#f4f5f6").text(`Official Priority Schemes — ${schemes.length}`, 30, 36, { width: PW - 60 });
    doc.fontSize(7).fillColor("#8b9096").text(
      `FY 2026-27 · grouped by sector, ordered by allocation · card sub-line: code · department · allocation (Rs M) · generated ${new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10)}`,
      30, 56, { width: PW - 60 },
    );

    // Card grid: 3 columns
    const COLS = 3;
    const GX = 30;
    const GY = 74;
    const GAP = 5;
    const CW = (PW - GX * 2 - GAP * (COLS - 1)) / COLS;
    const rows = Math.ceil(schemes.length / COLS);
    const CH = Math.min(20, (PH - GY - 22 - GAP * (rows - 1)) / rows);

    let sector = "";
    schemes.forEach((s, idx) => {
      const col = idx % COLS;
      const row = Math.floor(idx / COLS);
      const x = GX + col * (CW + GAP);
      const y = GY + row * (CH + GAP);

      // glass card
      doc.roundedRect(x, y, CW, CH, 4).fillOpacity(0.07).fill("#ffffff");
      doc.fillOpacity(1);
      doc.roundedRect(x, y, CW, CH, 4).lineWidth(0.6).strokeOpacity(0.22).stroke("#ffffff");
      doc.strokeOpacity(1);

      const newSector = s.sector !== sector;
      if (newSector) sector = s.sector;

      doc.font("Helvetica").fontSize(6.3).fillColor("#f2f3f4");
      doc.text(clean(s.name).slice(0, 46), x + 6, y + 3.2, { width: CW - 12, lineBreak: false, ellipsis: true });
      doc.fontSize(5.4).fillColor(newSector ? "#ffffff" : "#9aa0a6");
      const alloc = s.adpAllocation != null ? s.adpAllocation.toLocaleString("en", { maximumFractionDigits: 0 }) : "—";
      doc.text(
        `${s.adpCode ?? "——"} · ${s.department?.code ?? "—"} · ${alloc}${newSector ? ` · ${s.sector.toUpperCase()}` : ""}`,
        x + 6, y + 11.6, { width: CW - 12, lineBreak: false, ellipsis: true },
      );
    });

    doc.fontSize(6).fillColor("#7a8087").text(
      "CM Initiative Tracker · weekly collection (Mondays) · one card per official scheme · bright sub-line marks the first scheme of each sector",
      30, PH - 16, { width: PW - 60, lineBreak: false },
    );

    return { buffer: await pdfToBuffer(doc), filename: "Official-Schemes-Card-Sheet.pdf" };
  }

  /** ── Consistency reconciliation: system vs P&D (PCFMS) ─────── */
  async reconciliation() {
    const schemes = await this.prisma.scheme.findMany({
      where: { isOfficial: true },
      select: {
        id: true, name: true, adpCode: true, sector: true, adpAllocation: true,
        pcfmsCategory: true, pcfmsBudget: true, pcfmsSyncedAt: true,
        department: { select: { code: true } },
      },
      orderBy: [{ sector: "asc" }, { name: "asc" }],
    });
    const bySector = new Map<string, { sector: string; ours: number; inPcfms: number; ourAlloc: number; pcfmsBudget: number }>();
    const missingInPcfms: Array<{ adpCode: string | null; name: string; sector: string; dept?: string }> = [];
    const moneyMismatches: Array<{ adpCode: string | null; name: string; ourAlloc: number | null; pcfmsBudget: number | null; diff: number }> = [];

    for (const s of schemes) {
      const r = bySector.get(s.sector) ?? { sector: s.sector, ours: 0, inPcfms: 0, ourAlloc: 0, pcfmsBudget: 0 };
      r.ours++;
      r.ourAlloc += s.adpAllocation ?? 0;
      const coded = !!s.adpCode;
      if (s.pcfmsCategory) {
        r.inPcfms++;
        r.pcfmsBudget += s.pcfmsBudget ?? 0;
        const a = s.adpAllocation ?? 0;
        const b = s.pcfmsBudget ?? 0;
        const diff = Math.abs(a - b);
        if (diff > Math.max(5, 0.05 * Math.max(a, b))) {
          moneyMismatches.push({ adpCode: s.adpCode, name: clean(s.name).slice(0, 70), ourAlloc: s.adpAllocation, pcfmsBudget: s.pcfmsBudget, diff });
        }
      } else if (coded) {
        missingInPcfms.push({ adpCode: s.adpCode, name: clean(s.name).slice(0, 70), sector: s.sector, dept: s.department?.code });
      }
      bySector.set(s.sector, r);
    }
    const lastSync = schemes.reduce<Date | null>((acc, s) => {
      const d = s.pcfmsSyncedAt ? new Date(s.pcfmsSyncedAt) : null;
      return d && (!acc || d > acc) ? d : acc;
    }, null);
    return {
      lastSync: lastSync?.toISOString() ?? null,
      totals: {
        official: schemes.length,
        coded: schemes.filter((s) => s.adpCode).length,
        matchedInPcfms: schemes.filter((s) => s.pcfmsCategory).length,
        noCode: schemes.filter((s) => !s.adpCode).length,
      },
      sectors: [...bySector.values()].sort((a, b) => b.ourAlloc - a.ourAlloc),
      missingInPcfms,
      moneyMismatches: moneyMismatches.sort((a, b) => b.diff - a.diff),
    };
  }
}
