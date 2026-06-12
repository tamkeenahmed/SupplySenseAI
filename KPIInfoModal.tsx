"use client";
import { useState, useEffect, useCallback } from "react";
import { X, BookOpen, Database, FlaskConical, TrendingUp, ShieldCheck, ChevronRight, HelpCircle, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import { KPI_DEFINITIONS, type KPIKey } from "@/lib/kpi-definitions";
import { buildLiveCalculation, getDataLineage } from "@/lib/validation-engine";
import { WhyDrawer } from "@/components/validation/WhyDrawer";
import type { DashboardMetrics } from "@/lib/types";

// ─── Supporting data builder ──────────────────────────────────────────────────

interface SupportRow {
  label: string;
  value: string;
  sub?: string;
  accent?: string; // tailwind colour class e.g. "text-red-400"
}

function buildSupportingData(key: KPIKey, metrics: DashboardMetrics): SupportRow[] {
  switch (key) {
    case "inventory_value": {
      const top = [...metrics.top_risk_items]
        .sort((a, b) => b.inventory_value - a.inventory_value)
        .slice(0, 8);
      return top.map((item) => ({
        label: item.product_name,
        value: formatCurrency(item.inventory_value),
        sub: `${item.sku_id} · ${item.units_on_hand} units @ ${formatCurrency(item.unit_cost)}`,
        accent: "text-white",
      }));
    }
    case "dead_stock": {
      const dead = metrics.top_dead_stock.slice(0, 8);
      return dead.map((item) => ({
        label: item.product_name,
        value: formatCurrency(item.inventory_value),
        sub: `${item.sku_id} · 0 units sold · ${item.units_on_hand} on hand`,
        accent: "text-purple-400",
      }));
    }
    case "slow_moving": {
      const slow = metrics.top_risk_items
        .filter((i) => i.scenario === "SLOW")
        .slice(0, 8);
      return slow.map((item) => ({
        label: item.product_name,
        value: formatCurrency(item.inventory_value),
        sub: `${item.sku_id} · ${item.units_on_hand} units · ${isFinite(item.days_stock_remaining) ? `${Math.round(item.days_stock_remaining)}d stock` : "∞ stock"}`,
        accent: "text-amber-400",
      }));
    }
    case "stockout_risk": {
      const risk = metrics.top_risk_items
        .filter((i) => i.scenario === "CRITICAL" || i.scenario === "WATCH")
        .slice(0, 8);
      return risk.map((item) => ({
        label: item.product_name,
        value: isFinite(item.days_stock_remaining)
          ? `${Math.round(item.days_stock_remaining)}d left`
          : "—",
        sub: `${item.sku_id} · ${item.scenario} · Risk score: ${item.stockout_risk_score}`,
        accent: item.scenario === "CRITICAL" ? "text-red-400" : "text-amber-400",
      }));
    }
    case "reorder_count": {
      return metrics.reorder_recommendations.slice(0, 8).map((rec) => ({
        label: rec.product_name,
        value: `EOQ ${rec.eoq} units`,
        sub: `${rec.sku_id} · ${rec.urgency.replace("_", " ")} · ${isFinite(rec.days_until_stockout) ? `${rec.days_until_stockout}d` : "—"} remaining`,
        accent: rec.urgency === "immediate" ? "text-red-400" : rec.urgency === "this_week" ? "text-amber-400" : "text-blue-400",
      }));
    }
    case "abc_analysis": {
      const { abc_summary: abc, total_skus } = metrics;
      return [
        { label: "A-Class items", value: `${abc.a_count} SKUs (${Math.round((abc.a_count / total_skus) * 100)}%)`, sub: `Drive ${abc.a_revenue_pct}% of total revenue`, accent: "text-emerald-400" },
        { label: "B-Class items", value: `${abc.b_count} SKUs (${Math.round((abc.b_count / total_skus) * 100)}%)`, sub: `Drive ${abc.b_revenue_pct}% of total revenue`, accent: "text-blue-400" },
        { label: "C-Class items", value: `${abc.c_count} SKUs (${Math.round((abc.c_count / total_skus) * 100)}%)`, sub: `Drive ${abc.c_revenue_pct}% of total revenue`, accent: "text-indigo-400" },
        ...[...metrics.top_risk_items]
          .filter((i) => i.abc_class === "A")
          .sort((a, b) => b.inventory_value - a.inventory_value)
          .slice(0, 5)
          .map((item) => ({
            label: item.product_name,
            value: formatCurrency(item.inventory_value),
            sub: `${item.sku_id} · A-class · ${item.scenario}`,
            accent: "text-emerald-400",
          })),
      ];
    }
    case "health_score": {
      const hc = metrics.health_components;
      return [
        { label: "Dead Stock Score (weight 30%)",   value: `${Math.round(hc.dead_stock_score)}/100`,  sub: `Dead stock is ${hc.dead_stock_pct.toFixed(1)}% of portfolio value`,  accent: hc.dead_stock_score >= 80 ? "text-emerald-400" : hc.dead_stock_score >= 60 ? "text-amber-400" : "text-red-400" },
        { label: "Slow Mover Score (weight 25%)",   value: `${Math.round(hc.slow_mover_score)}/100`,  sub: `Slow movers are ${hc.slow_mover_pct.toFixed(1)}% of portfolio value`, accent: hc.slow_mover_score >= 80 ? "text-emerald-400" : hc.slow_mover_score >= 60 ? "text-amber-400" : "text-red-400" },
        { label: "Stockout Score (weight 30%)",     value: `${Math.round(hc.stockout_score)}/100`,    sub: `${hc.stockout_risk_pct.toFixed(1)}% of SKUs at stockout risk`,       accent: hc.stockout_score >= 80 ? "text-emerald-400" : hc.stockout_score >= 60 ? "text-amber-400" : "text-red-400" },
        { label: "ABC Score (weight 15%)",          value: `${Math.round(hc.abc_score)}/100`,         sub: `A-items drive ${hc.a_item_revenue_pct.toFixed(1)}% of revenue`,      accent: hc.abc_score >= 70 ? "text-emerald-400" : hc.abc_score >= 50 ? "text-amber-400" : "text-red-400" },
        {
          label: "Composite Health Score",
          value: `${metrics.health_score}/100`,
          sub: `= Dead×0.30 + Slow×0.25 + Stockout×0.30 + ABC×0.15`,
          accent: metrics.health_score >= 80 ? "text-emerald-400" : metrics.health_score >= 60 ? "text-blue-400" : metrics.health_score >= 40 ? "text-amber-400" : "text-red-400",
        },
      ];
    }
    case "ageing_score": {
      const aging = metrics.aging_metrics;
      if (!aging) return [{ label: "No ageing data", value: "—", sub: "Upload an ageing report to see this breakdown" }];
      return [
        ...aging.buckets.map((b) => ({
          label: b.label,
          value: `${b.count} items (${b.pct_value.toFixed(1)}% of value)`,
          sub: `${formatCurrency(b.value)} · weight: ${b.min_days <= 30 ? 100 : b.min_days <= 60 ? 80 : b.min_days <= 90 ? 60 : b.min_days <= 180 ? 30 : 0}`,
          accent: b.min_days <= 30 ? "text-emerald-400" : b.min_days <= 60 ? "text-blue-400" : b.min_days <= 90 ? "text-amber-400" : "text-red-400",
        })),
        {
          label: "Ageing Health Score",
          value: `${aging.ageing_health_score}/100`,
          sub: "Weighted composite — higher is fresher",
          accent: aging.ageing_health_score >= 80 ? "text-emerald-400" : aging.ageing_health_score >= 60 ? "text-amber-400" : "text-red-400",
        },
      ];
    }
    case "recoverable_capital":
    case "blocked_capital": {
      const deadRows = metrics.top_dead_stock.slice(0, 4).map((item) => ({
        label: item.product_name,
        value: formatCurrency(item.inventory_value),
        sub: `${item.sku_id} · Dead stock`,
        accent: "text-purple-400",
      }));
      const slowRows = metrics.top_risk_items
        .filter((i) => i.scenario === "SLOW")
        .slice(0, 4)
        .map((item) => ({
          label: item.product_name,
          value: formatCurrency(item.inventory_value),
          sub: `${item.sku_id} · Slow mover`,
          accent: "text-amber-400",
        }));
      return [...deadRows, ...slowRows];
    }
    case "turnover_ratio": {
      const sorted = [...metrics.top_risk_items]
        .sort((a, b) => b.inventory_value - a.inventory_value)
        .slice(0, 8);
      return sorted.map((item) => ({
        label: item.product_name,
        value: `${(item.daily_velocity * 365 / Math.max(item.inventory_value, 1)).toFixed(1)}× turnover`,
        sub: `${item.sku_id} · ${formatCurrency(item.inventory_value)} value · ${item.scenario}`,
        accent: "text-blue-400",
      }));
    }
    case "avg_ageing_days": {
      const aging = metrics.aging_metrics;
      if (!aging) return [{ label: "No ageing data", value: "—", sub: "Upload an ageing report" }];
      return aging.liquidation_opportunities.slice(0, 8).map((item) => ({
        label: item.item_name,
        value: `${item.ageing_days}d old`,
        sub: `${item.item_code} · ${formatCurrency(item.inventory_value)} · ${item.bucket_label}`,
        accent: item.ageing_days > 180 ? "text-red-400" : item.ageing_days > 90 ? "text-amber-400" : "text-blue-400",
      }));
    }
    default:
      return [];
  }
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = "definition" | "formula" | "example" | "data" | "livecalc" | "lineage";

const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: "definition", label: "Definition",      Icon: BookOpen      },
  { id: "formula",    label: "Formula",          Icon: FlaskConical  },
  { id: "livecalc",  label: "Live Calc",         Icon: Activity      },
  { id: "data",       label: "Supporting Data",  Icon: Database      },
  { id: "lineage",    label: "Data Lineage",     Icon: ShieldCheck   },
];

// ─── Modal ────────────────────────────────────────────────────────────────────

interface KPIInfoModalProps {
  kpiKey: KPIKey;
  metrics: DashboardMetrics;
  onClose: () => void;
}

export function KPIInfoModal({ kpiKey, metrics, onClose }: KPIInfoModalProps) {
  const [tab, setTab] = useState<Tab>("definition");
  const [whyOpen, setWhyOpen] = useState(false);
  const def = KPI_DEFINITIONS[kpiKey];
  const supportRows = buildSupportingData(kpiKey, metrics);
  const liveCalc = buildLiveCalculation(kpiKey, metrics);
  const lineage = getDataLineage(kpiKey, [], metrics.active_policy);

  // Close on Escape
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  if (!def) return null;

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panel */}
      <div
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-white/10 overflow-hidden"
        style={{ background: "#0f172a", boxShadow: "0 25px 80px rgba(0,0,0,0.7)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-white/6 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-semibold text-[#818cf8] uppercase tracking-widest">KPI Explainability</span>
            </div>
            <h2 className="text-base font-bold text-white leading-tight" style={{ fontFamily: "Syne, sans-serif" }}>
              {def.title}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{def.tagline}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setWhyOpen(true)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-slate-400 hover:text-white hover:bg-white/8 border border-white/8 transition-colors"
              title="Why am I seeing this? Plain-English explanation"
            >
              <HelpCircle className="w-3 h-3" />
              Why?
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/8 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-0.5 px-6 pt-3 flex-shrink-0 border-b border-white/5">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-medium transition-colors border-b-2 -mb-px",
                tab === id
                  ? "text-[#818cf8] border-[#6366f1] bg-[#6366f1]/8"
                  : "text-slate-500 border-transparent hover:text-slate-300 hover:bg-white/4"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {id === "data" && supportRows.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] bg-[#6366f1]/20 text-[#818cf8] font-semibold">
                  {supportRows.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* ── Definition tab ── */}
          {tab === "definition" && (
            <>
              <p className="text-sm text-slate-300 leading-relaxed">{def.definition}</p>

              {/* Fields used */}
              <div>
                <p className="text-xs font-semibold text-white mb-2.5 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-[#818cf8]" />
                  Data fields used
                </p>
                <div className="space-y-1.5">
                  {def.fields.map((f) => (
                    <div key={f.name} className="flex items-start gap-3 p-2.5 rounded-lg bg-white/3 border border-white/5">
                      <code className="text-[11px] font-mono text-[#818cf8] bg-[#6366f1]/10 px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5">
                        {f.name}
                      </code>
                      <span className="text-xs text-slate-400 flex-1">{f.description}</span>
                      <span className={cn(
                        "text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0",
                        f.required
                          ? "bg-red-500/10 text-red-400 border border-red-500/20"
                          : "bg-slate-500/10 text-slate-500 border border-slate-600/20"
                      )}>
                        {f.required ? "required" : "optional"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Linked KPIs */}
              {def.linkedKPIs && def.linkedKPIs.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-white mb-2">Related KPIs</p>
                  <div className="flex flex-wrap gap-1.5">
                    {def.linkedKPIs.map((k) => (
                      <span key={k} className="text-[11px] text-[#818cf8] bg-[#6366f1]/8 border border-[#6366f1]/20 px-2 py-0.5 rounded-full">
                        {KPI_DEFINITIONS[k]?.title ?? k}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Formula tab ── */}
          {tab === "formula" && (
            <div className="space-y-3">
              {def.formula.map((step, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[#6366f1]/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-bold text-[#818cf8]">{i + 1}</span>
                    </div>
                    <span className="text-[11px] font-medium text-slate-400">{step.label}</span>
                  </div>
                  <div className="ml-7 p-3 rounded-lg bg-[#020617] border border-white/8 font-mono text-xs text-emerald-300 leading-relaxed whitespace-pre-wrap">
                    {step.expr}
                  </div>
                </div>
              ))}

              {/* Interpretation guide */}
              <div className="mt-2 space-y-2">
                <p className="text-xs font-semibold text-white pt-2 pb-1 border-t border-white/5">Business interpretation</p>
                {[
                  { status: "Good",     text: def.interpretation.good,     color: "text-emerald-400", bg: "bg-emerald-500/8 border-emerald-500/15" },
                  { status: "Warning",  text: def.interpretation.warning,  color: "text-amber-400",   bg: "bg-amber-500/8 border-amber-500/15"   },
                  { status: "Critical", text: def.interpretation.critical,  color: "text-red-400",     bg: "bg-red-500/8 border-red-500/15"       },
                ].map(({ status, text, color, bg }) => (
                  <div key={status} className={cn("flex items-start gap-2.5 p-2.5 rounded-lg border", bg)}>
                    <span className={cn("text-[10px] font-bold uppercase tracking-wide flex-shrink-0 mt-0.5", color)}>{status}</span>
                    <p className="text-xs text-slate-400 leading-relaxed">{text}</p>
                  </div>
                ))}
                <div className="flex items-start gap-2.5 p-2.5 rounded-lg border bg-[#6366f1]/6 border-[#6366f1]/15">
                  <span className="text-[10px] font-bold text-[#818cf8] uppercase tracking-wide flex-shrink-0 mt-0.5">Tip</span>
                  <p className="text-xs text-slate-400 leading-relaxed">{def.interpretation.tip}</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Example tab ── */}
          {tab === "example" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-white/3 border border-white/6">
                <FlaskConical className="w-3.5 h-3.5 text-[#818cf8] flex-shrink-0" />
                <p className="text-xs text-slate-400">{def.example.context}</p>
              </div>

              <div className="space-y-2">
                {def.example.steps.map((step, i) => (
                  <div key={i} className="flex items-center justify-between gap-4 py-2.5 border-b border-white/4">
                    <span className="text-xs text-slate-400 flex-1">{step.label}</span>
                    <span className="text-xs font-semibold text-white tabular-nums flex-shrink-0">{step.value}</span>
                  </div>
                ))}
              </div>

              {/* Result callout */}
              <div className="p-4 rounded-xl bg-[#6366f1]/10 border border-[#6366f1]/20">
                <p className="text-[10px] font-semibold text-[#818cf8] uppercase tracking-wider mb-1">Result</p>
                <p className="text-sm font-bold text-white">{def.example.result}</p>
                {def.example.note && (
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">{def.example.note}</p>
                )}
              </div>
            </div>
          )}

          {/* ── Live Calculation tab ── */}
          {tab === "livecalc" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">{liveCalc.summary}</p>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  {liveCalc.includedRecords} / {liveCalc.totalRecords} records
                </span>
              </div>
              <div className="space-y-2">
                {liveCalc.steps.map((step, i) => {
                  if (step.isHeader) {
                    return (
                      <p key={i} className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider pt-1">
                        {step.label}
                      </p>
                    );
                  }
                  return (
                    <div key={i} className={cn(
                      "rounded-lg px-3 py-2.5 border",
                      step.isFinal ? "bg-[#6366f1]/10 border-[#6366f1]/25" : "bg-white/2 border-white/5"
                    )}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-xs font-medium", step.isFinal ? "text-white" : "text-slate-300")}>{step.label}</p>
                          {step.expr && (
                            <pre className="text-[10px] font-mono text-emerald-300 mt-1 leading-relaxed whitespace-pre-wrap">{step.expr}</pre>
                          )}
                          {step.detail && <p className="text-[10px] text-slate-600 mt-0.5">{step.detail}</p>}
                        </div>
                        {step.value && (
                          <span className={cn("text-xs font-bold tabular-nums flex-shrink-0", step.isFinal ? "text-[#818cf8]" : "text-white")}>
                            {step.value}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Data Lineage tab ── */}
          {tab === "lineage" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 p-3 rounded-lg bg-white/3 border border-white/5">
                <Database className="w-3.5 h-3.5 text-[#818cf8]" />
                <div>
                  <p className="text-xs font-medium text-white">Source: {lineage.source}</p>
                  <p className="text-[10px] text-slate-500">No external data sources used</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2">Columns required</p>
                <div className="space-y-1.5">
                  {lineage.fields.map((f) => (
                    <div key={f.columnName} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/2 border border-white/5">
                      <code className="text-[10px] font-mono text-[#818cf8] bg-[#6366f1]/10 px-1.5 py-0.5 rounded flex-shrink-0">{f.columnName}</code>
                      <span className="text-xs text-slate-400 flex-1">{f.role}</span>
                      <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0",
                        f.required ? "text-red-400 bg-red-500/8 border-red-500/20" : "text-slate-600 bg-white/4 border-white/8"
                      )}>
                        {f.required ? "required" : "optional"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {lineage.policyFields.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2">Policy thresholds applied</p>
                  <div className="space-y-1.5">
                    {lineage.policyFields.map((pf) => (
                      <div key={pf.field} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white/2 border border-white/5">
                        <span className="text-xs text-slate-400">{pf.field}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-white tabular-nums">{pf.value}</span>
                          <span className={cn("text-[9px] font-medium px-1.5 py-0.5 rounded-full border",
                            pf.source === "file" ? "text-blue-400 bg-blue-500/10 border-blue-500/20" :
                            pf.source === "user" ? "text-purple-400 bg-purple-500/10 border-purple-500/20" :
                                                   "text-slate-500 bg-white/4 border-white/8"
                          )}>
                            {pf.source}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[10px] text-slate-600">{lineage.trustStatement}</p>
            </div>
          )}

          {/* ── Supporting Data tab ── */}
          {tab === "data" && (
            <div className="space-y-3">
              {supportRows.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-500">
                  No supporting data available for this KPI.
                </div>
              ) : (
                <>
                  <p className="text-xs text-slate-500">
                    Records from your uploaded dataset contributing to this KPI. All figures are derived directly from the uploaded file — no estimates.
                  </p>
                  <div className="divide-y divide-white/4 rounded-xl border border-white/6 overflow-hidden">
                    {supportRows.map((row, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/2 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white truncate">{row.label}</p>
                          {row.sub && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{row.sub}</p>}
                        </div>
                        <span className={cn("text-xs font-bold tabular-nums flex-shrink-0", row.accent ?? "text-white")}>
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer — transparency statement */}
        <div className="flex-shrink-0 border-t border-white/5 px-6 py-3 flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <p className="text-[11px] text-slate-500 leading-snug">
            All calculations are based on your uploaded data and can be independently verified.{" "}
            <a href="/dashboard/validation" className="text-[#818cf8] hover:text-white transition-colors underline underline-offset-2">
              Validation dashboard →
            </a>
          </p>
        </div>
      </div>

      {/* Why? drawer — rendered outside the modal */}
      {whyOpen && (
        <WhyDrawer kpiKey={kpiKey} metrics={metrics} onClose={() => setWhyOpen(false)} />
      )}
    </div>
  );
}

// ─── Inline ⓘ trigger button — opens dedicated window ───────────────────────

interface KPIInfoTriggerProps {
  kpiKey: KPIKey;
  metrics: DashboardMetrics; // kept for API compatibility (no longer needed here)
}

export function KPIInfoTrigger({ kpiKey }: KPIInfoTriggerProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(
      `/dashboard/kpi/${kpiKey}`,
      `kpi_${kpiKey}`,
      "width=900,height=750,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no"
    );
  };

  return (
    <button
      onClick={handleClick}
      aria-label={`Explain ${KPI_DEFINITIONS[kpiKey]?.title ?? kpiKey}`}
      title="How is this calculated? (opens in new window)"
      className="w-5 h-5 rounded-full text-[11px] font-bold text-[#818cf8] bg-[#6366f1]/15 border border-[#6366f1]/30 hover:bg-[#6366f1]/30 hover:border-[#6366f1]/60 hover:text-white transition-all duration-150 flex items-center justify-center leading-none flex-shrink-0 cursor-pointer"
    >
      ⓘ
    </button>
  );
}
