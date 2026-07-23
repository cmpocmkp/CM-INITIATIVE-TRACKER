import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { stageLabel, Stage } from "./api";

// Monochrome palette for all charts.
export const NAVY = ["#171717", "#404040", "#616161", "#8a8a8a", "#b5b5b5", "#d9d9d9", "#efefef"];

const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid #dbe6f3",
  fontSize: 12,
  boxShadow: "0 4px 12px rgb(11 31 58 / 0.08)",
};

export function SectorBars({
  data,
}: {
  data: { sector: string; alloc: number; spent: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="sector"
          angle={-40}
          textAnchor="end"
          interval={0}
          tick={{ fontSize: 10, fill: "#475569" }}
          height={60}
        />
        <YAxis tick={{ fontSize: 10, fill: "#475569" }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}B` : `${v}M`)} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v: number, name: string) => [
            v >= 1000 ? `Rs ${(v / 1000).toFixed(2)} Bn` : `Rs ${v.toFixed(0)} M`,
            name === "alloc" ? "ADP Allocation" : "Expenditure",
          ]}
        />
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          formatter={(v) => (v === "alloc" ? "ADP Allocation" : "Expenditure")}
        />
        <Bar dataKey="alloc" fill="#404040" radius={[3, 3, 0, 0]} />
        <Bar dataKey="spent" fill="#c9c9c9" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StageDonut({ dist }: { dist: Record<string, number> }) {
  const data = Object.entries(dist)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: stageLabel(k as Stage), value: v }));
  if (!data.length) return <div className="p-8 text-center text-sm text-slate-400">No stage data yet</div>;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={NAVY[i % NAVY.length]} stroke="#fff" />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function TrendLine({
  data,
}: {
  data: { date: string; physical: number | null; financial: number | null }[];
}) {
  if (!data.length)
    return <div className="p-8 text-center text-sm text-slate-400">No daily submissions yet — trend appears once departments start reporting</div>;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#475569" }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#475569" }} tickFormatter={(v) => `${v}%`} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [`${Math.round(v)}%`, n === "physical" ? "Physical" : "Financial"]} />
        <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => (v === "physical" ? "Physical %" : "Financial %")} />
        <Line type="monotone" dataKey="physical" stroke="#171717" strokeWidth={2.5} dot={{ r: 2 }} connectNulls />
        <Line type="monotone" dataKey="financial" stroke="#a3a3a3" strokeWidth={2} dot={{ r: 2 }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ComplianceBar({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-navy-50">
        <div className="h-full rounded-full bg-navy-700 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="w-24 text-right text-xs font-semibold text-navy-800">
        {done}/{total} · {pct}%
      </div>
    </div>
  );
}
