import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query } from "@nestjs/common";
import { SchemeStage } from "@prisma/client";
import { CoreService, SheetEntryInput } from "./core.service";
import { PcfmsService } from "./pcfms.service";
import { CurrentUser, Roles, SessionUser } from "../auth/decorators";

@Controller()
export class CoreController {
  constructor(
    private core: CoreService,
    private pcfms: PcfmsService,
  ) {}

  @Get("dashboard")
  dashboard(@CurrentUser() user: SessionUser) {
    return this.core.dashboard(user);
  }

  @Get("departments")
  departments(@CurrentUser() user: SessionUser) {
    return this.core.departments(user);
  }

  @Get("departments/:id")
  department(@CurrentUser() user: SessionUser, @Param("id") id: string) {
    return this.core.departmentDetail(user, id);
  }

  @Get("initiatives")
  initiatives(@CurrentUser() user: SessionUser) {
    return this.core.initiatives(user);
  }

  @Get("initiatives/:id")
  initiative(@CurrentUser() user: SessionUser, @Param("id") id: string) {
    return this.core.initiativeDetail(user, id);
  }

  @Get("schemes")
  schemes(
    @CurrentUser() user: SessionUser,
    @Query("departmentId") departmentId?: string,
    @Query("initiativeId") initiativeId?: string,
    @Query("q") search?: string,
  ) {
    return this.core.schemes(user, { departmentId, initiativeId, search });
  }

  @Get("schemes/:id")
  scheme(@CurrentUser() user: SessionUser, @Param("id") id: string) {
    return this.core.schemeDetail(user, id);
  }

  // ── Sectors (independent dimension from departments) ──────
  @Get("sectors")
  sectors(@CurrentUser() user: SessionUser) {
    return this.core.sectorsList(user);
  }

  @Get("sectors/:name")
  sector(@CurrentUser() user: SessionUser, @Param("name") name: string) {
    return this.core.sectorDetail(user, decodeURIComponent(name));
  }

  @Patch("schemes/:id/stage")
  setStage(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() body: { stage: SchemeStage },
  ) {
    return this.core.setSchemeStage(user, id, body?.stage);
  }

  // ── Sub-projects (work items inside a scheme) ──────────────
  @Post("subprojects")
  createSub(
    @CurrentUser() user: SessionUser,
    @Body() body: { schemeId?: string; name?: string; description?: string; weight?: number; targetDate?: string },
  ) {
    return this.core.createSubProject(user, body ?? {});
  }

  @Patch("subprojects/:id")
  updateSub(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() body: { name?: string; description?: string; weight?: number | null; targetDate?: string | null },
  ) {
    return this.core.updateSubProject(user, id, body ?? {});
  }

  @Delete("subprojects/:id")
  deleteSub(@CurrentUser() user: SessionUser, @Param("id") id: string) {
    return this.core.deleteSubProject(user, id);
  }

  // ── Daily data-entry sheet ─────────────────────────────────
  @Get("progress/sheet")
  sheet(@CurrentUser() user: SessionUser, @Query("date") date?: string) {
    return this.core.sheet(user, date);
  }

  @Post("progress/sheet")
  saveSheet(
    @CurrentUser() user: SessionUser,
    @Body() body: { date?: string; entries: SheetEntryInput[] },
  ) {
    return this.core.saveSheet(user, body?.date, body?.entries ?? []);
  }

  // ── Departmental performance analysis (staff) ──────────────
  @Get("reports/analysis")
  @Roles("SUPERADMIN", "ADMIN")
  analysis(@CurrentUser() user: SessionUser) {
    return this.core.complianceAnalysis(user);
  }

  // ── PCFMS (P&D) government-data sync ───────────────────────
  @Post("pcfms/sync")
  @Roles("SUPERADMIN", "ADMIN")
  pcfmsSync() {
    // fire-and-forget — ~100 API calls take a minute; poll status below
    void this.pcfms.sync();
    return { ok: true, started: true };
  }

  @Get("pcfms/status")
  @Roles("SUPERADMIN", "ADMIN")
  pcfmsStatus() {
    return { last: this.pcfms.lastResult };
  }

  // ── Daily-lock correction workflow ─────────────────────────
  @Post("corrections")
  requestCorrection(
    @CurrentUser() user: SessionUser,
    @Body() body: { entityType?: "SCHEME" | "INITIATIVE" | "SUBPROJECT"; entityId?: string; reason?: string; date?: string },
  ) {
    return this.core.requestCorrection(user, body ?? {});
  }

  @Get("corrections")
  listCorrections(@CurrentUser() user: SessionUser) {
    return this.core.listCorrections(user);
  }

  @Post("corrections/:id/resolve")
  @Roles("SUPERADMIN", "ADMIN")
  resolveCorrection(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() body: { approve?: boolean },
  ) {
    return this.core.resolveCorrection(user, id, !!body?.approve);
  }

  // ── Export ─────────────────────────────────────────────────
  @Get("export/schemes.csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="cm-priority-schemes.csv"')
  exportCsv(@CurrentUser() user: SessionUser) {
    return this.core.schemesCsv(user);
  }
}
