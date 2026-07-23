import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, SchemeStage, SiteStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { SessionUser } from "../auth/decorators";

export type EntityType = "SCHEME" | "INITIATIVE" | "SUBPROJECT";

export interface SheetEntryInput {
  entityType: EntityType;
  entityId: string;
  phase?: string | null;
  physicalProgressPct?: number | null;
  narrative?: string | null;
  manpower?: number | null;
  machinery?: number | null;
  siteStatus?: SiteStatus | null;
  bottlenecks?: string | null;
  remarks?: string | null;
  fundsReleased?: number | null;
  expenditure?: number | null;
}

const SITE_STATUSES: SiteStatus[] = ["NOT_STARTED", "ACTIVE", "SLOW", "HALTED", "COMPLETED"];
const LIFECYCLE: SchemeStage[] = [
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

type Upd = {
  reportDate: Date;
  physicalProgressPct: number | null;
  financialProgressPct: number | null;
  expenditure: number | null;
  fundsReleased: number | null;
  siteStatus: SiteStatus;
};

/** Effective latest physical % of a scheme — rolls up sub-projects when present. */
export function effectivePhysical(
  scheme: { updates: Upd[]; subProjects?: { weight: number | null; updates: Upd[] }[] },
): number | null {
  const subs = scheme.subProjects ?? [];
  if (subs.length) {
    let w = 0;
    let acc = 0;
    for (const sp of subs) {
      const weight = sp.weight && sp.weight > 0 ? sp.weight : 1;
      w += weight;
      acc += (sp.updates[0]?.physicalProgressPct ?? 0) * weight;
    }
    return w ? acc / w : null;
  }
  return scheme.updates[0]?.physicalProgressPct ?? null;
}

@Injectable()
export class CoreService {
  constructor(private prisma: PrismaService) {}

  schemeScope(user: SessionUser): Prisma.SchemeWhereInput {
    if (isStaff(user)) return {};
    if (!user.departmentId) throw new ForbiddenException("No department attached to this account");
    return { departmentId: user.departmentId };
  }

  initiativeScope(user: SessionUser): Prisma.InitiativeWhereInput {
    if (isStaff(user)) return {};
    return { leadDepartmentId: user.departmentId ?? "___none___" };
  }

  private latestInclude = {
    updates: { orderBy: { reportDate: "desc" as const }, take: 1 },
    subProjects: { include: { updates: { orderBy: { reportDate: "desc" as const }, take: 1 } } },
  };

  // ── Reference data ────────────────────────────────────────────
  async departments(user: SessionUser) {
    const where: Prisma.DepartmentWhereInput = isStaff(user) ? {} : { id: user.departmentId ?? "___none___" };
    return this.prisma.department.findMany({
      where,
      orderBy: { name: "asc" },
      include: { _count: { select: { schemes: true, ledInitiatives: true } } },
    });
  }

  async departmentDetail(user: SessionUser, id: string) {
    if (!isStaff(user) && user.departmentId !== id) {
      throw new ForbiddenException("Departments can only view their own data");
    }
    const dept = await this.prisma.department.findUnique({
      where: { id },
      include: {
        schemes: { include: { ...this.latestInclude, initiative: true }, orderBy: { name: "asc" } },
        ledInitiatives: { include: { updates: { orderBy: { reportDate: "desc" }, take: 1 } } },
      },
    });
    if (!dept) throw new NotFoundException("Department not found");
    return {
      ...dept,
      schemes: dept.schemes.map((s) => ({ ...s, effectivePhysical: effectivePhysical(s) })),
    };
  }

  async initiatives(_user: SessionUser) {
    return this.prisma.initiative.findMany({
      orderBy: { number: "asc" },
      include: {
        leadDepartment: { select: { id: true, name: true, code: true } },
        updates: { orderBy: { reportDate: "desc" }, take: 1 },
        schemes: { include: this.latestInclude },
      },
    });
  }

  async initiativeDetail(user: SessionUser, id: string) {
    const init = await this.prisma.initiative.findUnique({
      where: { id },
      include: {
        leadDepartment: { select: { id: true, name: true, code: true } },
        updates: { orderBy: { reportDate: "desc" }, take: 30 },
        schemes: {
          where: isStaff(user) ? {} : { departmentId: user.departmentId ?? "___none___" },
          include: { ...this.latestInclude, department: { select: { id: true, name: true, code: true } } },
          orderBy: { name: "asc" },
        },
      },
    });
    if (!init) throw new NotFoundException("Initiative not found");

    const since = new Date(Date.now() - 30 * 86400000);
    const trend = await this.prisma.progressUpdate.findMany({
      where: {
        reportDate: { gte: since },
        OR: [
          { initiativeId: id },
          { scheme: { initiativeId: id } },
          { subProject: { scheme: { initiativeId: id } } },
        ],
      },
      orderBy: { reportDate: "asc" },
      select: { reportDate: true, physicalProgressPct: true, financialProgressPct: true, expenditure: true },
    });
    return {
      ...init,
      schemes: init.schemes.map((s) => ({ ...s, effectivePhysical: effectivePhysical(s) })),
      trend,
    };
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
    const list = await this.prisma.scheme.findMany({
      where,
      include: {
        ...this.latestInclude,
        department: { select: { id: true, name: true, code: true } },
        initiative: { select: { id: true, number: true, shortName: true } },
      },
      orderBy: [{ sector: "asc" }, { name: "asc" }],
    });
    return list.map((s) => ({ ...s, effectivePhysical: effectivePhysical(s) }));
  }

  async schemeDetail(user: SessionUser, id: string) {
    const scheme = await this.prisma.scheme.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true, code: true } },
        initiative: { select: { id: true, number: true, name: true, shortName: true } },
        updates: {
          orderBy: { reportDate: "desc" },
          take: 90,
          include: { submittedBy: { select: { name: true, username: true } } },
        },
        subProjects: {
          orderBy: { createdAt: "asc" },
          include: {
            updates: {
              orderBy: { reportDate: "desc" },
              take: 30,
              include: { submittedBy: { select: { name: true, username: true } } },
            },
          },
        },
      },
    });
    if (!scheme) throw new NotFoundException("Scheme not found");
    if (!isStaff(user) && scheme.departmentId !== user.departmentId) {
      throw new ForbiddenException("Departments can only view their own schemes");
    }
    return { ...scheme, effectivePhysical: effectivePhysical(scheme) };
  }

  /** Owner department (or staff) updates the scheme lifecycle stage (PC-1 etc.). */
  async setSchemeStage(user: SessionUser, id: string, stage: SchemeStage) {
    if (!LIFECYCLE.includes(stage)) throw new BadRequestException("Invalid stage");
    const scheme = await this.prisma.scheme.findUnique({ where: { id }, select: { departmentId: true } });
    if (!scheme) throw new NotFoundException("Scheme not found");
    if (!isStaff(user) && scheme.departmentId !== user.departmentId) {
      throw new ForbiddenException("Not your scheme");
    }
    await this.prisma.scheme.update({ where: { id }, data: { stage } });
    return { ok: true };
  }

  // ── Sub-projects (work items) ────────────────────────────────
  private async assertSchemeOwner(user: SessionUser, schemeId: string) {
    const scheme = await this.prisma.scheme.findUnique({ where: { id: schemeId }, select: { departmentId: true } });
    if (!scheme) throw new NotFoundException("Scheme not found");
    if (!isStaff(user) && scheme.departmentId !== user.departmentId) {
      throw new ForbiddenException("Not your scheme");
    }
  }

  async createSubProject(
    user: SessionUser,
    body: { schemeId?: string; name?: string; description?: string; weight?: number; targetDate?: string },
  ) {
    const schemeId = (body.schemeId || "").trim();
    const name = (body.name || "").trim();
    if (!schemeId || !name) throw new BadRequestException("schemeId and name are required");
    await this.assertSchemeOwner(user, schemeId);
    const weight = body.weight != null && isFinite(Number(body.weight)) && Number(body.weight) > 0 ? Number(body.weight) : null;
    const targetDate = body.targetDate ? dateOnly(body.targetDate) : null;
    return this.prisma.subProject.create({
      data: { schemeId, name: name.slice(0, 300), description: (body.description || "").trim().slice(0, 1000) || null, weight, targetDate },
    });
  }

  async updateSubProject(
    user: SessionUser,
    id: string,
    body: { name?: string; description?: string; weight?: number | null; targetDate?: string | null },
  ) {
    const sp = await this.prisma.subProject.findUnique({ where: { id }, select: { schemeId: true } });
    if (!sp) throw new NotFoundException("Work item not found");
    await this.assertSchemeOwner(user, sp.schemeId);
    const data: Prisma.SubProjectUpdateInput = {};
    if (body.name !== undefined) {
      const name = (body.name || "").trim();
      if (!name) throw new BadRequestException("Name cannot be empty");
      data.name = name.slice(0, 300);
    }
    if (body.description !== undefined) data.description = (body.description || "").trim().slice(0, 1000) || null;
    if (body.weight !== undefined)
      data.weight = body.weight != null && isFinite(Number(body.weight)) && Number(body.weight) > 0 ? Number(body.weight) : null;
    if (body.targetDate !== undefined) data.targetDate = body.targetDate ? dateOnly(body.targetDate) : null;
    await this.prisma.subProject.update({ where: { id }, data });
    return { ok: true };
  }

  async deleteSubProject(user: SessionUser, id: string) {
    const sp = await this.prisma.subProject.findUnique({ where: { id }, select: { schemeId: true } });
    if (!sp) throw new NotFoundException("Work item not found");
    await this.assertSchemeOwner(user, sp.schemeId);
    await this.prisma.subProject.delete({ where: { id } }); // cascades its updates
    return { ok: true };
  }

  // ── Daily sheet (Excel-style, with Δ vs previous report) ─────
  async sheet(user: SessionUser, dateStr?: string) {
    const date = dateOnly(dateStr);

    const schemes = await this.prisma.scheme.findMany({
      where: this.schemeScope(user),
      include: {
        department: { select: { id: true, name: true, code: true } },
        initiative: { select: { id: true, number: true, shortName: true } },
        subProjects: { orderBy: { createdAt: "asc" } },
      },
      orderBy: [{ sector: "asc" }, { name: "asc" }],
    });
    // Led initiatives — include ALL their schemes (any dept) so the row can be
    // auto-computed instead of asking the lead dept to type the same data twice.
    const initiatives = await this.prisma.initiative.findMany({
      where: this.initiativeScope(user),
      include: {
        leadDepartment: { select: { id: true, name: true, code: true } },
        schemes: { include: this.latestInclude },
      },
      orderBy: { number: "asc" },
    });

    const schemeIds = schemes.map((s) => s.id);
    const initIds = initiatives.map((i) => i.id);
    const subIds = schemes.flatMap((s) => s.subProjects.map((sp) => sp.id));

    // Updates on the selected date + the latest BEFORE the date (for Δ) + latest ever (for prefill hint).
    const [dayUpdates, prevUpdates] = await Promise.all([
      this.prisma.progressUpdate.findMany({
        where: {
          reportDate: date,
          OR: [
            { schemeId: { in: schemeIds } },
            { initiativeId: { in: initIds } },
            { subProjectId: { in: subIds } },
          ],
        },
      }),
      this.prisma.progressUpdate.findMany({
        where: {
          reportDate: { lt: date },
          OR: [
            { schemeId: { in: schemeIds } },
            { initiativeId: { in: initIds } },
            { subProjectId: { in: subIds } },
          ],
        },
        orderBy: { reportDate: "desc" },
      }),
    ]);

    const pick = (u: (typeof dayUpdates)[number]) =>
      u.schemeId ? `SCHEME:${u.schemeId}` : u.initiativeId ? `INITIATIVE:${u.initiativeId}` : `SUBPROJECT:${u.subProjectId}`;
    const todayMap = new Map(dayUpdates.map((u) => [pick(u), u]));
    const prevMap = new Map<string, (typeof prevUpdates)[number]>();
    for (const u of prevUpdates) {
      const k = pick(u);
      if (!prevMap.has(k)) prevMap.set(k, u); // first = latest before date
    }

    const initiativeRows = initiatives.map((i) => {
      // Weighted rollup across the initiative's schemes (all departments).
      let w = 0;
      let acc = 0;
      for (const s of i.schemes) {
        const weight = (s.totalCost ?? 0) > 0 ? (s.totalCost as number) : 1;
        w += weight;
        acc += (effectivePhysical(s) ?? 0) * weight;
      }
      const hasSchemes = i.schemes.length > 0;
      return {
        entityType: "INITIATIVE" as const,
        entityId: i.id,
        name: i.name,
        label: `Initiative ${i.number}`,
        adpCode: null as string | null,
        allocation: null as number | null,
        isPRP: false,
        hasSubs: false,
        // Auto-computed when schemes exist — the row is then read-only.
        hasSchemes,
        schemeCount: i.schemes.length,
        rolledPhysical: hasSchemes && w ? acc / w : null,
        today: todayMap.get(`INITIATIVE:${i.id}`) ?? null,
        prev: prevMap.get(`INITIATIVE:${i.id}`) ?? null,
        subRows: [] as unknown[],
      };
    });

    const schemeRows = schemes.map((s) => ({
      entityType: "SCHEME" as const,
      entityId: s.id,
      name: s.name,
      label: s.sector,
      adpCode: s.adpCode,
      allocation: s.adpAllocation,
      isPRP: s.isPRP,
      hasSubs: s.subProjects.length > 0,
      initiative: s.initiative,
      today: todayMap.get(`SCHEME:${s.id}`) ?? null,
      prev: prevMap.get(`SCHEME:${s.id}`) ?? null,
      subRows: s.subProjects.map((sp) => ({
        entityType: "SUBPROJECT" as const,
        entityId: sp.id,
        name: sp.name,
        weight: sp.weight,
        targetDate: sp.targetDate,
        today: todayMap.get(`SUBPROJECT:${sp.id}`) ?? null,
        prev: prevMap.get(`SUBPROJECT:${sp.id}`) ?? null,
      })),
    }));

    return { date: date.toISOString().slice(0, 10), rows: [...initiativeRows, ...schemeRows] };
  }

  async saveSheet(user: SessionUser, dateStr: string, entries: SheetEntryInput[]) {
    if (!Array.isArray(entries) || !entries.length) throw new BadRequestException("No entries to save");
    if (entries.length > 1000) throw new BadRequestException("Too many entries");
    const date = dateOnly(dateStr);

    const myschemes = await this.prisma.scheme.findMany({
      where: this.schemeScope(user),
      select: { id: true, adpAllocation: true },
    });
    const myScheme = new Map(myschemes.map((s) => [s.id, s]));
    const myInits = await this.prisma.initiative.findMany({
      where: this.initiativeScope(user),
      select: { id: true, _count: { select: { schemes: true } } },
    });
    const myInit = new Map(myInits.map((i) => [i.id, i._count.schemes]));
    const mySubs = await this.prisma.subProject.findMany({
      where: { scheme: this.schemeScope(user) },
      select: { id: true, schemeId: true },
    });
    const mySub = new Map(mySubs.map((sp) => [sp.id, sp.schemeId]));

    let saved = 0;
    const errors: string[] = [];
    const touchedSchemes = new Set<string>(); // for auto lifecycle-stage sync

    for (const e of entries) {
      try {
        if (e.entityType === "SCHEME" && !myScheme.has(e.entityId)) throw new Error("not your scheme");
        if (e.entityType === "INITIATIVE" && !myInit.has(e.entityId)) throw new Error("not your initiative");
        if (e.entityType === "INITIATIVE" && (myInit.get(e.entityId) ?? 0) > 0)
          throw new Error("auto-computed from its schemes — update the schemes instead");
        if (e.entityType === "SUBPROJECT" && !mySub.has(e.entityId)) throw new Error("not your work item");

        const isScheme = e.entityType === "SCHEME";
        const phys = pctOrNull(e.physicalProgressPct);
        const spent = isScheme ? numOrNull(e.expenditure) : null;
        const alloc = isScheme ? myScheme.get(e.entityId)?.adpAllocation ?? null : null;

        const clean = {
          phase: strOrNull(e.phase, 200),
          physicalProgressPct: phys,
          narrative: strOrNull(e.narrative),
          manpower: intOrNull(e.manpower),
          machinery: intOrNull(e.machinery),
          // Explicit choice wins; otherwise derive from progress: 100 → Completed,
          // any progress → Active (no need to set it by hand every day).
          siteStatus:
            e.siteStatus && SITE_STATUSES.includes(e.siteStatus)
              ? e.siteStatus
              : phys != null && phys >= 100
                ? ("COMPLETED" as SiteStatus)
                : phys != null && phys > 0
                  ? ("ACTIVE" as SiteStatus)
                  : undefined,
          bottlenecks: strOrNull(e.bottlenecks),
          remarks: strOrNull(e.remarks),
          fundsReleased: isScheme ? numOrNull(e.fundsReleased) : null,
          expenditure: spent,
          // Financial % is computed, never typed.
          financialProgressPct:
            spent != null && alloc && alloc > 0 ? Math.min(100, (spent / alloc) * 100) : null,
          submittedById: user.userId,
        };

        const hasData =
          clean.phase || clean.physicalProgressPct != null || clean.narrative || clean.manpower != null ||
          clean.machinery != null || clean.siteStatus != null || clean.bottlenecks || clean.remarks ||
          clean.fundsReleased != null || clean.expenditure != null;
        if (!hasData) continue;

        const keyWhere =
          e.entityType === "SCHEME"
            ? { schemeId_reportDate: { schemeId: e.entityId, reportDate: date } }
            : e.entityType === "INITIATIVE"
              ? { initiativeId_reportDate: { initiativeId: e.entityId, reportDate: date } }
              : { subProjectId_reportDate: { subProjectId: e.entityId, reportDate: date } };

        await this.prisma.progressUpdate.upsert({
          where: keyWhere as never,
          update: clean,
          create: {
            ...clean,
            siteStatus: clean.siteStatus ?? "NOT_STARTED",
            reportDate: date,
            schemeId: e.entityType === "SCHEME" ? e.entityId : null,
            initiativeId: e.entityType === "INITIATIVE" ? e.entityId : null,
            subProjectId: e.entityType === "SUBPROJECT" ? e.entityId : null,
          },
        });
        saved++;
        if (isScheme) touchedSchemes.add(e.entityId);
        if (e.entityType === "SUBPROJECT") touchedSchemes.add(mySub.get(e.entityId) as string);
      } catch (err) {
        errors.push(`${e.entityType}:${e.entityId} — ${(err as Error).message}`);
      }
    }

    // Auto lifecycle-stage sync: once work starts it's "started" — never ask twice.
    //   any progress > 0  →  paper stages (Not Started / Feasibility / PC-1 / Tendering) advance to Execution
    //   progress >= 100   →  Completed
    // Manual states On Hold / Completed are never downgraded automatically.
    if (touchedSchemes.size) {
      const affected = await this.prisma.scheme.findMany({
        where: { id: { in: [...touchedSchemes] } },
        include: this.latestInclude,
      });
      for (const s of affected) {
        const eff = effectivePhysical(s) ?? 0;
        let next: SchemeStage | null = null;
        if (eff >= 100 && s.stage !== "COMPLETED") next = "COMPLETED";
        else if (
          eff > 0 &&
          (s.stage === "NOT_STARTED" || s.stage === "FEASIBILITY" || s.stage === "PC1_APPROVAL" || s.stage === "TENDERING")
        )
          next = "EXECUTION";
        if (next) await this.prisma.scheme.update({ where: { id: s.id }, data: { stage: next } });
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
        ...this.latestInclude,
        department: { select: { id: true, name: true, code: true } },
        initiative: { select: { id: true, number: true, shortName: true, category: true } },
      },
    });

    const items = schemes.map((s) => ({
      cost: s.totalCost,
      alloc: s.adpAllocation,
      stage: s.stage,
      phys: effectivePhysical(s),
      u: s.updates[0] ?? null,
      updatedToday: schemeUpdatedToday(s, today),
    }));
    const roll = rollup(items, today);

    // Lifecycle stage distribution (scheme-level, incl. PC-1 etc.)
    const stageDist: Record<string, number> = {};
    for (const s of schemes) stageDist[s.stage] = (stageDist[s.stage] || 0) + 1;

    // Halted / slow sites today (CM attention list)
    const attention = schemes
      .flatMap((s) => {
        const rows: { schemeId: string; name: string; dept: string; status: SiteStatus; note: string | null }[] = [];
        const u = s.updates[0];
        if (u && (u.siteStatus === "HALTED" || u.siteStatus === "SLOW"))
          rows.push({ schemeId: s.id, name: s.name, dept: s.department.code, status: u.siteStatus, note: u.bottlenecks });
        for (const sp of s.subProjects) {
          const su = sp.updates[0];
          if (su && (su.siteStatus === "HALTED" || su.siteStatus === "SLOW"))
            rows.push({ schemeId: s.id, name: `${sp.name} (${s.name.slice(0, 40)}…)`, dept: s.department.code, status: su.siteStatus, note: su.bottlenecks });
        }
        return rows;
      })
      .slice(0, 20);

    // Sector rollup
    const bySector = new Map<string, { sector: string; count: number; cost: number; alloc: number; spent: number; physW: number; w: number; updatedToday: number }>();
    for (const s of schemes) {
      const rec = bySector.get(s.sector) ?? { sector: s.sector, count: 0, cost: 0, alloc: 0, spent: 0, physW: 0, w: 0, updatedToday: 0 };
      rec.count++;
      rec.cost += s.totalCost ?? 0;
      rec.alloc += s.adpAllocation ?? 0;
      rec.spent += s.updates[0]?.expenditure ?? 0;
      const w = (s.totalCost ?? 0) > 0 ? (s.totalCost as number) : 1;
      rec.w += w;
      rec.physW += (effectivePhysical(s) ?? 0) * w;
      if (schemeUpdatedToday(s, today)) rec.updatedToday++;
      bySector.set(s.sector, rec);
    }
    const sectors = [...bySector.values()]
      .map((r) => ({ sector: r.sector, count: r.count, cost: r.cost, alloc: r.alloc, spent: r.spent, avgPhysical: r.w ? r.physW / r.w : 0, updatedToday: r.updatedToday }))
      .sort((a, b) => b.alloc - a.alloc);

    // Initiative rollup
    const inits = await this.prisma.initiative.findMany({
      orderBy: { number: "asc" },
      include: {
        leadDepartment: { select: { id: true, name: true, code: true } },
        updates: { orderBy: { reportDate: "desc" }, take: 1 },
        schemes: {
          where: scoped ? { departmentId: user.departmentId ?? "___none___" } : {},
          include: this.latestInclude,
        },
      },
    });
    const initiatives = inits
      .map((i) => {
        const sItems = i.schemes.map((s) => ({
          cost: s.totalCost,
          alloc: s.adpAllocation,
          stage: s.stage,
          phys: effectivePhysical(s),
          u: s.updates[0] ?? null,
          updatedToday: schemeUpdatedToday(s, today),
        }));
        const r = rollup(sItems, today);
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
    let compliance: { id: string; name: string; code: string; email: string | null; schemes: number; updatedToday: number; reported: number }[] = [];
    if (!scoped) {
      const depts = await this.prisma.department.findMany({
        orderBy: { name: "asc" },
        include: { schemes: { include: this.latestInclude } },
      });
      compliance = depts.map((d) => {
        let updatedToday = 0;
        let reported = 0;
        for (const s of d.schemes) {
          const hasAny = s.updates.length > 0 || s.subProjects.some((sp) => sp.updates.length > 0);
          if (hasAny) reported++;
          if (schemeUpdatedToday(s, today)) updatedToday++;
        }
        return { id: d.id, name: d.name, code: d.code, email: d.email, schemes: d.schemes.length, updatedToday, reported };
      });
    }

    return {
      role: user.role,
      department: scoped ? { id: user.departmentId, name: user.departmentName } : null,
      totals: roll,
      stageDist,
      attention,
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
      "S.No", "ADP Code", "Scheme", "Sector/Dept", "Initiative", "Lifecycle Stage", "Total Cost (M)", "ADP Allocation (M)",
      "Funds Released (M)", "Expenditure (M)", "Financial % (auto)", "Physical % (rolled up)", "Phase", "Site Status",
      "Manpower", "Machinery", "Last Report Date", "Issues", "Additional Details",
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
          s.stage,
          s.totalCost ?? "",
          s.adpAllocation ?? "",
          u?.fundsReleased ?? "",
          u?.expenditure ?? "",
          u?.financialProgressPct != null ? u.financialProgressPct.toFixed(1) : "",
          s.effectivePhysical != null ? s.effectivePhysical.toFixed(1) : "",
          csv(u?.phase ?? ""),
          u?.siteStatus ?? "",
          u?.manpower ?? "",
          u?.machinery ?? "",
          u ? new Date(u.reportDate).toISOString().slice(0, 10) : "",
          csv(u?.bottlenecks ?? ""),
          csv(u?.remarks ?? ""),
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
function intOrNull(v: unknown): number | null {
  const n = numOrNull(v);
  return n == null ? null : Math.round(n);
}
function pctOrNull(v: unknown): number | null {
  const n = numOrNull(v);
  if (n == null) return null;
  return Math.max(0, Math.min(100, n));
}
function strOrNull(v: unknown, max = 2000): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
}
function sameDay(a: Date, b: Date): boolean {
  return new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10);
}
function schemeUpdatedToday(
  s: { updates: { reportDate: Date }[]; subProjects?: { updates: { reportDate: Date }[] }[] },
  today: Date,
): boolean {
  if (s.updates[0] && sameDay(s.updates[0].reportDate, today)) return true;
  return (s.subProjects ?? []).some((sp) => sp.updates[0] && sameDay(sp.updates[0].reportDate, today));
}
function csv(s: string): string {
  return `"${(s || "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
}

export function rollup(
  items: {
    cost: number | null;
    alloc: number | null;
    stage: SchemeStage;
    phys: number | null;
    u: { expenditure: number | null; fundsReleased: number | null; financialProgressPct: number | null; reportDate: Date } | null;
    updatedToday: boolean;
  }[],
  _today: Date,
) {
  let totalCost = 0, totalAlloc = 0, totalReleased = 0, totalSpent = 0, physW = 0, finW = 0, w = 0;
  let updatedToday = 0, reported = 0, completed = 0;
  for (const it of items) {
    totalCost += it.cost ?? 0;
    totalAlloc += it.alloc ?? 0;
    totalReleased += it.u?.fundsReleased ?? 0;
    totalSpent += it.u?.expenditure ?? 0;
    const weight = (it.cost ?? 0) > 0 ? (it.cost as number) : 1;
    w += weight;
    physW += (it.phys ?? 0) * weight;
    finW += (it.u?.financialProgressPct ?? 0) * weight;
    if (it.u || it.phys != null) reported++;
    if (it.updatedToday) updatedToday++;
    if (it.stage === "COMPLETED" || (it.phys ?? 0) >= 100) completed++;
  }
  return {
    count: items.length,
    totalCost, totalAlloc, totalReleased, totalSpent,
    avgPhysical: w ? physW / w : 0,
    avgFinancial: w ? finW / w : 0,
    updatedToday, reported, completed,
  };
}
