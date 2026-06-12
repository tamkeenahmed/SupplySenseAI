"use client";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { DashboardMetrics } from "@/lib/types";
import { openDrilldown } from "@/lib/drilldown";

const ABC_COLORS = {
  A: { fill: "#818cf8", bg: "bg-[#EEEDFE]", text: "text-[#3C3489]", label: "text-indigo-300" },
  B: { fill: "#60a5fa", bg: "bg-blue-950/40", text: "text-blue-300", label: "text-blue-300" },
  C: { fill: "#34d399", bg: "bg-emerald-950/40", text: "text-emerald-300", label: "text-emerald-300" },
};

interface ABCChartProps {
  metrics: DashboardMetrics;
}

export function ABCChart({ metrics }: ABCChartProps) {
  const { abc_summary, total_skus } = metrics;

  const pieData = [
    { name: "Class A", value: abc_summary.a_count, fill: ABC_COLORS.A.fill },
    { name: "Class B", value: abc_summary.b_count, fill: ABC_COLORS.B.fill },
    { name: "Class C", value: abc_summary.c_count, fill: ABC_COLORS.C.fill },
  ];

  const aAtRisk = metrics.top_risk_items.filter((r) => r.abc_class === "A").length;

  return (
    <div className="card p-5">
      <div className="mb-4">
        <p className="text-[11px] text-slate-500 font-medium mb-0.5">ABC classification</p>
        <p className="text-[10px] text-slate-600">Pareto revenue analysis · {total_skus} SKUs · <span className="text-[#818cf8]">click to drill through</span></p>
      </div>

      <div className="flex items-center gap-6">
        {/* Donut chart */}
        <div className="w-24 h-24 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={28}
                outerRadius={44}
                paddingAngle={3}
                dataKey="value"
                startAngle={90}
                endAngle={-270}
                style={{ cursor: "pointer" }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onClick={(d: any) => d?.name && openDrilldown({ chart: "abc_distribution", segment: (d.name as string).slice(-1) as "A" | "B" | "C" }, metrics)}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  fontSize: 11,
                }}
                labelStyle={{ color: "#f1f5f9" }}
                itemStyle={{ color: "#94a3b8" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend + segment boxes */}
        <div className="flex-1 space-y-2">
          {[
            { cls: "A" as const, count: abc_summary.a_count, pct: abc_summary.a_revenue_pct },
            { cls: "B" as const, count: abc_summary.b_count, pct: abc_summary.b_revenue_pct },
            { cls: "C" as const, count: abc_summary.c_count, pct: abc_summary.c_revenue_pct },
          ].map(({ cls, count, pct }) => (
            <div
              key={cls}
              className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => openDrilldown({ chart: "abc_distribution", segment: cls }, metrics)}
            >
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: ABC_COLORS[cls].fill }}
              />
              <span className={`text-xs font-semibold ${ABC_COLORS[cls].label}`}>
                Class {cls}
              </span>
              <span className="text-xs text-white font-medium">{count}</span>
              <span className="text-[11px] text-slate-600">· {pct}% revenue</span>
            </div>
          ))}
        </div>
      </div>

      {/* Insight text */}
      <div className="mt-4 pt-4 border-t border-white/5">
        <p className="text-[11px] text-slate-500 leading-relaxed">
          <span className="text-white font-medium">{abc_summary.a_count} A-items</span> drive{" "}
          <span className="text-indigo-300 font-medium">{abc_summary.a_revenue_pct}%</span> of revenue
          ({((abc_summary.a_count / total_skus) * 100).toFixed(0)}% of SKUs).
          {aAtRisk > 0 && (
            <span className="text-red-400 font-medium"> {aAtRisk} A-item{aAtRisk > 1 ? "s" : ""} at elevated stockout risk.</span>
          )}
        </p>
      </div>
    </div>
  );
}
