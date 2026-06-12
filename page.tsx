"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Activity, CheckCircle2, TrendingUp, AlertTriangle, XCircle, RefreshCw, Upload, ShieldCheck } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, RadialBarChart, RadialBar } from "recharts";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { KPIInfoTrigger } from "@/components/dashboard/KPIInfoModal";
import { getHealthColor, getHealthLabel } from "@/lib/utils";
import type { DashboardMetrics } from "@/lib/types";

const STATUS_CONFIG = {
  Excellent: { icon: CheckCircle2, color: "#10b981", bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400" },
  Good:      { icon: TrendingUp,   color: "#3b82f6", bg: "bg-blue-500/10",    border: "border-blue-500/20",    text: "text-blue-400"    },
  Fair:      { icon: AlertTriangle,color: "#f59e0b", bg: "bg-amber-500/10",   border: "border-amber-500/20",   text: "text-amber-400"   },
  Poor:      { icon: XCircle,      color: "#ef4444", bg: "bg-red-500/10",     border: "border-red-500/20",     text: "text-red-400"     },
};

const FACTOR_CONFIG = [
  { key: "dead_stock_score",  pctKey: "dead_stock_pct",     label: "Dead Stock",    weight: 30, goodThreshold: 10,  desc: "% of SKUs with zero movement — lower is better." },
  { key: "slow_mover_score",  pctKey: "slow_mover_pct",     label: "Slow Movers",   weight: 25, goodThreshold: 20,  desc: "% of SKUs moving below optimal velocity." },
  { key: "stockout_score",    pctKey: "stockout_risk_pct",  label: "Stockout Risk", weight: 30, goodThreshold: 10,  desc: "% of SKUs at risk of running out of stock." },
  { key: "abc_score",         pctKey: "a_item_revenue_pct", label: "ABC Quality",   weight: 15, goodThreshold: 999, desc: "Revenue concentration in A-class items — higher is better." },
];

function ScoreGauge({ score, color }: { score: number; color: string }) {
  const data = [{ value: score, fill: color }, { value: 100 - score, fill: "rgba(255,255,255,0.04)" }];
  return (
    <div className="relative w-48 h-48 mx-auto">
      <RadialBarChart
        width={192} height={192}
        cx={96} cy={96}
        innerRadius={64} outerRadius={88}
        startAngle={220} endAngle={-40}
        data={data}
        barSize={14}
      >
        <RadialBar dataKey="value" cornerRadius={8} background={false} />
      </RadialBarChart>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold tabular-nums" style={{ color }}>{score}</span>
        <span className="text-xs text-slate-500 mt-0.5">/100</span>
      </div>
    </div>
  );
}

export default function HealthScorePage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [noData, setNoData] = useState(false);

  useEffect(() => {
    try {
      const s = sessionStorage.getItem("supplysense_metrics");
      if (s) setMetrics(JSON.parse(s));
      else setNoData(true);
    } catch { setNoData(true); }
  }, []);

  if (noData) return (
    <div className="flex h-screen items-center justify-center bg-[#020617] ss-page">
      <div className="card p-8 max-w-sm w-full text-center space-y-4">
        <Upload className="w-8 h-8 text-[#818cf8] mx-auto" />
        <p className="text-sm text-white font-semibold">No data loaded</p>
        <Link href="/upload" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#6366f1] text-white text-sm w-full">Upload inventory</Link>
      </div>
    </div>
  );

  if (!metrics) return (
    <div className="flex h-screen items-center justify-center bg-[#020617] ss-page">
      <RefreshCw className="w-5 h-5 text-[#818cf8] animate-spin" />
    </div>
  );

  const color  = getHealthColor(metrics.health_score);
  const label  = getHealthLabel(metrics.health_score);
  const cfg    = STATUS_CONFIG[label];
  const Icon   = cfg.icon;
  const hc     = metrics.health_components;

  const factors = FACTOR_CONFIG.map((f) => ({
    ...f,
    score: hc[f.key as keyof typeof hc] as number,
    pct:   hc[f.pctKey as keyof typeof hc] as number,
  }));

  return (
    <div className="flex h-screen bg-[#020617] ss-page overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header className="nav-glass sticky top-0 z-30 flex-shrink-0">
          <div className="flex items-center h-[46px] px-4 gap-3">
            <Link href="/dashboard" className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
            </Link>
            <span className="text-slate-700">/</span>
            <span className="text-xs text-white font-medium flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[#818cf8]" /> Health Score
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[960px] mx-auto px-4 py-6 space-y-6">

            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-lg font-bold text-white flex items-center gap-2" style={{ fontFamily: "Syne, sans-serif" }}>
                  Inventory Health Score
                  <KPIInfoTrigger kpiKey="health_score" metrics={metrics} />
                </h1>
                <p className="text-xs text-slate-500 mt-1">Composite score across 4 weighted factors. Higher = healthier inventory.</p>
              </div>
            </div>

            {/* Transparency statement */}
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <p className="text-[11px] text-slate-500">
                <span className="text-emerald-400 font-medium">Auditable calculation.</span>
                {" "}Click the <span className="text-[#818cf8] font-semibold">ⓘ</span> icon next to any metric to see its formula, data fields, and a worked example.
                All calculations are based solely on your uploaded data.
              </p>
            </div>

            {/* Score + status */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="card p-6 flex flex-col items-center text-center gap-4">
                <ScoreGauge score={metrics.health_score} color={color} />
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
                  <Icon className="w-3.5 h-3.5" /> {label}
                </span>
                <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
                  {label === "Excellent" && "Inventory is well-optimised with minimal waste and strong availability."}
                  {label === "Good"      && "Generally healthy with a few areas that could be tightened."}
                  {label === "Fair"      && "Noticeable inefficiencies — dead stock or stockout risk needs attention."}
                  {label === "Poor"      && "Critical inventory issues. Immediate action required."}
                </p>
              </div>

              {/* Zone legend */}
              <div className="card p-6 space-y-4">
                <p className="text-xs font-semibold text-white">Score Zones</p>
                {(["Excellent","Good","Fair","Poor"] as const).map((s) => {
                  const c = STATUS_CONFIG[s];
                  const active = s === label;
                  const SIcon = c.icon;
                  const range = s === "Excellent" ? "80–100" : s === "Good" ? "60–79" : s === "Fair" ? "40–59" : "0–39";
                  const barWidth = s === "Excellent" ? "w-full" : s === "Good" ? "w-3/4" : s === "Fair" ? "w-1/2" : "w-1/4";
                  return (
                    <div key={s} className={`flex items-center gap-3 p-3 rounded-xl transition-opacity ${active ? "opacity-100 ring-1 ring-white/10" : "opacity-40"}`}
                      style={{ background: active ? "rgba(255,255,255,0.03)" : "transparent" }}>
                      <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center flex-shrink-0`}>
                        <SIcon className={`w-4 h-4 ${c.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-semibold ${active ? c.text : "text-slate-500"}`}>{s}</span>
                          <span className="text-[11px] text-slate-600">{range}</span>
                        </div>
                        <div className="h-1 bg-white/6 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${barWidth}`} style={{ background: c.color }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Factor breakdown */}
            <div className="card p-6 space-y-5">
              <p className="text-sm font-semibold text-white">Score Factors</p>
              {factors.map((f) => {
                const fc = f.score >= 80 ? "#10b981" : f.score >= 60 ? "#3b82f6" : f.score >= 40 ? "#f59e0b" : "#ef4444";
                return (
                  <div key={f.label} className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white">{f.label}</span>
                            <span className="text-[10px] text-slate-600 bg-white/5 px-1.5 py-0.5 rounded">Weight {f.weight}%</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-500">{f.pct}% of SKUs</span>
                            <span className="text-sm font-bold tabular-nums w-8 text-right" style={{ color: fc }}>{f.score}</span>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-600 mb-2">{f.desc}</p>
                        <div className="h-2.5 bg-white/6 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${f.score}%`, background: fc }} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Trend chart */}
            {metrics.health_trend.length > 0 && (
              <div className="card p-6">
                <p className="text-sm font-semibold text-white mb-4">Score Trend</p>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={metrics.health_trend} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                      <defs>
                        <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                          <stop offset="100%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="m" tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
                        labelStyle={{ color: "#f1f5f9" }}
                        itemStyle={{ color }}
                        formatter={(v) => [v, "Score"]}
                      />
                      <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2}
                        fill="url(#trendGrad)" dot={{ fill: color, r: 3 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
