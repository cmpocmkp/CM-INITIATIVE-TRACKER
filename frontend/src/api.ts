// Minimal typed fetch wrapper — same-origin /api (Vite proxies in dev).

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (res.status === 401 && !path.startsWith("/auth")) {
    window.location.href = "/login";
    throw new ApiError(401, "Not signed in");
  }
  const text = await res.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* html or plain text (e.g. digest preview) */
  }
  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && "message" in data
        ? String((data as { message: unknown }).message)
        : null) || `Request failed (${res.status})`;
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body != null ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body != null ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

// ── Shared types (mirror backend responses) ───────────────────
export type Role = "SUPERADMIN" | "ADMIN" | "DEPARTMENT";
// Scheme lifecycle (set rarely, on the scheme itself)
export type Stage =
  | "NOT_STARTED"
  | "FEASIBILITY"
  | "PC1_APPROVAL"
  | "TENDERING"
  | "EXECUTION"
  | "COMPLETED"
  | "ON_HOLD";
// Daily on-ground site status
export type SiteStatus = "NOT_STARTED" | "ACTIVE" | "SLOW" | "HALTED" | "COMPLETED";

export interface SessionUser {
  userId: string;
  username: string;
  name: string;
  role: Role;
  departmentId: string | null;
  departmentName: string | null;
}

export interface Update {
  id: string;
  reportDate: string;
  phase: string | null;
  physicalProgressPct: number | null;
  narrative: string | null;
  manpower: number | null;
  machinery: number | null;
  siteStatus: SiteStatus;
  bottlenecks: string | null;
  remarks: string | null;
  fundsReleased: number | null;
  expenditure: number | null;
  financialProgressPct: number | null;
  createdAt: string;
  submittedBy?: { name: string; username: string } | null;
}

export interface DeptRef {
  id: string;
  name: string;
  code: string;
}

export interface SubProject {
  id: string;
  schemeId: string;
  name: string;
  description: string | null;
  weight: number | null;
  targetDate: string | null;
  updates: Update[];
}

export interface Scheme {
  id: string;
  adpCode: string | null;
  name: string;
  rawName: string;
  sector: string;
  totalCost: number | null;
  adpAllocation: number | null;
  isPRP: boolean;
  isOfficial?: boolean;
  isPlaceholder: boolean;
  stage: Stage;
  department: DeptRef;
  initiative: { id: string; number: number; shortName: string; name?: string } | null;
  updates: Update[];
  subProjects?: SubProject[];
  effectivePhysical?: number | null;
}

export interface Initiative {
  id: string;
  number: number;
  name: string;
  shortName: string;
  category: string;
  leadDepartment: DeptRef | null;
  updates: Update[];
  schemes: (Scheme & { department?: DeptRef })[];
  trend?: { reportDate: string; physicalProgressPct: number | null; financialProgressPct: number | null; expenditure: number | null }[];
}

export interface Totals {
  officialCount?: number;
  count: number;
  totalCost: number;
  totalAlloc: number;
  totalReleased: number;
  totalSpent: number;
  avgPhysical: number;
  avgFinancial: number;
  updatedToday: number;
  reported: number;
  completed: number;
}

export interface Dashboard {
  role: Role;
  department: { id: string | null; name: string | null } | null;
  totals: Totals;
  stageDist: Record<string, number>;
  attention: { schemeId: string; name: string; dept: string; status: SiteStatus; note: string | null }[];
  sectors: { sector: string; count: number; cost: number; alloc: number; spent: number; avgPhysical: number; updatedToday: number }[];
  initiatives: {
    id: string;
    number: number;
    name: string;
    shortName: string;
    category: string;
    leadDepartment: DeptRef | null;
    schemes: number;
    cost: number;
    alloc: number;
    spent: number;
    avgPhysical: number;
    updatedToday: number;
  }[];
  compliance: { id: string; name: string; code: string; email: string | null; schemes: number; updatedToday: number; reported: number }[];
  today: string;
}

export type CorrectionStatus = "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED";

export interface SheetSubRow {
  entityType: "SUBPROJECT";
  entityId: string;
  name: string;
  weight: number | null;
  targetDate: string | null;
  today: Update | null;
  prev: Update | null;
  locked?: boolean;
  correction?: CorrectionStatus | null;
}

export interface CorrectionRequest {
  id: string;
  entityType: "SCHEME" | "INITIATIVE" | "SUBPROJECT";
  entityId: string;
  entityName: string;
  reportDate: string;
  reason: string;
  status: CorrectionStatus;
  createdAt: string;
  resolvedAt: string | null;
  department: { code: string; name: string };
  requestedBy: { username: string } | null;
  resolvedBy: { username: string } | null;
}

export interface SheetRow {
  entityType: "SCHEME" | "INITIATIVE";
  entityId: string;
  name: string;
  label: string;
  adpCode: string | null;
  allocation: number | null;
  isPRP: boolean;
  isOfficial?: boolean;
  hasSubs: boolean;
  /** Initiative rows only: has schemes attached → row is auto-computed, not typed. */
  hasSchemes?: boolean;
  schemeCount?: number;
  rolledPhysical?: number | null;
  initiative?: { id: string; number: number; shortName: string } | null;
  today: Update | null;
  prev: Update | null;
  locked?: boolean;
  correction?: CorrectionStatus | null;
  subRows: SheetSubRow[];
}

/** Standard physical phases — dropdown options for daily entry. */
export const PHASES = [
  "Survey / Design",
  "Land Acquisition",
  "Utilities Shifting",
  "Mobilization",
  "Earthwork / Excavation",
  "Piling / Foundation",
  "Structure / RCC",
  "Deck / Superstructure",
  "Backfilling",
  "Road Works / Carpeting",
  "Electrical / Mechanical",
  "Finishing",
  "Landscaping / Beautification",
  "Testing & Commissioning",
  "Defect Liability",
  "Policy / Drafting",
  "Approvals",
  "Procurement",
  "Implementation / Rollout",
] as const;

// ── Formatters ────────────────────────────────────────────────
export const fmtM = (n?: number | null): string => {
  if (n == null) return "—";
  if (Math.abs(n) >= 1000) return `Rs ${(n / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} Bn`;
  return `Rs ${n.toLocaleString(undefined, { maximumFractionDigits: n < 10 ? 2 : 0 })} M`;
};
export const fmtPct = (n?: number | null): string => (n == null ? "—" : `${Math.round(n)}%`);
export const fmtDate = (d?: string | null): string =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
export const todayStr = (): string => new Date().toISOString().slice(0, 10);

export const STAGES: { value: Stage; label: string }[] = [
  { value: "NOT_STARTED", label: "Not Started" },
  { value: "FEASIBILITY", label: "Feasibility" },
  { value: "PC1_APPROVAL", label: "PC-1 / Approval" },
  { value: "TENDERING", label: "Tendering" },
  { value: "EXECUTION", label: "Execution" },
  { value: "COMPLETED", label: "Completed" },
  { value: "ON_HOLD", label: "On Hold" },
];
export const stageLabel = (s?: Stage | null): string =>
  STAGES.find((x) => x.value === s)?.label ?? "Not Started";

export const SITE_STATUSES: { value: SiteStatus; label: string }[] = [
  { value: "NOT_STARTED", label: "Not Started" },
  { value: "ACTIVE", label: "Active" },
  { value: "SLOW", label: "Slow" },
  { value: "HALTED", label: "Halted" },
  { value: "COMPLETED", label: "Completed" },
];
export const siteLabel = (s?: SiteStatus | null): string =>
  SITE_STATUSES.find((x) => x.value === s)?.label ?? "Not Started";

/** Short, familiar department names for display (Lead: C&W, PHE, …). */
const DEPT_SHORT: Record<string, string> = {
  CW: "C&W",
  LG: "Local Government",
  HEALTH: "Health",
  URBAN: "Urban Dev",
  TRANSPORT: "Transport",
  HOUSING: "Housing",
  IND: "Industries",
  TOURISM: "Tourism",
  MINES: "Mines",
  SNGPL: "SNGPL",
  FIN: "Finance",
  FOREST: "Forestry",
  HOME: "Home",
  ESE: "E&SE",
  EP: "E&P",
  STIT: "ST&IT",
  SW: "Social Welfare",
  MSD: "MSD",
  IRRIGATION: "Irrigation",
  DWSS: "PHE",
  FOOD: "Food",
  AUQAF: "Auqaf",
  LIVESTOCK: "Livestock",
  INFO: "Information",
  SPORTS: "Sports",
  HED: "Higher Education",
  AGRI: "Agriculture",
  POP: "Population",
  LABOUR: "Labour",
  LAW: "Law",
  REVENUE: "Revenue",
  PDMA: "PDMA",
  EXCISE: "Excise",
  EST: "Establishment",
  CMPO: "CMPO",
};
export const deptShort = (d?: { code: string; name?: string } | null): string =>
  d ? (DEPT_SHORT[d.code] ?? d.code) : "—";

/** Signed daily change, e.g. +2.0% */
export const fmtDelta = (curr?: number | null, prev?: number | null): string | null => {
  if (curr == null || prev == null) return null;
  const d = curr - prev;
  const s = `${d >= 0 ? "+" : ""}${d.toFixed(1)}%`;
  return s;
};
