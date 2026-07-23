import { Body, Controller, Get, Header, Param, Post, Query } from "@nestjs/common";
import { CoreService, SheetEntryInput } from "./core.service";
import { CurrentUser, Roles, SessionUser } from "../auth/decorators";

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
