"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Brain, AlertTriangle, DollarSign, Zap, ListChecks, Star,
  Menu, Upload, ChevronRight, Clock, User, TrendingUp,
  CheckCircle2, XCircle, ShieldAlert, FileDown, RefreshCw,
  ChevronDown, ChevronUp, ShieldCheck, Database,
} from "lucide-react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { TrustBadge } from "@/components/validation/TrustBadge";
import { getDemoData } from "@/lib/demo-data";
import { isDemoMode } from "@/lib/demo-loader";
import { generateExecutiveSummary } from "@/lib/insights-generator";
import { openHtmlReport } from "@/lib/html-report-generator";
import { formatCurrency, getHealthColor, getHealthLabel, cn } from "@/lib/utils";
import type { DashboardMetrics } from "@/lib/types";
import type { ExecutiveSummary, RiskSeverity, ActionTimeline } from "@/lib/insights-generator";

// ── Severity config ────────────────────────────────────────────────────────────
const SEVERITY: Record<RiskSeverity, { bg: string; text: string; border: string; dot: string; label: string }> = {
  critical: { bg: "bg-red-500/10",    text: "text-red-400",    border: "border-red-500/20",    dot: "bg-red-400",    label: "Critical" },
  high:     { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20", dot: "bg-orange-400", label: "High"     },
  medium:   { bg: "bg-amber-500/10",  text: "text-amber-400",  border: "border-amber-500/20",  dot: "bg-amber-400",  label: "Medium"   },
  low:      { bg: "bg-blue-500/10",   text: "text-blue-400",   border: "border-blue-500/20",   dot: "bg-blue-400",   label: "Low"      },
};

const TIMELINE: Record<ActionTimeline, { text: string; bg: string }> = {
  "Immediate":    { text: "text-red-400",    bg: "bg-red-500/10"    },
  "This week":    { text: "text-amber-400",  bg: "bg-amber-500/10"  },
  "This month":   { text: "text-blue-400",   bg: "bg-blue-500/10"   },
  "Next quarter": { text: "text-slate-400",  bg: "bg-white/5"       },
};

const OWNER_ICON: Record<string, React.ElementType> = {
  CEO: Star, Finance: DollarSign, Procurement: ShieldAlert,
  "Supply Chain": TrendingUp, Operations: Zap,
};

const SCENARIO_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  CRITICAL: { bg: "bg-red-500/15",    text: "text-red-300",    label: "Critical"   },
  DEAD:     { bg: "bg-purple-500/15", text: "text-purple-300", label: "Dead stock" },
  SLOW:     { bg: "bg-amber-500/15",  text: "text-amber-300",  label: "Slow mover" },
  WATCH:    { bg: "bg-blue-500/15",   text: "text-blue-300",   label: "Watch"      },
  HEALTHY:  { bg: "bg-emerald-500/15",text: "text-emerald-300",label: "Healthy"    },
};

// ── Typewriter hook ────────────────────────────────────────────────────────────
function useTypewriter(text: string, speed = 18, active = true) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const idx = useRef(0);

  useEffect(() => {
    if (!active) { setDisplayed(text); setDone(true); return; }
    setDisplayed("");
    setDone(false);
    idx.current = 0;
    const id = setInterval(() => {
      idx.current++;
      setDisplayed(text.slice(0, idx.current));
      if (idx.current >= text.length) { clearInterval(id); setDone(true); }
    }, speed);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return { displayed, done };
}

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({
  icon: Icon, title, badge, children, delay = 0, visible,
}: {
  icon: React.ElementType; title: string; badge?: string;
  children: React.ReactNode; delay?: number; visible: boolean;
}) {
  return (
    <div
      className="card overflow-hidden transition-all duration-500"
      style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(12px)", transitionDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/5">
        <div className="w-7 h-7 rounded-lg bg-[#6366f1]/15 flex items-center justify-center flex-shrink-0">
          <Icon className="w-3.5 h-3.5 text-[#818cf8]" />
        </div>
        <h2 className="text-sm font-semibold text-white flex-1">{title}</h2>
        {badge && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#6366f1]/15 text-[#818cf8] border border-[#6366f1]/25">
            {badge}
          </span>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── Action Card with "Generated Because" accordion ────────────────────────────
function ActionCard({
  action,
  tl,
  OwnerIcon,
  metrics,
}: {
  action: { priority: number; action: string; rationale: string; timeline: string; owner: string; estimated_impact: string };
  tl: { bg: string; text: string };
  OwnerIcon: React.ElementType;
  metrics: DashboardMetrics | null;
}) {
  const [expanded, setExpanded] = useState(false);

  // Build "generated because" data based on action text
  const generatedBecause = metrics ? buildGeneratedBecause(action.action, metrics) : null;

  return (
    <div className="rounded-xl bg-white/3 border border-white/6 hover:bg-white/[0.035] transition-colors overflow-hidden">
      <div className="flex gap-3 p-4">
        {/* Priority number */}
        <div className="w-6 h-6 rounded-full bg-[#6366f1]/20 border border-[#6366f1]/30 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-[11px] font-bold text-[#818cf8]">{action.priority}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap mb-1">
            <p className="text-xs font-semibold text-white flex-1 min-w-0">{action.action}</p>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium", tl.bg, tl.text)}>
                <Clock className="w-2.5 h-2.5" />
                {action.timeline}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-slate-400">
                <OwnerIcon className="w-2.5 h-2.5" />
                {action.owner}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed mb-1.5">{action.rationale}</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
              <span className="text-[11px] text-emerald-400">{action.estimated_impact}</span>
            </div>
            {generatedBecause && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1 text-[10px] text-[#818cf8] hover:text-white transition-colors"
              >
                <ShieldCheck className="w-3 h-3" />
                Generated because…
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expandable "Generated Because" section */}
      {expanded && generatedBecause && (
        <div className="border-t border-white/5 px-4 pb-4 pt-3 space-y-3 bg-[#6366f1]/4">
          <div className="flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-[#818cf8]" />
            <span className="text-[10px] font-semibold text-[#818cf8] uppercase tracking-wider">Generated Because</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {generatedBecause.stats.map((s) => (
              <div key={s.label} className="p-2.5 rounded-lg bg-white/4 border border-white/6 text-center">
                <p className={cn("text-sm font-bold", s.color)}>{s.value}</p>
                <p className="text-[10px] text-slate-600 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {generatedBecause.topItems.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-600 mb-1.5">Top affected items:</p>
              <div className="space-y-1">
                {generatedBecause.topItems.slice(0, 5).map((item) => (
                  <div key={item.sku_id} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-slate-400 truncate">{item.product_name}</span>
                    <span className={cn("tabular-nums font-medium flex-shrink-0", item.valueColor)}>{item.displayValue}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <span className={cn(
              "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
              generatedBecause.confidence === "High"
                ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                : "text-amber-400 bg-amber-500/10 border-amber-500/20"
            )}>
              {generatedBecause.confidence} confidence
            </span>
            <span className="text-[10px] text-slate-600">· Data source: {generatedBecause.source}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Build "generated because" payload for a recommendation
function buildGeneratedBecause(
  actionText: string,
  metrics: DashboardMetrics
): { stats: { label: string; value: string; color: string }[]; topItems: { sku_id: string; product_name: string; displayValue: string; valueColor: string }[]; confidence: "High" | "Medium"; source: string } | null {
  const lc = actionText.toLowerCase();

  if (lc.includes("dead") || lc.includes("obsolete")) {
    return {
      stats: [
        { label: "Dead Stock SKUs",   value: String(metrics.dead_stock_count),           color: "text-red-400" },
        { label: "Value at Risk",     value: formatCurrency(metrics.dead_stock_value, true), color: "text-red-300" },
        { label: "Carrying Cost/yr",  value: formatCurrency(metrics.dead_stock_value * 0.25, true), color: "text-amber-400" },
      ],
      topItems: metrics.top_dead_stock.slice(0, 5).map((s) => ({
        sku_id: s.sku_id,
        product_name: s.product_name,
        displayValue: formatCurrency(s.inventory_value, true),
        valueColor: "text-red-400",
      })),
      confidence: "High",
      source: "Dead Stock Analysis",
    };
  }
  if (lc.includes("stockout") || lc.includes("reorder") || lc.includes("replenish") || lc.includes("stock") && lc.includes("risk")) {
    return {
      stats: [
        { label: "At-Risk SKUs",     value: String(metrics.stockout_risk_count),  color: "text-orange-400" },
        { label: "Critical",         value: String(metrics.critical_stockout_count), color: "text-red-400" },
        { label: "Reorder Actions",  value: String(metrics.reorder_count),        color: "text-amber-400" },
      ],
      topItems: metrics.top_risk_items
        .filter((s) => s.scenario === "CRITICAL" || s.scenario === "WATCH")
        .slice(0, 5)
        .map((s) => ({
          sku_id: s.sku_id,
          product_name: s.product_name,
          displayValue: isFinite(s.days_stock_remaining) ? `${Math.round(s.days_stock_remaining)}d left` : "—",
          valueColor: s.scenario === "CRITICAL" ? "text-red-400" : "text-amber-400",
        })),
      confidence: "High",
      source: "Stockout Risk Analysis",
    };
  }
  if (lc.includes("slow") || lc.includes("turnover") || lc.includes("clearance") || lc.includes("promot")) {
    return {
      stats: [
        { label: "Slow Moving SKUs", value: String(metrics.slow_mover_count),           color: "text-amber-400" },
        { label: "Value",            value: formatCurrency(metrics.slow_mover_value, true), color: "text-amber-300" },
        { label: "Turnover Ratio",   value: `${metrics.turnover_ratio.toFixed(1)}×`,    color: "text-blue-400" },
      ],
      topItems: metrics.top_risk_items
        .filter((s) => s.scenario === "SLOW")
        .slice(0, 5)
        .map((s) => ({
          sku_id: s.sku_id,
          product_name: s.product_name,
          displayValue: formatCurrency(s.inventory_value, true),
          valueColor: "text-amber-400",
        })),
      confidence: "High",
      source: "Slow Moving Inventory Analysis",
    };
  }
  if (lc.includes("abc") || lc.includes("a-class") || lc.includes("critical item")) {
    return {
      stats: [
        { label: "A-Class SKUs",     value: String(metrics.abc_summary.a_count),               color: "text-emerald-400" },
        { label: "A-Item Rev %",     value: `${metrics.abc_summary.a_revenue_pct}%`,            color: "text-emerald-300" },
        { label: "Health Score",     value: String(metrics.health_score),                       color: "text-blue-400" },
      ],
      topItems: metrics.top_risk_items
        .filter((s) => s.abc_class === "A")
        .sort((a, b) => b.inventory_value - a.inventory_value)
        .slice(0, 5)
        .map((s) => ({
          sku_id: s.sku_id,
          product_name: s.product_name,
          displayValue: formatCurrency(s.inventory_value, true),
          valueColor: "text-emerald-400",
        })),
      confidence: "Medium",
      source: "ABC Analysis",
    };
  }
  // Generic fallback
  return {
    stats: [
      { label: "Total SKUs",      value: String(metrics.total_skus),                            color: "text-white" },
      { label: "Health Score",    value: `${metrics.health_score}/100`,                         color: "text-blue-400" },
      { label: "Recovery Value",  value: formatCurrency(metrics.recoverable_capital, true),     color: "text-purple-400" },
    ],
    topItems: [],
    confidence: "Medium",
    source: "Inventory Analysis",
  };
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function InsightsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [isDemo, setIsDemo] = useState(true);
  const [generating, setGenerating] = useState(true);
  const [sourceFile, setSourceFile] = useState("Inventory dataset");
  const [exporting, setExporting] = useState(false);
  const [sectionsVisible, setSectionsVisible] = useState(false);
  const [activeAudience, setActiveAudience] = useState<"ceo" | "supply_chain" | "procurement">("ceo");

  useEffect(() => {
    let m: DashboardMetrics;
    let fields: string[] = [];
    try {
      const stored = typeof window !== "undefined" && sessionStorage.getItem("supplysense_metrics");
      const fn     = typeof window !== "undefined" && sessionStorage.getItem("supplysense_filename");
      const fl     = typeof window !== "undefined" && sessionStorage.getItem("supplysense_fields");
      if (stored) {
        m = JSON.parse(stored);
        setIsDemo(false);
        if (fn) setSourceFile(fn);
        if (fl) fields = JSON.parse(fl);
      } else { const { metrics: dm } = getDemoData(); m = dm; }
    } catch { const { metrics: dm } = getDemoData(); m = dm; }
    setMetrics(m);

    // Shorter delay in demo mode to avoid dead air during presentations
    const delay = isDemoMode() ? 600 : 1800;
    const t1 = setTimeout(() => {
      setSummary(generateExecutiveSummary(m, fields));
      setGenerating(false);
      setTimeout(() => setSectionsVisible(true), 100);
    }, delay);
    return () => clearTimeout(t1);
  }, []);

  const { displayed: headlineText } = useTypewriter(
    summary?.health_overview.headline ?? "",
    22,
    !!summary && !generating
  );

  if (!metrics || generating) {
    return (
      <div className="flex h-screen bg-[#020617] overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-[#6366f1]/15 border border-[#6366f1]/25 flex items-center justify-center">
              <Brain className="w-7 h-7 text-[#818cf8]" />
            </div>
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#6366f1] flex items-center justify-center">
              <RefreshCw className="w-2.5 h-2.5 text-white animate-spin" />
            </span>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-white mb-1">Generating executive summary…</p>
            <p className="text-xs text-slate-500">Analyzing {metrics?.total_skus ?? "—"} SKUs across 5 dimensions</p>
          </div>
          {/* Animated steps */}
          <div className="space-y-2 w-56">
            {["Reading inventory metrics", "Identifying risk patterns", "Calculating financial impact", "Drafting recommendations"].map((step, i) => (
              <GeneratingStep key={step} label={step} delay={i * 380} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!summary) return null;
  const hColor = getHealthColor(summary.health_overview.score);

  return (
    <div className="flex h-screen bg-[#020617] overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="nav-glass sticky top-0 z-30 flex-shrink-0">
          <div className="flex items-center h-[46px] px-4 gap-3">
            <button onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors">
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex-1 min-w-0">
              <span className="text-xs text-slate-500">
                AI Insights · Generated {new Date(summary.generated_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                {isDemo && <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20">Demo</span>}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={exporting || !summary || !metrics}
                onClick={async () => {
                  if (!summary || !metrics) return;
                  setExporting(true);
                  await new Promise(r => setTimeout(r, 120));
                  openHtmlReport(metrics, summary, sourceFile);
                  setExporting(false);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 border border-white/8 hover:border-white/16 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-wait"
              >
                {exporting
                  ? <><RefreshCw className="w-3 h-3 animate-spin" /> Generating…</>
                  : <><FileDown className="w-3 h-3" /> Export Report</>
                }
              </button>
              <Link href="/upload"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#6366f1] hover:bg-[#4f46e5] text-white text-xs font-medium transition-colors">
                <Upload className="w-3 h-3" /> New upload
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[900px] mx-auto px-4 py-6 space-y-5">

            {/* Page header */}
            <div className="flex items-start justify-between gap-4"
              style={{ opacity: sectionsVisible ? 1 : 0, transition: "opacity 0.4s ease" }}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Brain className="w-4 h-4 text-[#818cf8]" />
                  <h1 className="text-base font-bold text-white" style={{ fontFamily: "Syne, sans-serif" }}>
                    Executive Summary
                  </h1>
                </div>
                <p className="text-xs text-slate-500">
                  AI-generated analysis · {metrics.total_skus} SKUs · {new Date(summary.generated_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </p>
              </div>
              {/* Audience selector */}
              <div className="flex items-center gap-1 p-1 rounded-lg bg-white/4 border border-white/8 flex-shrink-0">
                {(["ceo", "supply_chain", "procurement"] as const).map((a) => (
                  <button
                    key={a}
                    onClick={() => setActiveAudience(a)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors whitespace-nowrap",
                      activeAudience === a
                        ? "bg-[#6366f1] text-white"
                        : "text-slate-500 hover:text-white"
                    )}
                  >
                    {a === "ceo" ? "CEO" : a === "supply_chain" ? "Supply Chain" : "Procurement"}
                  </button>
                ))}
              </div>
            </div>

            {/* Audience note banner */}
            <div
              className="px-4 py-3 rounded-xl bg-[#6366f1]/8 border border-[#6366f1]/15"
              style={{ opacity: sectionsVisible ? 1 : 0, transition: "opacity 0.5s ease 100ms" }}
            >
              <div className="flex items-start gap-2.5">
                <User className="w-3.5 h-3.5 text-[#818cf8] mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-[11px] font-semibold text-[#818cf8] block mb-0.5">
                    {activeAudience === "ceo" ? "For the CEO" : activeAudience === "supply_chain" ? "For Supply Chain Directors" : "For Procurement Managers"}
                  </span>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {summary.audience_notes[activeAudience]}
                  </p>
                </div>
              </div>
            </div>

            {/* ── 1. Health Overview ── */}
            <Section icon={Zap} title="Inventory Health Overview"
              badge={`${summary.health_overview.score}/100 · ${summary.health_overview.status}`}
              delay={0} visible={sectionsVisible}>
              <div className="flex items-start gap-4">
                {/* Score pill */}
                <div className="flex-shrink-0 w-20 h-20 rounded-2xl border flex flex-col items-center justify-center gap-0.5"
                  style={{ background: `${hColor}10`, borderColor: `${hColor}25` }}>
                  <span className="text-2xl font-bold leading-none" style={{ color: hColor }}>
                    {summary.health_overview.score}
                  </span>
                  <span className="text-[10px] font-semibold" style={{ color: hColor }}>
                    {summary.health_overview.status}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  {/* Typewriter headline */}
                  <p className="text-sm font-semibold text-white leading-snug mb-2 min-h-[2.5rem]">
                    {headlineText}
                    <span className="inline-block w-0.5 h-3.5 bg-[#818cf8] ml-0.5 align-middle animate-pulse" />
                  </p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {summary.health_overview.body}
                  </p>
                </div>
              </div>
            </Section>

            {/* ── 2. Key Risks ── */}
            <Section icon={AlertTriangle} title="Key Risks"
              badge={`${summary.key_risks.filter(r => r.severity === "critical" || r.severity === "high").length} high priority`}
              delay={80} visible={sectionsVisible}>
              <div className="space-y-3">
                {summary.key_risks.map((risk, i) => {
                  const s = SEVERITY[risk.severity];
                  return (
                    <div key={i} className={`rounded-xl border p-4 ${s.bg} ${s.border}`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${s.dot}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className={`text-[10px] font-semibold uppercase tracking-wide ${s.text}`}>
                              {s.label}
                            </span>
                            {risk.affected_skus > 0 && (
                              <span className="text-[10px] text-slate-600">
                                · {risk.affected_skus} SKU{risk.affected_skus > 1 ? "s" : ""}
                              </span>
                            )}
                            {risk.financial_exposure > 0 && (
                              <span className="text-[10px] text-slate-600">
                                · {formatCurrency(risk.financial_exposure, true)} exposure
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-semibold text-white mb-1">{risk.title}</p>
                          <p className="text-xs text-slate-400 leading-relaxed">{risk.detail}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>

            {/* ── 3. Financial Impact ── */}
            <Section icon={DollarSign} title="Financial Impact"
              delay={160} visible={sectionsVisible}>
              <p className="text-xs text-slate-400 leading-relaxed mb-5">
                {summary.financial_impact.body}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {summary.financial_impact.metrics.map((m) => (
                  <div key={m.label}
                    className={cn(
                      "rounded-xl p-3 border",
                      m.highlight
                        ? "bg-amber-500/8 border-amber-500/20"
                        : "bg-white/3 border-white/6"
                    )}>
                    <p className="text-[10px] text-slate-500 mb-0.5">{m.label}</p>
                    <p className={cn("text-base font-bold leading-none mb-0.5", m.highlight ? "text-amber-400" : "text-white")}>
                      {m.value}
                    </p>
                    {m.sub && <p className="text-[10px] text-slate-600">{m.sub}</p>}
                  </div>
                ))}
              </div>
            </Section>

            {/* ── 4. Recommended Actions ── */}
            <Section icon={ListChecks} title="Recommended Actions"
              badge={`${summary.recommended_actions.length} actions`}
              delay={240} visible={sectionsVisible}>
              <div className="space-y-3">
                {summary.recommended_actions.map((action) => {
                  const tl = TIMELINE[action.timeline];
                  const OwnerIcon = OWNER_ICON[action.owner] ?? User;
                  return (
                    <ActionCard
                      key={action.priority}
                      action={action}
                      tl={tl}
                      OwnerIcon={OwnerIcon}
                      metrics={metrics}
                    />
                  );
                })}
              </div>
            </Section>

            {/* ── 5. Priority Items ── */}
            <Section icon={Star} title="Priority Items"
              badge={`Top ${summary.priority_items.length} items`}
              delay={320} visible={sectionsVisible}>
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full min-w-[580px]">
                  <thead>
                    <tr className="border-b border-white/5">
                      {["SKU", "Product", "ABC", "Status", "Days Left", "Action", "Value"].map(h => (
                        <th key={h} className="pb-2.5 text-left text-[10px] font-medium text-slate-500 uppercase tracking-wider pr-3 last:pr-0">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {summary.priority_items.map((item, i) => {
                      const sc = SCENARIO_CONFIG[item.scenario] ?? SCENARIO_CONFIG.HEALTHY;
                      const isUrgent = item.scenario === "CRITICAL";
                      return (
                        <tr key={item.sku_id}
                          className={cn("border-b border-white/4 last:border-0 hover:bg-white/2 transition-colors", i === 0 && "bg-white/1")}>
                          <td className="py-3 pr-3 font-mono text-[11px] text-slate-500">{item.sku_id}</td>
                          <td className="py-3 pr-3 text-xs font-medium text-white max-w-[160px] truncate">{item.product_name}</td>
                          <td className="py-3 pr-3">
                            <span className="badge bg-indigo-500/15 text-indigo-300">{item.abc_class}</span>
                          </td>
                          <td className="py-3 pr-3">
                            <span className={cn("badge", sc.bg, sc.text)}>{sc.label}</span>
                          </td>
                          <td className={cn("py-3 pr-3 text-xs font-medium tabular-nums", isUrgent ? "text-red-400" : "text-slate-400")}>
                            {item.days_left !== null ? `${item.days_left}d` : "∞"}
                          </td>
                          <td className="py-3 pr-3">
                            <div className="flex items-center gap-1.5">
                              {isUrgent && <XCircle className="w-3 h-3 text-red-400 flex-shrink-0" />}
                              <span className={cn("text-xs font-medium", isUrgent ? "text-red-400" : "text-slate-400")}>
                                {item.urgency_label}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 font-mono text-[11px] text-slate-300">
                            {formatCurrency(item.value, true)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 pt-4 border-t border-white/5">
                <Link href="/dashboard"
                  className="inline-flex items-center gap-1.5 text-xs text-[#818cf8] hover:text-white transition-colors">
                  View full inventory dashboard
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </Section>

            {/* ── 6. Data Completeness (conditional) ── */}
            {summary.data_completeness && summary.data_completeness.score < 86 && (
              <Section icon={Zap} title="Data Completeness Advisor"
                badge={`${summary.data_completeness.score}/100`}
                delay={400} visible={sectionsVisible}>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-slate-400">Completeness Score</span>
                      <span className="text-xs font-semibold" style={{ color: summary.data_completeness.tier_color }}>
                        {summary.data_completeness.tier_label}
                      </span>
                    </div>
                    <div className="h-2 bg-white/8 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${summary.data_completeness.score}%`, backgroundColor: summary.data_completeness.tier_color }}
                      />
                    </div>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">{summary.data_completeness.note}</p>
                  {summary.data_completeness.missing_fields.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-amber-400 mb-2">Fields that would unlock additional insights:</p>
                      <div className="space-y-2">
                        {summary.data_completeness.missing_fields.map((f) => (
                          <div key={f.label} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-white/2 border border-white/5">
                            <span className="text-xs font-medium text-white w-32 flex-shrink-0">{f.label}</span>
                            <div className="flex flex-wrap gap-1">
                              {f.unlocks.map((u) => (
                                <span key={u} className="text-[10px] px-1.5 py-0.5 rounded bg-[#6366f1]/10 text-[#818cf8] border border-[#6366f1]/15">{u}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Trust badge */}
            <div style={{ opacity: sectionsVisible ? 1 : 0, transition: "opacity 0.6s ease 500ms" }}>
              <TrustBadge variant="full" />
            </div>

          </div>
        </main>
      </div>
      <DemoBanner />
    </div>
  );
}

// ── Generating step animation ──────────────────────────────────────────────────
function GeneratingStep({ label, delay }: { label: string; delay: number }) {
  const [visible, setVisible] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), delay);
    const t2 = setTimeout(() => setDone(true), delay + 600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [delay]);

  return (
    <div className={cn("flex items-center gap-2.5 transition-all duration-300", visible ? "opacity-100" : "opacity-0")}>
      {done
        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
        : <RefreshCw className="w-3.5 h-3.5 text-[#818cf8] animate-spin flex-shrink-0" />
      }
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}
