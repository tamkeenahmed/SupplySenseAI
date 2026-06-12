"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Zap, Package, TrendingDown, AlertTriangle, RotateCcw,
  DollarSign, BarChart3, ShoppingCart, Upload, Bell, Menu,
  FileDown, CheckCircle2, RefreshCw, UserCircle, X, ShieldCheck, Settings,
} from "lucide-react";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { KPICard } from "@/components/dashboard/KPICard";
import { HealthScoreCard } from "@/components/dashboard/HealthScoreCard";
import { RiskChart } from "@/components/dashboard/RiskChart";
import { ABCChart } from "@/components/dashboard/ABCChart";
import { TopRiskTable } from "@/components/dashboard/TopRiskTable";
import { AgingDashboard } from "@/components/dashboard/AgingDashboard";
import { DataCompletenessAdvisor } from "@/components/dashboard/DataCompletenessAdvisor";
import { DemoBanner, DemoWelcomeToast } from "@/components/demo/DemoBanner";
import { TrustBadge } from "@/components/validation/TrustBadge";
import { ScoreBreakdown } from "@/components/validation/ScoreBreakdown";
import { formatCurrency, getHealthColor, getHealthLabel } from "@/lib/utils";
import { isDemoMode, hasSessionData, clearSession } from "@/lib/demo-loader";
import { MODE_LABELS, MODE_DESCRIPTIONS } from "@/lib/analysis-detector";
import { computeCompleteness } from "@/lib/data-completeness";
import type { DashboardMetrics } from "@/lib/types";
import type { ActivePolicy } from "@/lib/policy";

// Inline demo loader button used in the no-data gate screen
function NoDataDemoButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const handleClick = async () => {
    setLoading(true);
    const { loadDemoIntoSession } = await import("@/lib/demo-loader");
    loadDemoIntoSession();
    router.push("/dashboard");
  };
  return (
    <button onClick={handleClick} disabled={loading}
      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/8 text-slate-300 text-sm border border-white/8 transition-colors disabled:opacity-60">
      {loading
        ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Loading demo…</>
        : <>Start Demo Mode</>
      }
    </button>
  );
}

function exportPOCsv(recs: DashboardMetrics["reorder_recommendations"]) {
  const header = "SKU,Product Name,Supplier,ABC Class,Order Qty (EOQ),Reorder Point,Days Until Stockout,Urgency,Unit Cost,Est. Order Value";
  const rows = recs.map((r) =>
    [r.sku_id, `"${r.product_name}"`, `"${r.supplier_name}"`, r.abc_class,
     r.eoq, r.rop, isFinite(r.days_until_stockout) ? r.days_until_stockout : "—",
     r.urgency.replace(/_/g, " "), r.unit_cost.toFixed(2), (r.eoq * r.unit_cost).toFixed(2)
    ].join(",")
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `SupplySense-PO-Draft-${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function ReorderList({ metrics }: { metrics: DashboardMetrics }) {
  const recs = metrics.reorder_recommendations.slice(0, 6);

  const URGENCY = {
    immediate: { bg: "bg-red-500/15", text: "text-red-300", border: "border-red-500/20", label: "Now" },
    this_week: { bg: "bg-amber-500/15", text: "text-amber-300", border: "border-amber-500/20", label: "This week" },
    this_month: { bg: "bg-blue-500/15", text: "text-blue-300", border: "border-blue-500/20", label: "This month" },
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <div>
          <h3 className="text-sm font-semibold text-white">Reorder recommendations</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">EOQ-optimized · 95% service level</p>
        </div>
        <button
          onClick={() => exportPOCsv(metrics.reorder_recommendations)}
          disabled={metrics.reorder_recommendations.length === 0}
          className="inline-flex items-center gap-1.5 text-xs text-[#818cf8] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          Export PO draft
        </button>
      </div>

      <div className="divide-y divide-white/4">
        {recs.map((rec) => {
          const u = URGENCY[rec.urgency];
          return (
            <div key={rec.sku_id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/2 transition-colors">
              <span className={`badge border ${u.bg} ${u.text} ${u.border} shrink-0`}>{u.label}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-white truncate">{rec.product_name}</div>
                <div className="text-[11px] text-slate-500">{rec.sku_id} · {rec.supplier_name}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs font-medium text-white">EOQ {rec.eoq} units</div>
                <div className="text-[11px] text-slate-500">
                  {isFinite(rec.days_until_stockout) ? `${rec.days_until_stockout}d left` : "—"}
                </div>
              </div>
            </div>
          );
        })}
        {recs.length === 0 && (
          <div className="px-5 py-6 text-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
            <p className="text-xs text-slate-500">No critical reorders needed right now</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [filename, setFilename] = useState("");
  const [rowCount, setRowCount] = useState(0);
  const [isDemo, setIsDemo] = useState(false);
  const [noData, setNoData] = useState(false);
  const [detectedFields, setDetectedFields] = useState<string[]>([]);
  const [activePolicy, setActivePolicy] = useState<ActivePolicy | null>(null);

  // Bump this any time the analyzer logic changes so stale sessionStorage
  // is automatically invalidated and the user is prompted to re-upload.
  const METRICS_VERSION = "4";

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const storedVersion = sessionStorage.getItem("supplysense_metrics_version");
      // If version doesn't match, wipe old metrics so stale numbers aren't shown
      if (storedVersion !== METRICS_VERSION) {
        sessionStorage.removeItem("supplysense_metrics");
        sessionStorage.removeItem("supplysense_filename");
        sessionStorage.removeItem("supplysense_rows");
        sessionStorage.removeItem("supplysense_fields");
        sessionStorage.removeItem("supplysense_metrics_version");
        setNoData(true);
        return;
      }
      const stored   = sessionStorage.getItem("supplysense_metrics");
      const storedFn = sessionStorage.getItem("supplysense_filename");
      const storedRw = sessionStorage.getItem("supplysense_rows");
      const storedFl = sessionStorage.getItem("supplysense_fields");
      if (stored) {
        const parsedMetrics: DashboardMetrics = JSON.parse(stored);
        setMetrics(parsedMetrics);
        setFilename(storedFn ?? "Uploaded file");
        setRowCount(parseInt(storedRw ?? "0", 10));
        setIsDemo(isDemoMode());
        setDetectedFields(storedFl ? JSON.parse(storedFl) : []);
        // Load active policy — prefer metrics.active_policy, fall back to session
        if (parsedMetrics.active_policy) {
          setActivePolicy(parsedMetrics.active_policy);
        } else {
          const storedPolicy = sessionStorage.getItem("supplysense_policy");
          if (storedPolicy) {
            try { setActivePolicy(JSON.parse(storedPolicy)); } catch { /* ignore */ }
          }
        }
        return;
      }
    } catch { /* corrupt storage */ }
    // No data at all — signal redirect state
    setNoData(true);
  }, []);

  // No session data → prompt to upload or start demo
  if (noData) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#020617] px-4">
        <div className="card p-8 max-w-sm w-full text-center space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-[#6366f1]/15 border border-[#6366f1]/25 flex items-center justify-center mx-auto">
            <Upload className="w-5 h-5 text-[#818cf8]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white mb-1.5" style={{ fontFamily: "Syne, sans-serif" }}>No data loaded yet</h2>
            <p className="text-xs text-slate-500 leading-relaxed">Upload your inventory file for a live analysis, or start the interactive demo to explore the platform.</p>
          </div>
          <div className="flex flex-col gap-2">
            <Link href="/upload"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#6366f1] hover:bg-[#4f46e5] text-white text-sm font-medium transition-colors">
              <Upload className="w-3.5 h-3.5" />
              Upload your inventory
            </Link>
            <NoDataDemoButton />
          </div>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#020617]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-6 h-6 text-[#818cf8] animate-spin" />
          <span className="text-sm text-slate-500">Loading analysis…</span>
        </div>
      </div>
    );
  }

  const mode = metrics.analysis_mode ?? "health";
  const completeness = computeCompleteness(detectedFields);
  const healthColor = getHealthColor(metrics.health_score);
  const healthLabel = getHealthLabel(metrics.health_score);
  const healthIconColor  = metrics.health_score >= 80 ? "text-emerald-400" : metrics.health_score >= 60 ? "text-blue-400" : metrics.health_score >= 40 ? "text-amber-400" : "text-red-400";
  const healthValueColor = healthIconColor;
  const aging = metrics.aging_metrics;

  // ── Aging-specific KPI cards (Mode B) ───────────────────────────────────
  const AGING_KPI_CARDS = [
    {
      label: "Ageing Health Score",
      value: `${aging?.ageing_health_score ?? 0}/100`,
      icon: Zap,
      iconBg: "bg-white/5",
      iconColor: (aging?.ageing_health_score ?? 0) >= 80 ? "text-emerald-400" : (aging?.ageing_health_score ?? 0) >= 60 ? "text-blue-400" : (aging?.ageing_health_score ?? 0) >= 40 ? "text-amber-400" : "text-red-400",
      valueColor: (aging?.ageing_health_score ?? 0) >= 80 ? "text-emerald-400" : (aging?.ageing_health_score ?? 0) >= 60 ? "text-blue-400" : (aging?.ageing_health_score ?? 0) >= 40 ? "text-amber-400" : "text-red-400",
      sub: "Based on ageing distribution",
      kpiKey: "ageing_score" as const,
    },
    {
      label: "Inventory Value",
      value: formatCurrency(aging?.total_value ?? metrics.total_inventory_value, true),
      icon: Package,
      iconBg: "bg-white/5",
      iconColor: "text-slate-400",
      valueColor: "text-white",
      sub: `${aging?.total_items ?? metrics.total_skus} items`,
      kpiKey: "inventory_value" as const,
    },
    {
      label: "Dead Stock Value",
      value: formatCurrency(aging?.dead_stock_value ?? 0, true),
      icon: TrendingDown,
      iconBg: "bg-red-500/10",
      iconColor: "text-red-400",
      valueColor: "text-red-300",
      sub: `${aging?.dead_stock_count ?? 0} items · 181+ days`,
      kpiKey: "dead_stock" as const,
    },
    {
      label: "Blocked Capital",
      value: formatCurrency(aging?.blocked_capital ?? 0, true),
      icon: DollarSign,
      iconBg: "bg-orange-500/10",
      iconColor: "text-orange-400",
      valueColor: "text-orange-400",
      sub: "Dead + slow moving stock",
      kpiKey: "blocked_capital" as const,
    },
    {
      label: "Avg Ageing Days",
      value: `${aging?.avg_ageing_days ?? 0}d`,
      icon: RotateCcw,
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-400",
      valueColor: (aging?.avg_ageing_days ?? 0) <= 90 ? "text-emerald-400" : (aging?.avg_ageing_days ?? 0) <= 180 ? "text-amber-400" : "text-red-400",
      sub: "Weighted by inventory value",
      kpiKey: "avg_ageing_days" as const,
    },
    {
      label: "Slow Moving Value",
      value: formatCurrency(aging?.slow_moving_value ?? 0, true),
      icon: AlertTriangle,
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-400",
      valueColor: "text-amber-400",
      sub: `${aging?.slow_moving_count ?? 0} items · 91–180 days`,
      kpiKey: "slow_moving" as const,
    },
    {
      label: "Fresh Stock",
      value: `${aging?.buckets[0]?.pct_count ?? 0}%`,
      icon: BarChart3,
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-400",
      valueColor: "text-emerald-400",
      sub: `${aging?.buckets[0]?.count ?? 0} items aged 0–30 days`,
      kpiKey: undefined,
    },
    {
      label: "Liquidation Items",
      value: String(aging?.liquidation_opportunities.length ?? 0),
      icon: ShoppingCart,
      iconBg: "bg-purple-500/10",
      iconColor: "text-purple-400",
      valueColor: "text-purple-400",
      sub: "Items ready to liquidate",
      kpiKey: undefined,
    },
  ];

  // ── Health KPI cards (Mode A) ────────────────────────────────────────────
  const KPI_CARDS = [
    {
      label: "Health Score",
      value: `${metrics.health_score}/100`,
      icon: Zap,
      iconBg: "bg-white/5",
      iconColor: healthIconColor,
      valueColor: healthValueColor,
      sub: healthLabel,
      kpiKey: "health_score" as const,
    },
    {
      label: "Inventory Value",
      value: formatCurrency(metrics.total_inventory_value, true),
      icon: Package,
      iconBg: "bg-white/5",
      iconColor: "text-slate-400",
      valueColor: "text-white",
      sub: `${formatCurrency(metrics.annual_carrying_cost, true)}/yr carry`,
      kpiKey: "inventory_value" as const,
    },
    {
      label: "Dead Stock Value",
      value: formatCurrency(metrics.dead_stock_value, true),
      icon: TrendingDown,
      iconBg: "bg-purple-500/10",
      iconColor: "text-purple-400",
      valueColor: "text-purple-300",
      sub: `${metrics.dead_stock_count} SKUs · ${formatCurrency(metrics.dead_stock_carrying_cost, true)}/yr`,
      kpiKey: "dead_stock" as const,
    },
    {
      label: "Stockout Risk Count",
      value: String(metrics.stockout_risk_count),
      icon: AlertTriangle,
      iconBg: "bg-red-500/10",
      iconColor: "text-red-400",
      valueColor: metrics.stockout_risk_count > 0 ? "text-red-400" : "text-emerald-400",
      sub: `${metrics.critical_stockout_count} immediate · at/below reorder point`,
      delta: metrics.critical_stockout_count > 0 ? `⚠ ${metrics.critical_stockout_count} urgent` : undefined,
      kpiKey: "stockout_risk" as const,
    },
    {
      label: "Slow Mover Value",
      value: formatCurrency(metrics.slow_mover_value, true),
      icon: RotateCcw,
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-400",
      valueColor: "text-amber-400",
      sub: `${metrics.slow_mover_count} SKUs slowing`,
      kpiKey: "slow_moving" as const,
    },
    {
      label: "Recoverable Capital",
      value: formatCurrency(metrics.recoverable_capital, true),
      icon: DollarSign,
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-400",
      valueColor: "text-emerald-400",
      sub: "Unlock via liquidation",
      kpiKey: "recoverable_capital" as const,
    },
    {
      label: "Turnover Ratio",
      value: `${metrics.turnover_ratio}×`,
      icon: BarChart3,
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-400",
      valueColor: "text-blue-400",
      sub: "4.5× US mfg benchmark",
      kpiKey: "turnover_ratio" as const,
    },
    {
      label: "Reorder Count",
      value: String(metrics.reorder_count),
      icon: ShoppingCart,
      iconBg: "bg-orange-500/10",
      iconColor: "text-orange-400",
      valueColor: "text-orange-400",
      sub: `${metrics.reorder_count === 1 ? "purchase order" : "purchase orders"} due`,
      kpiKey: "reorder_count" as const,
    },
  ];

  return (
    <div className="flex h-screen bg-[#020617] ss-page overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="nav-glass sticky top-0 z-30 flex-shrink-0">
          <div className="flex items-center h-[46px] px-4 gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="flex-1 min-w-0">
              <span className="text-xs text-slate-500 truncate">
                {isDemo ? "Demo dataset" : filename} · {metrics.total_skus} SKUs
              </span>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {isDemo && (
                <div className="hidden sm:flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Demo mode
                  </span>
                  <Link href="/upload"
                    onClick={() => { try { clearSession(); } catch {} }}
                    className="text-[10px] text-slate-500 hover:text-white transition-colors underline underline-offset-2">
                    Upload real data →
                  </Link>
                </div>
              )}
              <Link
                href="/upload"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#6366f1] hover:bg-[#4f46e5] text-white text-xs font-medium transition-colors"
              >
                <Upload className="w-3 h-3" />
                New upload
              </Link>
              {/* Compact theme toggle */}
              <div className="hidden sm:block">
                <ThemeSwitcher variant="compact" />
              </div>

              {/* Bell with dropdown */}
              <div className="relative">
                <button
                  aria-label={metrics.critical_stockout_count > 0 ? `${metrics.critical_stockout_count} critical alerts` : "Notifications"}
                  onClick={() => setBellOpen((o) => !o)}
                  className="relative p-1.5 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
                >
                  <Bell className="w-4 h-4" />
                  {metrics.critical_stockout_count > 0 && (
                    <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-red-500" aria-hidden="true" />
                  )}
                </button>
                {bellOpen && (
                  <div className="absolute right-0 top-9 w-72 card border border-white/10 shadow-2xl z-50 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                      <span className="text-xs font-semibold text-white">Alerts</span>
                      <button onClick={() => setBellOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto divide-y divide-white/4">
                      {metrics.top_risk_items.slice(0, 5).map((item) => (
                        <div key={item.sku_id} className="px-4 py-2.5 hover:bg-white/2 transition-colors">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className={`w-3 h-3 mt-0.5 flex-shrink-0 ${item.scenario === "CRITICAL" ? "text-red-400" : "text-amber-400"}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-medium text-white truncate">{item.product_name}</p>
                              <p className="text-[10px] text-slate-500">
                                {item.scenario === "CRITICAL"
                                  ? `Stockout in ${isFinite(item.days_stock_remaining) ? Math.round(item.days_stock_remaining) : "—"}d`
                                  : item.scenario === "DEAD" ? "Dead stock — no movement" : "Slow mover"}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                      {metrics.critical_stockout_count === 0 && (
                        <div className="px-4 py-4 text-center text-xs text-slate-500">No active alerts</div>
                      )}
                    </div>
                    <div className="px-4 py-2.5 border-t border-white/5">
                      <Link href="/dashboard/insights" onClick={() => setBellOpen(false)}
                        className="text-[11px] text-[#818cf8] hover:text-white transition-colors">
                        View full AI analysis →
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* User avatar */}
              <div className="w-7 h-7 rounded-full bg-[#6366f1]/20 flex items-center justify-center text-[#818cf8]">
                <UserCircle className="w-5 h-5" />
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1280px] mx-auto px-4 py-5 space-y-5">

            {/* Analysis mode banner */}
            {mode !== "health" && (
              <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border ${
                mode === "aging"    ? "bg-blue-500/8 border-blue-500/20" :
                                     "bg-[#6366f1]/8 border-[#6366f1]/20"
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${mode === "aging" ? "bg-blue-400" : "bg-[#818cf8]"}`} />
                <span className={`text-xs font-medium ${mode === "aging" ? "text-blue-300" : "text-[#818cf8]"}`}>
                  {MODE_LABELS[mode]}
                </span>
                <span className="text-[11px] text-slate-500 ml-1">{MODE_DESCRIPTIONS[mode]}</span>
              </div>
            )}

            {/* Policy badge */}
            {activePolicy && (() => {
              const p = activePolicy.policy;
              const src = activePolicy.source;
              const badgeStyles =
                src === "file"   ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                src === "user"   ? "bg-[#6366f1]/10 border-[#6366f1]/20 text-[#818cf8]" :
                                   "bg-slate-500/10 border-slate-500/20 text-slate-400";
              const srcLabel =
                src === "file" ? "File Settings" :
                src === "user" ? "User Preferences" :
                                 "System Defaults";
              const cPct = Math.max(0, 100 - p.abc_a_pct - p.abc_b_pct);
              return (
                <div className={`flex items-center gap-3 px-3 py-2 rounded-xl border text-[11px] flex-wrap ${badgeStyles}`}>
                  <span className="font-semibold text-white/70">Analysis Policy</span>
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    {srcLabel}
                  </span>
                  <span className="text-white/40">·</span>
                  <span className="text-white/60">
                    Slow: {p.slow_moving_days}d · Dead: {p.dead_stock_days}d · Critical: {p.critical_coverage_days}d · ABC: {p.abc_a_pct}/{p.abc_b_pct}/{cPct}
                  </span>
                  <Link href="/settings" className="ml-auto flex items-center gap-1 text-[#818cf8] hover:text-white transition-colors flex-shrink-0">
                    <Settings className="w-3 h-3" />
                    Configure
                  </Link>
                </div>
              );
            })()}

            {/* Critical alert banner */}
            {metrics.critical_stockout_count > 0 && mode !== "aging" && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 animate-in">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                <span className="text-xs text-red-300">
                  <strong className="font-medium">{metrics.critical_stockout_count} critical alert{metrics.critical_stockout_count > 1 ? "s" : ""}:</strong>
                  {" "}
                  {metrics.top_risk_items[0]?.product_name} stockout in {Math.floor(metrics.top_risk_items[0]?.days_stock_remaining ?? 0)} days
                </span>
                <Link href="/dashboard/insights" className="ml-auto text-xs text-red-400/70 hover:text-red-300 transition-colors whitespace-nowrap flex-shrink-0">
                  View all →
                </Link>
              </div>
            )}

            {/* Page header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-lg font-bold text-white" style={{ fontFamily: "Syne, sans-serif" }}>
                  Inventory overview
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isDemo ? "Demo Company" : filename.replace(/\.\w+$/, "")} · {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {metrics.total_skus} SKUs
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <TrustBadge variant="compact" />
                <Link
                  href="/dashboard/insights"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#818cf8] border border-[#6366f1]/25 bg-[#6366f1]/8 hover:bg-[#6366f1]/15 hover:text-white transition-colors"
                >
                  <Zap className="w-3.5 h-3.5" />
                  AI Insights
                </Link>
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 border border-white/8 hover:border-white/16 hover:text-white transition-colors">
                  <FileDown className="w-3.5 h-3.5" />
                  Export
                </button>
              </div>
            </div>

            {/* KPI Grid — adapts to analysis mode */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(mode === "aging" ? AGING_KPI_CARDS : KPI_CARDS).map((card, i) => (
                <KPICard
                  key={card.label}
                  label={card.label}
                  value={card.value}
                  icon={card.icon}
                  iconBg={card.iconBg}
                  iconColor={card.iconColor}
                  valueColor={card.valueColor}
                  sub={card.sub}
                  delta={"delta" in card ? (card.delta as string | undefined) : undefined}
                  animDelay={i * 60}
                  kpiKey={card.kpiKey}
                  metrics={metrics}
                />
              ))}
            </div>

            {/* Transparency statement */}
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <p className="text-[11px] text-slate-500 flex-1">
                <span className="text-emerald-400 font-medium">Transparent calculations.</span>
                {" "}All calculations are based on your uploaded data and can be independently verified.
                Hover any KPI card and click{" "}
                <span className="text-[#818cf8] font-semibold">ⓘ</span>
                {" "}to see the formula, fields used, and a worked example.
              </p>
            </div>

            {/* ── Mode A / C: Health analysis charts ─────────────────────── */}
            {mode !== "aging" && (
              <>
                {/* Charts row */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                  <div className="lg:col-span-2 space-y-3">
                    <HealthScoreCard metrics={metrics} />
                    <ScoreBreakdown metrics={metrics} />
                  </div>
                  <div className="lg:col-span-3">
                    <RiskChart metrics={metrics} />
                  </div>
                </div>

                {/* ABC chart */}
                <ABCChart metrics={metrics} />

                {/* Top Risk Table */}
                <TopRiskTable items={metrics.top_risk_items} />

                {/* Reorder Recommendations */}
                <ReorderList metrics={metrics} />
              </>
            )}

            {/* ── Mode B / C: Aging analysis section ─────────────────────── */}
            {(mode === "aging" || mode === "complete") && aging && (
              <AgingDashboard aging={aging} metrics={metrics} />
            )}

            {/* ── Data Completeness Advisor ────────────────────────────────── */}
            {!isDemo && detectedFields.length > 0 && (
              <DataCompletenessAdvisor result={completeness} />
            )}
          </div>
        </main>
      </div>
      <DemoBanner />
      <DemoWelcomeToast />
    </div>
  );
}
