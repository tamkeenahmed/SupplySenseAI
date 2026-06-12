"use client";
import { useEffect, useRef, useState } from "react";
import { AreaChart, Area, XAxis, ResponsiveContainer, Tooltip } from "recharts";
import {
  CheckCircle2, TrendingUp, AlertTriangle, XCircle,
  Package, RotateCcw, ShieldAlert, BarChart3, HelpCircle,
} from "lucide-react";
import { getHealthColor, getHealthLabel } from "@/lib/utils";
import type { DashboardMetrics } from "@/lib/types";
import { openDrilldown } from "@/lib/drilldown";
import { WhyDrawer } from "@/components/validation/WhyDrawer";

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  Excellent: {
    icon: CheckCircle2,
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    text: "text-emerald-400",
    glow: "shadow-[0_0_24px_rgba(16,185,129,0.15)]",
    desc: "Inventory is well-optimised with minimal waste and strong availability.",
  },
  Good: {
    icon: TrendingUp,
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    text: "text-blue-400",
    glow: "shadow-[0_0_24px_rgba(59,130,246,0.15)]",
    desc: "Generally healthy with a few areas that could be tightened.",
  },
  Fair: {
    icon: AlertTriangle,
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    text: "text-amber-400",
    glow: "shadow-[0_0_24px_rgba(245,158,11,0.12)]",
    desc: "Noticeable inefficiencies — dead stock or stockout risk needs attention.",
  },
  Poor: {
    icon: XCircle,
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    text: "text-red-400",
    glow: "shadow-[0_0_24px_rgba(239,68,68,0.15)]",
    desc: "Critical inventory issues. Immediate action required.",
  },
} as const;

// ── Factor row config ──────────────────────────────────────────────────────────
interface Factor {
  label: string;
  icon: React.ElementType;
  score: number;
  pct: number;
  pctLabel: string;
  weight: string;
  goodThreshold: number; // pct below this = good
}

// Segment stops on the score gauge (0-100 arc)
const GAUGE_SEGMENTS = [
  { from: 0,  to: 40,  color: "#ef4444" }, // Poor
  { from: 40, to: 60,  color: "#f59e0b" }, // Fair
  { from: 60, to: 80,  color: "#3b82f6" }, // Good
  { from: 80, to: 100, color: "#10b981" }, // Excellent
];

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startAngle));
  const y1 = cy + r * Math.sin(toRad(startAngle));
  const x2 = cx + r * Math.cos(toRad(endAngle));
  const y2 = cy + r * Math.sin(toRad(endAngle));
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

// The gauge sweeps from 135° to 405° (270° total arc)
function scoreToAngle(score: number) {
  return 135 + (score / 100) * 270;
}

interface HealthScoreCardProps {
  metrics: DashboardMetrics;
}

export function HealthScoreCard({ metrics }: HealthScoreCardProps) {
  const { health_score, health_components, health_trend } = metrics;
  const color  = getHealthColor(health_score);
  const status = getHealthLabel(health_score);
  const cfg    = STATUS_CONFIG[status];
  const StatusIcon = cfg.icon;

  const [whyOpen, setWhyOpen] = useState(false);

  // Animate score counter
  const [displayScore, setDisplayScore] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    const start = performance.now();
    const duration = 900;
    const animate = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplayScore(Math.round(ease * health_score));
      if (t < 1) raf.current = requestAnimationFrame(animate);
    };
    raf.current = requestAnimationFrame(animate);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [health_score]);

  const factors: Factor[] = [
    {
      label: "Dead Stock",
      icon: Package,
      score: health_components.dead_stock_score,
      pct:   health_components.dead_stock_pct,
      pctLabel: `${health_components.dead_stock_pct}% of SKUs`,
      weight: "30%",
      goodThreshold: 10,
    },
    {
      label: "Slow Movers",
      icon: RotateCcw,
      score: health_components.slow_mover_score,
      pct:   health_components.slow_mover_pct,
      pctLabel: `${health_components.slow_mover_pct}% of SKUs`,
      weight: "25%",
      goodThreshold: 20,
    },
    {
      label: "Stockout Risk",
      icon: ShieldAlert,
      score: health_components.stockout_score,
      pct:   health_components.stockout_risk_pct,
      pctLabel: `${health_components.stockout_risk_pct}% at risk`,
      weight: "30%",
      goodThreshold: 10,
    },
    {
      label: "ABC Quality",
      icon: BarChart3,
      score: health_components.abc_score,
      pct:   health_components.a_item_revenue_pct,
      pctLabel: `A-items: ${health_components.a_item_revenue_pct}% rev`,
      weight: "15%",
      goodThreshold: 999, // always show as informational
    },
  ];

  // Gauge arc path for needle position
  const needleAngle = scoreToAngle(health_score);
  const needleRad   = (needleAngle * Math.PI) / 180;
  const cx = 80, cy = 80, r = 56;
  const needleX = cx + (r - 14) * Math.cos(needleRad);
  const needleY = cy + (r - 14) * Math.sin(needleRad);

  return (
    <>
    <div className={`card p-5 flex flex-col gap-4 ${cfg.glow} transition-shadow duration-700`}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">
            Inventory Health Score
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWhyOpen(true)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] text-slate-500 hover:text-white hover:bg-white/8 border border-white/8 transition-colors"
            title="Why am I seeing this score?"
          >
            <HelpCircle className="w-3 h-3" />
            Why?
          </button>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
            <StatusIcon className="w-3 h-3" />
            {status}
          </span>
        </div>
      </div>

      {/* ── Gauge + score ── */}
      <div className="flex items-center gap-5">
        <div className="relative flex-shrink-0" style={{ width: 160, height: 104 }}>
          <svg viewBox="0 0 160 108" className="w-full h-full overflow-visible">
            {/* Track */}
            <path
              d={describeArc(cx, cy, r, 135, 405)}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="10"
              strokeLinecap="round"
            />

            {/* Coloured segments */}
            {GAUGE_SEGMENTS.map((seg) => {
              const cappedTo = Math.min(seg.to, health_score);
              if (cappedTo <= seg.from) return null;
              return (
                <path
                  key={seg.from}
                  d={describeArc(cx, cy, r, scoreToAngle(seg.from), scoreToAngle(cappedTo))}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth="10"
                  strokeLinecap="round"
                  style={{ transition: "all 1s ease" }}
                />
              );
            })}

            {/* Tick marks at 40 / 60 / 80 */}
            {[40, 60, 80].map((v) => {
              const a = scoreToAngle(v);
              const ra = (a * Math.PI) / 180;
              const x1 = cx + (r - 16) * Math.cos(ra);
              const y1 = cy + (r - 16) * Math.sin(ra);
              const x2 = cx + (r + 2)  * Math.cos(ra);
              const y2 = cy + (r + 2)  * Math.sin(ra);
              return (
                <line key={v} x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeLinecap="round" />
              );
            })}

            {/* Needle dot */}
            <circle cx={needleX} cy={needleY} r="4" fill={color}
              style={{ transition: "all 1s ease", filter: `drop-shadow(0 0 4px ${color})` }} />

            {/* Centre score */}
            <text x={cx} y={cy + 8} textAnchor="middle"
              fontSize="22" fontWeight="700" fill={color}
              style={{ transition: "fill 0.5s ease" }}>
              {displayScore}
            </text>
            <text x={cx} y={cy + 22} textAnchor="middle"
              fontSize="9" fill="#64748b">/100</text>

            {/* Range labels */}
            <text x="20"  y="106" fontSize="8" fill="#475569" textAnchor="middle">0</text>
            <text x="140" y="106" fontSize="8" fill="#475569" textAnchor="middle">100</text>
          </svg>
        </div>

        {/* Status block */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-400 leading-relaxed">{cfg.desc}</p>
          {/* Zone legend */}
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1">
            {(["Poor", "Fair", "Good", "Excellent"] as const).map((s) => {
              const c = STATUS_CONFIG[s];
              const active = s === status;
              return (
                <div key={s} className={`flex items-center gap-1.5 transition-opacity ${active ? "opacity-100" : "opacity-35"}`}>
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: getHealthColor(s === "Excellent" ? 90 : s === "Good" ? 70 : s === "Fair" ? 50 : 20) }} />
                  <span className={`text-[10px] font-medium ${active ? c.text : "text-slate-600"}`}>{s}</span>
                  <span className="text-[10px] text-slate-700">
                    {s === "Excellent" ? "≥80" : s === "Good" ? "60–79" : s === "Fair" ? "40–59" : "<40"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 4 Factor rows ── */}
      <div className="space-y-3 pt-1 border-t border-white/5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-slate-600 font-medium uppercase tracking-wider">Score factors</p>
          <p className="text-[10px] text-[#818cf8]">click a row to drill through ↗</p>
        </div>
        {factors.map((f) => {
          const factorColor = f.score >= 80 ? "#10b981" : f.score >= 60 ? "#3b82f6" : f.score >= 40 ? "#f59e0b" : "#ef4444";
          const FIcon = f.icon;
          const drillSegment = f.label as "Dead Stock" | "Slow Movers" | "Stockout Risk" | "ABC Quality";
          return (
            <div
              key={f.label}
              className="cursor-pointer hover:bg-white/3 rounded-lg px-1 -mx-1 transition-colors"
              onClick={() => openDrilldown({ chart: "health_factor", segment: drillSegment }, metrics)}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <FIcon className="w-3 h-3 text-slate-500 flex-shrink-0" />
                <span className="text-[11px] text-slate-400 flex-1">{f.label}</span>
                <span className="text-[10px] text-slate-600">{f.pctLabel}</span>
                <span className="text-[11px] font-semibold tabular-nums ml-1" style={{ color: factorColor }}>
                  {f.score}
                </span>
                <span className="text-[10px] text-slate-600 w-6 text-right">{f.weight}</span>
              </div>
              <div className="h-1.5 bg-white/6 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${f.score}%`, background: factorColor }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Sparkline trend ── */}
      {health_trend.length > 0 && (
        <div className="pt-1 border-t border-white/5">
          <p className="text-[10px] text-slate-600 mb-1.5">Score progression · current period</p>
          <div className="h-14">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={health_trend} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="healthGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="m" tick={{ fontSize: 9, fill: "#475569" }}
                  axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 6, fontSize: 11, padding: "4px 8px" }}
                  labelStyle={{ color: "#f1f5f9" }}
                  itemStyle={{ color: color }}
                  formatter={(v) => [v, "Score"]}
                />
                <Area type="monotone" dataKey="v" stroke={color}
                  strokeWidth={1.5} fill="url(#healthGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
    {/* Why? drawer */}
    {whyOpen && (
      <WhyDrawer kpiKey="health_score" metrics={metrics} onClose={() => setWhyOpen(false)} />
    )}
    </>
  );
}
