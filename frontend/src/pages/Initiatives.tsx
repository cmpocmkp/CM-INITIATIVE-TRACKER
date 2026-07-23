import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, Initiative, deptShort, fmtM, fmtPct } from "../api";
import { useAuth, isStaff } from "../auth";
import { Heading, Spinner, ErrorBox, Bar, Empty, NumBox } from "../ui";

function schemePhys(s: Initiative["schemes"][number]): number {
  const subs = s.subProjects ?? [];
  if (subs.length) {
    let w = 0, acc = 0;
    for (const sp of subs) {
      const weight = sp.weight && sp.weight > 0 ? sp.weight : 1;
      w += weight;
      acc += (sp.updates?.[0]?.physicalProgressPct ?? 0) * weight;
    }
    return w ? acc / w : 0;
  }
  return s.updates?.[0]?.physicalProgressPct ?? 0;
}

function roll(i: Initiative) {
  let cost = 0, alloc = 0, spent = 0, physW = 0, w = 0, updated = 0;
  for (const s of i.schemes) {
    cost += s.totalCost ?? 0;
    alloc += s.adpAllocation ?? 0;
    const u = s.updates?.[0];
    spent += u?.expenditure ?? 0;
    const weight = (s.totalCost ?? 0) > 0 ? (s.totalCost as number) : 1;
    w += weight;
    physW += schemePhys(s) * weight;
    if (u || (s.subProjects ?? []).some((sp) => sp.updates?.length)) updated++;
  }
  const own = i.updates?.[0];
  const phys = i.schemes.length ? (w ? physW / w : 0) : own?.physicalProgressPct ?? 0;
  return { cost, alloc, spent, phys, updated };
}

export default function Initiatives() {
  const { user } = useAuth();
  const staff = isStaff(user);
  const [list, setList] = useState<Initiative[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get<Initiative[]>("/initiatives").then(setList).catch((e) => setErr((e as Error).message));
  }, []);

  if (err) return <ErrorBox message={err} />;
  if (!list) return <Spinner label="Loading initiatives…" />;

  if (!staff && !list.length) {
    return (
      <div className="space-y-5">
        <Heading title="My Initiatives" />
        <Empty title="No initiatives for your department" hint="Initiatives appear here when your department leads one or has schemes under one." />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Heading title={staff ? "21 Initiatives" : "My Initiatives"} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {list.map((i) => {
          const r = roll(i);
          return (
            <Link key={i.id} to={`/initiatives/${i.id}`} className="card group p-4 transition hover:border-navy-300 hover:shadow-md">
              <h3 className="flex items-center gap-2 text-[14px] leading-snug text-neutral-900" title={i.name}>
                <NumBox n={i.number} size={26} />
                <span className="min-w-0 truncate">{i.shortName}</span>
              </h3>
              <div className="mt-1 truncate text-[11px] text-slate-500" title={i.leadDepartment?.name ?? ""}>
                Lead: <span className="font-semibold text-slate-700">{deptShort(i.leadDepartment)}</span>
              </div>

              <div className="mt-2.5 flex items-center gap-2">
                <Bar value={r.phys} className="flex-1" />
                <div className="text-[13px] font-bold text-navy-800">{fmtPct(r.phys)}</div>
              </div>

              <div className="mt-2.5 grid grid-cols-3 gap-1 border-t border-slate-100 pt-2 text-center">
                <div>
                  <div className="text-[9px] uppercase tracking-wide text-slate-400">Schemes</div>
                  <div className="text-[12px] font-bold text-navy-900">{i.schemes.length}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wide text-slate-400">Allocation</div>
                  <div className="text-[12px] font-bold text-navy-900">{fmtM(r.alloc)}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wide text-slate-400">Spent</div>
                  <div className="text-[12px] font-bold text-navy-900">{fmtM(r.spent)}</div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
