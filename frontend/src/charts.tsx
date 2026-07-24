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
export const NAVY = ["#f5f5f5", "#cfcfcf", "#a8a8a8", "#828282", "#5f5f5f", "#424242", "#2b2b2b"];

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(36,38,43,0.94)",
  color: "#f5f5f5",
  backdropFilter: "blur(10px)",
  fontSize: 12,
  boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
};

export function SectorBars({
  data,
}: {
  data: { sector: string; alloc: number; spent: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
        <XAxis
          dataKey="sector"
          angle={-40}
          textAnchor="end"
          interval={0}
          tick={{ fontSize: 10, fill: "rgba(255,255,255,0.45)" }}
          height={60}
        />
        <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.45)" }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}B` : `${v}M`)} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v: number, name: string) => [
            v >= 1000 ? `Rs ${(v / 1000).toFixed(2)} Bn` : `Rs ${v.toFixed(0)} M`,
            name === "alloc" ? "ADP Allocation" : "Expenditure",
          ]}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}
          formatter={(v) => (v === "alloc" ? "ADP Allocation" : "Expenditure")}
        />
        <Bar dataKey="alloc" fill="rgba(255,255,255,0.85)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="spent" fill="rgba(255,255,255,0.35)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StageDonut({ dist }: { dist: Record<string, number> }) {
  const data = Object.entries(dist)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: stageLabel(k as Stage), value: v }));
  if (!data.length) return <div className="p-8 text-center text-sm text-white/40">No stage data yet</div>;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={NAVY[i % NAVY.length]} stroke="rgba(0,0,0,0.4)" />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }} />
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
    return <div className="p-8 text-center text-sm text-white/40">No daily submissions yet — trend appears once departments start reporting</div>;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.45)" }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.45)" }} tickFormatter={(v) => `${v}%`} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [`${Math.round(v)}%`, n === "physical" ? "Physical" : "Financial"]} />
        <Legend wrapperStyle={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }} formatter={(v) => (v === "physical" ? "Physical %" : "Financial %")} />
        <Line type="monotone" dataKey="physical" stroke="rgba(255,255,255,0.9)" strokeWidth={2.5} dot={{ r: 2 }} connectNulls />
        <Line type="monotone" dataKey="financial" stroke="rgba(255,255,255,0.4)" strokeWidth={2} dot={{ r: 2 }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ComplianceBar({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-white/85 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="w-24 text-right text-xs font-semibold text-navy-800">
        {done}/{total} · {pct}%
      </div>
    </div>
  );
}
