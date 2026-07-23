import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query } from "@nestjs/common";
import { SchemeStage } from "@prisma/client";
import { CoreService, SheetEntryInput } from "./core.service";
import { CurrentUser, SessionUser } from "../auth/decorators";

@Controller()
export class CoreController {
  constructor(private core: CoreService) {}

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
    @Body() body: { date: string; entries: SheetEntryInput[] },
  ) {
    return this.core.saveSheet(user, body?.date, body?.entries ?? []);
  }

  // ── Export ─────────────────────────────────────────────────
  @Get("export/schemes.csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="cm-priority-schemes.csv"')
  exportCsv(@CurrentUser() user: SessionUser) {
    return this.core.schemesCsv(user);
  }
}
