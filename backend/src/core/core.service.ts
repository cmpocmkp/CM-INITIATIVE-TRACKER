import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, SchemeStage } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { SessionUser } from "../auth/decorators";

export type EntityType = "SCHEME" | "INITIATIVE";

export interface SheetEntryInput {
  entityType: EntityType;
  entityId: string;
  fundsReleased?: number | null;
  expenditure?: number | null;
  financialProgressPct?: number | null;
  physicalProgressPct?: number | null;
  stage?: SchemeStage | null;
  narrative?: string | null;
  bottlenecks?: string | null;
}

const STAGES: SchemeStage[] = [
  "NOT_STARTED", "FEASIBILITY", "PC1_APPROVAL", "TENDERING", "EXECUTION", "COMPLETED", "ON_HOLD",
];

export function dateOnly(input?: string): Date {
  const d = input ? new Date(input + "T00:00:00.000Z") : new Date();
  if (isNaN(d.getTime())) throw new BadRequestException("Invalid date");
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function isStaff(user: SessionUser) {
  return user.role === "SUPERADMIN" || user.role === "ADMIN";
}

@Injectable()
export class CoreService {
  constructor(private prisma: PrismaService) {}

  /** Scheme where-clause scoped to the caller (departments only ever see their own). */
  schemeScope(user: SessionUser): Prisma.SchemeWhereInput {
    if (isStaff(user)) return {};
    if (!user.departmentId) throw new ForbiddenException("No department attached to this account");
    return { departmentId: user.departmentId };
  }

  initiativeScope(user: SessionUser): Prisma.InitiativeWhereInput {
    if (isStaff(user)) return {};
    return { leadDepartmentId: user.departmentId ?? "___none___" };
  }

  // ── Reference data ────────────────────────────────────────────
  async departments(user: SessionUser) {
    const where: Prisma.DepartmentWhereInput = isStaff(user) ? {} : { id: user.departmentId ?? "___none___" };
    const depts = await this.prisma.department.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        _count: { select: { schemes: true, ledInitiatives: true } },
      },
    });
    return depts;
  }

  async departmentDetail(user: SessionUser, id: string) {
    if (!isStaff(user) && user.departmentId !== id) {
      throw new ForbiddenException("Departments can only view their own data");
    }
    const dept = await this.prisma.department.findUnique({
      where: { id },
      include: {
        schemes: { include: { updates: { orderBy: { reportDate: "desc" }, take: 1 }, initiative: true }, orderBy: { name: "asc" } },
        ledInitiatives: { include: { updates: { orderBy: { reportDate: "desc" }, take: 1 } } },
      },
    });
    if (!dept) throw new NotFoundException("Department not found");
    return dept;
  }

  async initiatives(user: SessionUser) {
    // Everyone may see the list of 21 initiatives (national picture),
    // but rollups for a department user only include what they can see? No —
    // initiative rollups are aggregate; schemes inside remain visible only via detail.
    const inits = await this.prisma.initiative.findMany({
      orderBy: { number: "asc" },
      include: {
        leadDepartment: { select: { id: true, name: true, code: true } },
        updates: { orderBy: { reportDate: "desc" }, take: 1 },
        schemes: { include: { updates: { orderBy: { reportDate: "desc" }, take: 1 } } },
      },
    });
    return inits;
  }

  async initiativeDetail(user: SessionUser, id: string) {
    const init = await this.prisma.initiative.findUnique({
      where: { id },
      include: {
        leadDepartment: { select: { id: true, name: true, code: true } },
        updates: { orderBy: { reportDate: "desc" }, take: 30 },
        schemes: {
          where: isStaff(user) ? {} : { departmentId: user.departmentId ?? "___none___" },
          include: {
            department: { select: { id: true, name: true, code: true } },
            updates: { orderBy: { reportDate: "desc" }, take: 1 },
          },
          orderBy: { name: "asc" },
        },
      },
    });
    if (!init) throw new NotFoundException("Initiative not found");

    // Trend: last 30 days of updates across this initiative's schemes + itself
    const since = new Date(Date.now() - 30 * 86400000);
    const trend = await this.prisma.progressUpdate.findMany({
      where: {
        reportDate: { gte: since },
        OR: [{ initiativeId: id }, { scheme: { initiativeId: id } }],
      },
      orderBy: { reportDate: "asc" },
      select: { reportDate: true, physicalProgressPct: true, financialProgressPct: true, expenditure: true },
    });
    return { ...init, trend };
  }

  async schemes(user: SessionUser, q?: { departmentId?: string; initiativeId?: string; search?: string }) {
    const where: Prisma.SchemeWhereInput = {
      AND: [
        this.schemeScope(user),
        q?.departmentId ? { departmentId: q.departmentId } : {},
        q?.initiativeId ? { initiativeId: q.initiativeId } : {},
        q?.search
          ? {
              OR: [
                { name: { contains: q.search, mode: "insensitive" } },
                { adpCode: { contains: q.search } },
                { sector: { contains: q.search, mode: "insensitive" } },
              ],
            }
          : {},
      ],
    };
    return this.prisma.scheme.findMany({
      where,
      include: {
        department: { select: { id: true, name: true, code: true } },
        initiative: { select: { id: true, number: true, shortName: true } },
        updates: { orderBy: { reportDate: "desc" }, take: 1 },
      },
      orderBy: [{ sector: "asc" }, { name: "asc" }],
    });
  }

  async schemeDetail(user: SessionUser, id: string) {
    const scheme = await this.prisma.scheme.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true, code: true } },
        initiative: { select: { id: true, number: true, name: true, shortName: true } },
        updates: { orderBy: { reportDate: "desc" }, take: 60, include: { submittedBy: { select: { name: true, username: true } } } },
      },
    });
    if (!scheme) throw new NotFoundException("Scheme not found");
    if (!isStaff(user) && scheme.departmentId !== user.departmentId) {
      throw new ForbiddenException("Departments can only view their own schemes");
    }
    return scheme;
  }

  // ── Daily sheet (Excel-style) ────────────────────────────────
  async sheet(user: SessionUser, dateStr?: string) {
    const date = dateOnly(dateStr);
    const schemes = await this.prisma.scheme.findMany({
      where: this.schemeScope(user),
      include: {
        department: { select: { id: true, name: true, code: true } },
        initiative: { select: { id: true, number: true, shortName: true } },
        updates: { orderBy: { reportDate: "desc" }, take: 1 },
      },
      orderBy: [{ sector: "asc" }, { name: "asc" }],
    });
    const initiatives = await this.prisma.initiative.findMany({
      where: this.initiativeScope(user),
      include: {
        leadDepartment: { select: { id: true, name: true, code: true } },
        updates: { orderBy: { reportDate: "desc" }, take: 1 },
      },
      orderBy: { number: "asc" },
    });

    const dayUpdates = await this.prisma.progressUpdate.findMany({
      where: {
        reportDate: date,
        OR: [
          { schemeId: { in: schemes.map((s) => s.id) } },
          { initiativeId: { in: initiatives.map((i) => i.id) } },
        ],
      },
    });
    const byScheme = new Map(dayUpdates.filter((u) => u.schemeId).map((u) => [u.schemeId as string, u]));
    const byInit = new Map(dayUpdates.filter((u) => u.initiativeId).map((u) => [u.initiativeId as string, u]));

    const rows = [
      ...initiatives.map((i) => ({
        entityType: "INITIATIVE" as const,
        entityId: i.id,
        name: `[Initiative ${i.number}] ${i.name}`,
        adpCode: null as string | null,
        sector: i.leadDepartment?.code ?? "—",
        department: i.leadDepartment,
        totalCost: null as number | null,
        adpAllocation: null as number | null,
        isPRP: false,
        today: byInit.get(i.id) ?? null,
        latest: i.updates[0] ?? null,
      })),
      ...schemes.map((s) => ({
        entityType: "SCHEME" as const,
        entityId: s.id,
        name: s.name,
        adpCode: s.adpCode,
        sector: s.sector,
        department: s.department,
        totalCost: s.totalCost,
        adpAllocation: s.adpAllocation,
        isPRP: s.isPRP,
        initiative: s.initiative,
        today: byScheme.get(s.id) ?? null,
        latest: s.updates[0] ?? null,
      })),
    ];
    return { date: date.toISOString().slice(0, 10), rows };
  }

  async saveSheet(user: SessionUser, dateStr: string, entries: SheetEntryInput[]) {
    if (!Array.isArray(entries) || !entries.length) throw new BadRequestException("No entries to save");
    if (entries.length > 500) throw new BadRequestException("Too many entries");
    const date = dateOnly(dateStr);

    // Ownership sets
    const myScheme = new Set(
      (await this.prisma.scheme.findMany({ where: this.schemeScope(user), select: { id: true } })).map((s) => s.id),
    );
    const myInit = new Set(
      (await this.prisma.initiative.findMany({ where: this.initiativeScope(user), select: { id: true } })).map((i) => i.id),
    );

    let saved = 0;
    const errors: string[] = [];

    for (const e of entries) {
      try {
        if (e.entityType === "SCHEME" && !myScheme.has(e.entityId)) throw new Error("not your scheme");
        if (e.entityType === "INITIATIVE" && !myInit.has(e.entityId)) throw new Error("not your initiative");

        const clean = {
          fundsReleased: numOrNull(e.fundsReleased),
          expenditure: numOrNull(e.expenditure),
          financialProgressPct: pctOrNull(e.financialProgressPct),
          physicalProgressPct: pctOrNull(e.physicalProgressPct),
          stage: e.stage && STAGES.includes(e.stage) ? e.stage : undefined,
          narrative: strOrNull(e.narrative),
          bottlenecks: strOrNull(e.bottlenecks),
          submittedById: user.userId,
        };

        // Skip totally empty rows (nothing entered)
        const hasData =
          clean.fundsReleased != null || clean.expenditure != null || clean.financialProgressPct != null ||
          clean.physicalProgressPct != null || clean.stage != null || clean.narrative || clean.bottlenecks;
        if (!hasData) continue;

        const keyWhere =
          e.entityType === "SCHEME"
            ? { schemeId_reportDate: { schemeId: e.entityId, reportDate: date } }
            : { initiativeId_reportDate: { initiativeId: e.entityId, reportDate: date } };

        await this.prisma.progressUpdate.upsert({
          where: keyWhere as never,
          update: clean,
          create: {
            ...clean,
            stage: clean.stage ?? "NOT_STARTED",
            reportDate: date,
            schemeId: e.entityType === "SCHEME" ? e.entityId : null,
            initiativeId: e.entityType === "INITIATIVE" ? e.entityId : null,
          },
        });
        saved++;
      } catch (err) {
        errors.push(`${e.entityType}:${e.entityId} — ${(err as Error).message}`);
      }
    }
    return { ok: errors.length === 0, saved, errors };
  }

  // ── Dashboard rollups ────────────────────────────────────────
  async dashboard(user: SessionUser) {
    const today = dateOnly();
    const scoped = !isStaff(user);

    const schemes = await this.prisma.scheme.findMany({
      where: this.schemeScope(user),
      include: {
        department: { select: { id: true, name: true, code: true } },
        initiative: { select: { id: true, number: true, shortName: true, category: true } },
        updates: { orderBy: { reportDate: "desc" }, take: 1 },
      },
    });

    const roll = rollup(schemes.map((s) => ({ cost: s.totalCost, alloc: s.adpAllocation, u: s.updates[0] ?? null })), today);

    // Stage distribution
    const stageDist: Record<string, number> = {};
    for (const s of schemes) {
      const st = s.updates[0]?.stage ?? "NOT_STARTED";
      stageDist[st] = (stageDist[st] || 0) + 1;
    }

    // Sector (=Department) rollup
    const bySector = new Map<string, { sector: string; count: number; cost: number; alloc: number; spent: number; physW: number; w: number; updatedToday: number }>();
    for (const s of schemes) {
      const key = s.sector;
      const rec = bySector.get(key) ?? { sector: key, count: 0, cost: 0, alloc: 0, spent: 0, physW: 0, w: 0, updatedToday: 0 };
      const u = s.updates[0] ?? null;
      rec.count++;
      rec.cost += s.totalCost ?? 0;
      rec.alloc += s.adpAllocation ?? 0;
      rec.spent += u?.expenditure ?? 0;
      const w = (s.totalCost ?? 0) > 0 ? (s.totalCost as number) : 1;
      rec.w += w;
      rec.physW += (u?.physicalProgressPct ?? 0) * w;
      if (u && sameDay(u.reportDate, today)) rec.updatedToday++;
      bySector.set(key, rec);
    }
    const sectors = [...bySector.values()]
      .map((r) => ({ sector: r.sector, count: r.count, cost: r.cost, alloc: r.alloc, spent: r.spent, avgPhysical: r.w ? r.physW / r.w : 0, updatedToday: r.updatedToday }))
      .sort((a, b) => b.alloc - a.alloc);

    // Initiative rollup (staff always; department sees only their contribution)
    const inits = await this.prisma.initiative.findMany({
      orderBy: { number: "asc" },
      include: {
        leadDepartment: { select: { id: true, name: true, code: true } },
        updates: { orderBy: { reportDate: "desc" }, take: 1 },
        schemes: {
          where: scoped ? { departmentId: user.departmentId ?? "___none___" } : {},
          include: { updates: { orderBy: { reportDate: "desc" }, take: 1 } },
        },
      },
    });
    const initiatives = inits
      .map((i) => {
        const r = rollup(i.schemes.map((s) => ({ cost: s.totalCost, alloc: s.adpAllocation, u: s.updates[0] ?? null })), today);
        const own = i.updates[0] ?? null;
        return {
          id: i.id,
          number: i.number,
          name: i.name,
          shortName: i.shortName,
          category: i.category,
          leadDepartment: i.leadDepartment,
          schemes: r.count,
          cost: r.totalCost,
          alloc: r.totalAlloc,
          spent: r.totalSpent,
          avgPhysical: r.count ? r.avgPhysical : own?.physicalProgressPct ?? 0,
          updatedToday: r.updatedToday + (own && sameDay(own.reportDate, today) ? 1 : 0),
          latestOwn: own,
        };
      })
      .filter((i) => !scoped || i.schemes > 0 || inits.find((x) => x.id === i.id)?.leadDepartment?.id === user.departmentId);

    // Compliance by department (staff only)
    let compliance: { id: string; name: string; code: string; schemes: number; updatedToday: number; reported: number }[] = [];
    if (!scoped) {
      const depts = await this.prisma.department.findMany({
        orderBy: { name: "asc" },
        include: { schemes: { include: { updates: { orderBy: { reportDate: "desc" }, take: 1 } } } },
      });
      compliance = depts.map((d) => {
        let updatedToday = 0;
        let reported = 0;
        for (const s of d.schemes) {
          const u = s.updates[0];
          if (u) {
            reported++;
            if (sameDay(u.reportDate, today)) updatedToday++;
          }
        }
        return { id: d.id, name: d.name, code: d.code, schemes: d.schemes.length, updatedToday, reported };
      });
    }

    return {
      role: user.role,
      department: scoped ? { id: user.departmentId, name: user.departmentName } : null,
      totals: roll,
      stageDist,
      sectors,
      initiatives,
      compliance,
      today: today.toISOString().slice(0, 10),
    };
  }

  // ── CSV export ───────────────────────────────────────────────
  async schemesCsv(user: SessionUser): Promise<string> {
    const schemes = await this.schemes(user);
    const header = [
      "S.No", "ADP Code", "Scheme", "Sector/Dept", "Initiative", "Total Cost (M)", "ADP Allocation (M)",
      "Funds Released (M)", "Expenditure (M)", "Financial %", "Physical %", "Stage", "Last Report Date", "Bottlenecks",
    ];
    const lines = [header.join(",")];
    schemes.forEach((s, idx) => {
      const u = s.updates[0];
      lines.push(
        [
          idx + 1,
          s.adpCode ?? "",
          csv(s.name),
          csv(s.sector),
          csv(s.initiative ? `#${s.initiative.number} ${s.initiative.shortName}` : ""),
          s.totalCost ?? "",
          s.adpAllocation ?? "",
          u?.fundsReleased ?? "",
          u?.expenditure ?? "",
          u?.financialProgressPct ?? "",
          u?.physicalProgressPct ?? "",
          u?.stage ?? "",
          u ? new Date(u.reportDate).toISOString().slice(0, 10) : "",
          csv(u?.bottlenecks ?? ""),
        ].join(","),
      );
    });
    return lines.join("\r\n");
  }
}

// ── helpers ────────────────────────────────────────────────────
function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!isFinite(n) || n < 0) return null;
  return n;
}
function pctOrNull(v: unknown): number | null {
  const n = numOrNull(v);
  if (n == null) return null;
  return Math.max(0, Math.min(100, n));
}
function strOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s.slice(0, 2000) : null;
}
function sameDay(a: Date, b: Date): boolean {
  return new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10);
}
function csv(s: string): string {
  return `"${(s || "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
}

export function rollup(
  items: { cost: number | null; alloc: number | null; u: { expenditure: number | null; fundsReleased: number | null; physicalProgressPct: number | null; financialProgressPct: number | null; reportDate: Date; stage: SchemeStage } | null }[],
  today: Date,
) {
  let totalCost = 0, totalAlloc = 0, totalReleased = 0, totalSpent = 0, physW = 0, finW = 0, w = 0;
  let updatedToday = 0, reported = 0, completed = 0;
  for (const it of items) {
    totalCost += it.cost ?? 0;
    totalAlloc += it.alloc ?? 0;
    const u = it.u;
    totalReleased += u?.fundsReleased ?? 0;
    totalSpent += u?.expenditure ?? 0;
    const weight = (it.cost ?? 0) > 0 ? (it.cost as number) : 1;
    w += weight;
    physW += (u?.physicalProgressPct ?? 0) * weight;
    finW += (u?.financialProgressPct ?? 0) * weight;
    if (u) {
      reported++;
      if (sameDay(u.reportDate, today)) updatedToday++;
      if (u.stage === "COMPLETED") completed++;
    }
  }
  return {
    count: items.length,
    totalCost, totalAlloc, totalReleased, totalSpent,
    avgPhysical: w ? physW / w : 0,
    avgFinancial: w ? finW / w : 0,
    updatedToday, reported, completed,
  };
}
