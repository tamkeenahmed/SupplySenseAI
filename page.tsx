"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  BookOpen, Database, FlaskConical, TrendingUp, ShieldCheck,
  X, CheckCircle2, AlertCircle, AlertTriangle, Lightbulb,
  Activity, HelpCircle,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import { KPI_DEFINITIONS, type KPIKey } from "@/lib/kpi-definitions";
import { buildLiveCalculation, getDataLineage } from "@/lib/validation-engine";
import { WhyDrawer } from "@/components/validation/WhyDrawer";
import type { DashboardMetrics } from "@/lib/types";

// ─── Supporting data builder (same logic as modal) ────────────────────────────
interface SupportRow {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}

function buildSupportingData(key: KPIKey, metrics: DashboardMetrics): SupportRow[] {
  switch (key) {
    case "inventory_value": {
      return [...metrics.top_risk_items]
        .sort((a, b) => b.inventory_value - a.inventory_value)
        .slice(0, 15)
        .map((item) => ({
          label: item.product_name,
          value: formatCurrency(item.inventory_value),
          sub: `${item.sku_id} · ${item.units_on_hand} units @ ${formatCurrency(item.unit_cost)}`,
          accent: "text-white",
        }));
    }
    case "dead_stock": {
      return metrics.top_dead_stock.slice(0, 15).map((item) => ({
        label: item.product_name,
        value: formatCurrency(item.inventory_value),
        sub: `${item.sku_id} · 0 units sold · ${item.units_on_hand} on hand`,
        accent: "text-purple-400",
      }));
    }
    case "slow_moving": {
      return metrics.top_risk_items
        .filter((i) => i.scenario === "SLOW")
        .slice(0, 15)
        .map((item) => ({
          label: item.product_name,
          value: formatCurrency(item.inventory_value),
          sub: `${item.sku_id} · ${item.units_on_hand} units · ${isFinite(item.days_stock_remaining) ? `${Math.round(item.days_stock_remaining)}d stock` : "∞ stock"}`,
          accent: "text-amber-400",
        }));
    }
    case "stockout_risk": {
      return metrics.top_risk_items
        .filter((i) => i.scenario === "CRITICAL" || i.scenario === "WATCH")
        .slice(0, 15)
        .map((item) => ({
          label: item.product_name,
          value: isFinite(item.days_stock_remaining) ? `${Math.round(item.days_stock_remaining)}d left` : "—",
          sub: `${item.sku_id} · ${item.scenario} · Risk score: ${item.stockout_risk_score}`,
          accent: item.scenario === "CRITICAL" ? "text-red-400" : "text-amber-400",
        }));
    }
    case "reorder_count": {
      return metrics.reorder_recommendations.slice(0, 15).map((rec) => ({
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
          .slice(0, 10)
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
        { label: "Dead Stock Score (weight 30%)",  value: `${Math.round(hc.dead_stock_score)}/100`,  sub: `Dead stock is ${hc.dead_stock_pct.toFixed(1)}% of portfolio`,   accent: hc.dead_stock_score  >= 80 ? "text-emerald-400" : hc.dead_stock_score  >= 60 ? "text-amber-400" : "text-red-400" },
        { label: "Slow Mover Score (weight 25%)",  value: `${Math.round(hc.slow_mover_score)}/100`,  sub: `Slow movers are ${hc.slow_mover_pct.toFixed(1)}% of portfolio`,  accent: hc.slow_mover_score  >= 80 ? "text-emerald-400" : hc.slow_mover_score  >= 60 ? "text-amber-400" : "text-red-400" },
        { label: "Stockout Score (weight 30%)",    value: `${Math.round(hc.stockout_score)}/100`,    sub: `${hc.stockout_risk_pct.toFixed(1)}% of SKUs at stockout risk`,   accent: hc.stockout_score    >= 80 ? "text-emerald-400" : hc.stockout_score    >= 60 ? "text-amber-400" : "text-red-400" },
        { label: "ABC Score (weight 15%)",         value: `${Math.round(hc.abc_score)}/100`,         sub: `A-items drive ${hc.a_item_revenue_pct.toFixed(1)}% of revenue`,  accent: hc.abc_score         >= 70 ? "text-emerald-400" : hc.abc_score         >= 50 ? "text-amber-400" : "text-red-400" },
        { label: "Composite Health Score",         value: `${metrics.health_score}/100`,              sub: "= Dead×0.30 + Slow×0.25 + Stockout×0.30 + ABC×0.15",            accent: metrics.health_score >= 80 ? "text-emerald-400" : metrics.health_score >= 60 ? "text-blue-400"   : metrics.health_score >= 40 ? "text-amber-400" : "text-red-400" },
      ];
    }
    case "ageing_score": {
      const aging = metrics.aging_metrics;
      if (!aging) return [{ label: "No ageing data available", value: "—", sub: "Upload an ageing report to see this breakdown" }];
      return [
        ...aging.buckets.map((b) => ({
          label: b.label,
          value: `${b.count} items (${b.pct_value.toFixed(1)}% of value)`,
          sub: `${formatCurrency(b.value)} · bucket weight: ${b.min_days <= 30 ? 100 : b.min_days <= 60 ? 80 : b.min_days <= 90 ? 60 : b.min_days <= 180 ? 30 : 0}`,
          accent: b.min_days <= 30 ? "text-emerald-400" : b.min_days <= 60 ? "text-blue-400" : b.min_days <= 90 ? "text-amber-400" : "text-red-400",
        })),
        { label: "Ageing Health Score", value: `${aging.ageing_health_score}/100`, sub: "Weighted composite — higher = fresher inventory", accent: aging.ageing_health_score >= 80 ? "text-emerald-400" : "text-amber-400" },
      ];
    }
    case "recoverable_capital":
    case "blocked_capital": {
      return [
        ...metrics.top_dead_stock.slice(0, 8).map((item) => ({
          label: item.product_name, value: formatCurrency(item.inventory_value),
          sub: `${item.sku_id} · Dead stock`, accent: "text-purple-400",
        })),
        ...metrics.top_risk_items.filter((i) => i.scenario === "SLOW").slice(0, 7).map((item) => ({
          label: item.product_name, value: formatCurrency(item.inventory_value),
          sub: `${item.sku_id} · Slow mover`, accent: "text-amber-400",
        })),
      ];
    }
    case "turnover_ratio": {
      return [...metrics.top_risk_items]
        .sort((a, b) => b.inventory_value - a.inventory_value)
        .slice(0, 15)
        .map((item) => ({
          label: item.product_name,
          value: `${(item.daily_velocity * 365 / Math.max(item.inventory_value, 1)).toFixed(1)}× turnover`,
          sub: `${item.sku_id} · ${formatCurrency(item.inventory_value)} value · ${item.scenario}`,
          accent: "text-blue-400",
        }));
    }
    case "avg_ageing_days": {
      const aging = metrics.aging_metrics;
      if (!aging) return [{ label: "No ageing data", value: "—", sub: "Upload an ageing report" }];
      return aging.liquidation_opportunities.slice(0, 15).map((item) => ({
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

// ─── Page ─────────────────────────────────────────────────────────────────────
type Tab = "definition" | "formula" | "livecalc" | "data" | "lineage";

const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: "definition", label: "Definition",     Icon: BookOpen     },
  { id: "formula",    label: "Formula",         Icon: FlaskConical },
  { id: "livecalc",   label: "Live Calc",       Icon: Activity     },
  { id: "data",       label: "Supporting Data", Icon: Database     },
  { id: "lineage",    label: "Data Lineage",    Icon: ShieldCheck  },
];

export default function KPIDetailPage() {
  const params = useParams();
  const kpiKey = params.key as KPIKey;
  const def = KPI_DEFINITIONS[kpiKey];

  const [tab, setTab] = useState<Tab>("definition");
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [detectedFields, setDetectedFields] = useState<string[]>([]);
  const [whyOpen, setWhyOpen] = useState(false);

  useEffect(() => {
    try {
      const s  = sessionStorage.getItem("supplysense_metrics");
      const fl = sessionStorage.getItem("supplysense_fields");
      if (s) setMetrics(JSON.parse(s));
      if (fl) setDetectedFields(JSON.parse(fl));
    } catch { /* ignore */ }
  }, []);

  if (!def) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-sm text-white font-semibold">Unknown KPI key: {String(kpiKey)}</p>
          <button onClick={() => window.close()} className="text-xs text-[#818cf8] hover:text-white underline">Close window</button>
        </div>
      </div>
    );
  }

  const supportRows = metrics ? buildSupportingData(kpiKey, metrics) : [];

  return (
    <>
    <div className="min-h-screen bg-[#020617] text-slate-300">

      {/* ── Header ── */}
      <header className="sticky top-0 z-30 border-b border-white/6" style={{ background: "rgba(2,6,23,0.92)", backdropFilter: "blur(12px)" }}>
        <div className="max-w-4xl mx-auto px-5 h-[52px] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* accent dot */}
            <div className="w-2 h-2 rounded-full bg-[#6366f1] flex-shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] font-semibold text-[#818cf8] uppercase tracking-widest">KPI Explainability</span>
              <h1 className="text-sm font-bold text-white leading-tight truncate" style={{ fontFamily: "Syne, sans-serif" }}>
                {def.title}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {metrics && (
              <button
                onClick={() => setWhyOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/8 border border-white/8 hover:border-white/16 transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Why am I seeing this?
              </button>
            )}
            <button
              onClick={() => window.close()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/8 border border-white/8 hover:border-white/16 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Close
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-5 py-8 space-y-8">

        {/* ── Hero ── */}
        <div className="rounded-2xl border border-white/8 p-6 space-y-1" style={{ background: "#0f172a" }}>
          <p className="text-xs font-semibold text-[#818cf8] uppercase tracking-widest">{def.title}</p>
          <p className="text-2xl font-bold text-white leading-snug" style={{ fontFamily: "Syne, sans-serif" }}>{def.tagline}</p>
        </div>

        {/* ── Tab bar ── */}
        <div className="flex items-center gap-1 border-b border-white/6 pb-0">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium rounded-t-lg border-b-2 -mb-px transition-colors",
                tab === id
                  ? "text-[#818cf8] border-[#6366f1] bg-[#6366f1]/8"
                  : "text-slate-500 border-transparent hover:text-slate-300 hover:bg-white/4"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {id === "data" && supportRows.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] bg-[#6366f1]/20 text-[#818cf8] font-bold">
                  {supportRows.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab: Definition ── */}
        {tab === "definition" && (
          <div className="space-y-6">
            <p className="text-sm text-slate-300 leading-relaxed">{def.definition}</p>

            {/* Fields */}
            <div>
              <h2 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-[#818cf8]" /> Data fields used
              </h2>
              <div className="rounded-xl border border-white/6 overflow-hidden">
                {def.fields.map((f, i) => (
                  <div key={f.name} className={cn("flex items-start gap-4 px-4 py-3", i < def.fields.length - 1 ? "border-b border-white/5" : "")}>
                    <code className="text-[11px] font-mono text-[#818cf8] bg-[#6366f1]/10 border border-[#6366f1]/20 px-2 py-0.5 rounded flex-shrink-0 mt-0.5">
                      {f.name}
                    </code>
                    <span className="text-sm text-slate-400 flex-1">{f.description}</span>
                    <span className={cn(
                      "text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 border",
                      f.required
                        ? "bg-red-500/10 text-red-400 border-red-500/20"
                        : "bg-slate-700/40 text-slate-500 border-slate-600/20"
                    )}>
                      {f.required ? "required" : "optional"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Related KPIs */}
            {def.linkedKPIs && def.linkedKPIs.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-white mb-3">Related KPIs</h2>
                <div className="flex flex-wrap gap-2">
                  {def.linkedKPIs.map((k) => (
                    <button
                      key={k}
                      onClick={() => { window.location.href = `/dashboard/kpi/${k}`; }}
                      className="text-xs text-[#818cf8] bg-[#6366f1]/8 border border-[#6366f1]/20 hover:bg-[#6366f1]/20 px-3 py-1 rounded-full transition-colors"
                    >
                      {KPI_DEFINITIONS[k]?.title ?? k} →
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Formula ── */}
        {tab === "formula" && (
          <div className="space-y-6">
            {/* Steps */}
            <div className="space-y-4">
              {def.formula.map((step, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#6366f1]/20 border border-[#6366f1]/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-bold text-[#818cf8]">{i + 1}</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-300">{step.label}</span>
                  </div>
                  <div className="ml-8 p-4 rounded-xl bg-[#020617] border border-white/8 font-mono text-sm text-emerald-300 leading-relaxed">
                    {step.expr}
                  </div>
                </div>
              ))}
            </div>

            {/* Interpretation */}
            <div>
              <h2 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-[#818cf8]" /> Business interpretation
              </h2>
              <div className="space-y-2">
                {[
                  { status: "Good",     text: def.interpretation.good,     Icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/6 border-emerald-500/15" },
                  { status: "Warning",  text: def.interpretation.warning,  Icon: AlertTriangle, color: "text-amber-400",  bg: "bg-amber-500/6 border-amber-500/15"    },
                  { status: "Critical", text: def.interpretation.critical,  Icon: AlertCircle,  color: "text-red-400",    bg: "bg-red-500/6 border-red-500/15"         },
                ].map(({ status, text, Icon: SIcon, color, bg }) => (
                  <div key={status} className={cn("flex items-start gap-3 p-3.5 rounded-xl border", bg)}>
                    <SIcon className={cn("w-4 h-4 flex-shrink-0 mt-0.5", color)} />
                    <div>
                      <span className={cn("text-[11px] font-bold uppercase tracking-wide", color)}>{status} — </span>
                      <span className="text-sm text-slate-400">{text}</span>
                    </div>
                  </div>
                ))}
                <div className="flex items-start gap-3 p-3.5 rounded-xl border bg-[#6366f1]/6 border-[#6366f1]/15">
                  <Lightbulb className="w-4 h-4 text-[#818cf8] flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[11px] font-bold text-[#818cf8] uppercase tracking-wide">Tip — </span>
                    <span className="text-sm text-slate-400">{def.interpretation.tip}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Live Calculation ── */}
        {tab === "livecalc" && (
          <div className="space-y-4">
            {!metrics ? (
              <div className="py-16 text-center space-y-2">
                <Activity className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-sm text-slate-500">No session data found.</p>
                <p className="text-xs text-slate-600">Open this page from the dashboard after uploading an inventory file.</p>
              </div>
            ) : (() => {
              const lc = buildLiveCalculation(kpiKey, metrics);
              return (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">{lc.summary}</p>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      {lc.includedRecords} / {lc.totalRecords} records
                    </span>
                  </div>
                  <div className="space-y-2">
                    {lc.steps.map((step, i) => {
                      if (step.isHeader) {
                        return (
                          <p key={i} className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider pt-2">{step.label}</p>
                        );
                      }
                      return (
                        <div key={i} className={cn(
                          "rounded-xl border px-4 py-3",
                          step.isFinal ? "bg-[#6366f1]/10 border-[#6366f1]/25" : "bg-white/2 border-white/5"
                        )}>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <p className={cn("text-sm font-medium", step.isFinal ? "text-white" : "text-slate-300")}>{step.label}</p>
                              {step.expr && (
                                <pre className="text-xs font-mono text-emerald-300 mt-1.5 leading-relaxed whitespace-pre-wrap">{step.expr}</pre>
                              )}
                              {step.detail && <p className="text-xs text-slate-600 mt-1">{step.detail}</p>}
                            </div>
                            {step.value && (
                              <span className={cn(
                                "font-bold tabular-nums flex-shrink-0",
                                step.isFinal ? "text-[#818cf8] text-lg" : "text-sm text-white"
                              )}>
                                {step.value}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* ── Tab: Data Lineage ── */}
        {tab === "lineage" && (() => {
          const lineage = getDataLineage(kpiKey, detectedFields, metrics?.active_policy);
          return (
            <div className="space-y-5">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <p className="text-sm text-slate-400 leading-relaxed">{lineage.trustStatement}</p>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-xl bg-white/3 border border-white/6">
                <CheckCircle2 className="w-4 h-4 text-[#818cf8] flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-white">Source: {lineage.source}</p>
                  <p className="text-xs text-slate-500 mt-0.5">No external data sources or estimates used</p>
                </div>
              </div>

              <div>
                <h2 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
                  <Database className="w-3.5 h-3.5 text-[#818cf8]" /> Columns used for this KPI
                </h2>
                <div className="rounded-xl border border-white/6 overflow-hidden">
                  {lineage.fields.map((f, i) => (
                    <div key={f.columnName} className={cn("flex items-center gap-4 px-4 py-3", i < lineage.fields.length - 1 ? "border-b border-white/5" : "")}>
                      <code className="text-[11px] font-mono text-[#818cf8] bg-[#6366f1]/10 border border-[#6366f1]/20 px-2 py-0.5 rounded flex-shrink-0">{f.columnName}</code>
                      <span className="text-sm text-slate-400 flex-1">{f.role}</span>
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0",
                        f.required ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-slate-700/40 text-slate-500 border-slate-600/20"
                      )}>
                        {f.required ? "required" : "optional"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {lineage.policyFields.length > 0 && (
                <div>
                  <h2 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Analysis policy thresholds applied
                  </h2>
                  <div className="rounded-xl border border-white/6 overflow-hidden">
                    {lineage.policyFields.map((pf, i) => (
                      <div key={pf.field} className={cn("flex items-center justify-between gap-4 px-4 py-3", i < lineage.policyFields.length - 1 ? "border-b border-white/5" : "")}>
                        <span className="text-sm text-slate-400">{pf.field}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-white tabular-nums">{pf.value}</span>
                          <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border",
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
            </div>
          );
        })()}

        {/* ── Tab: Supporting Data ── */}
        {tab === "data" && (
          <div className="space-y-4">
            {!metrics ? (
              <div className="py-16 text-center space-y-2">
                <Database className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-sm text-slate-500">No session data found.</p>
                <p className="text-xs text-slate-600">Open this page from the dashboard after uploading an inventory file.</p>
              </div>
            ) : supportRows.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm text-slate-500">No supporting records for this KPI.</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-500">
                  Records from your uploaded dataset that contribute to this KPI.
                  All figures are derived directly from the uploaded file — no estimates or assumptions.
                </p>
                <div className="rounded-xl border border-white/6 overflow-hidden">
                  <div className="px-5 py-2.5 border-b border-white/5 bg-white/2">
                    <div className="flex items-center justify-between text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                      <span>Item</span>
                      <span>Value</span>
                    </div>
                  </div>
                  {supportRows.map((row, i) => (
                    <div key={i} className={cn("flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-white/2 transition-colors", i < supportRows.length - 1 ? "border-b border-white/4" : "")}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{row.label}</p>
                        {row.sub && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{row.sub}</p>}
                      </div>
                      <span className={cn("text-sm font-bold tabular-nums flex-shrink-0", row.accent ?? "text-white")}>
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Transparency footer ── */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
          <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-slate-500 leading-relaxed">
            <span className="text-emerald-400 font-semibold">All calculations are based on your uploaded data and can be independently verified.</span>
            {" "}No external benchmarks, estimates, or third-party data are used in these computations unless explicitly stated.
            Visit the{" "}
            <Link href="/dashboard/validation" className="text-[#818cf8] hover:text-white underline underline-offset-2">
              Validation Dashboard
            </Link>{" "}for a full audit view.
          </p>
        </div>

      </div>
    </div>
    {/* Why? drawer */}
    {whyOpen && metrics && (
      <WhyDrawer kpiKey={kpiKey} metrics={metrics} onClose={() => setWhyOpen(false)} />
    )}
    </>
  );
}
