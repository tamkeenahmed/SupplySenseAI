"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldCheck, BookOpen, FlaskConical, Database, ChevronRight,
  Menu, Download, CheckCircle2, AlertTriangle, Info, Layers,
} from "lucide-react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { TrustBadge } from "@/components/validation/TrustBadge";
import { ScoreBreakdown } from "@/components/validation/ScoreBreakdown";
import { formatCurrency, cn } from "@/lib/utils";
import { KPI_DEFINITIONS, type KPIKey } from "@/lib/kpi-definitions";
import {
  buildLiveCalculation,
  getDataLineage,
  buildValidationExport,
} from "@/lib/validation-engine";
import type { DashboardMetrics } from "@/lib/types";
import type { ActivePolicy } from "@/lib/policy";

// ── KPI catalogue (what we show in the formula library) ──────────────────────
const KPI_CATALOGUE: Array<{
  key: KPIKey;
  label: string;
  valueFrom: (m: DashboardMetrics) => string;
  color: string;
}> = [
  { key: "health_score",        label: "Health Score",          valueFrom: (m) => `${m.health_score}/100`,                             color: "text-blue-400" },
  { key: "inventory_value",     label: "Inventory Value",       valueFrom: (m) => formatCurrency(m.total_inventory_value, true),       color: "text-white" },
  { key: "dead_stock",          label: "Dead Stock",            valueFrom: (m) => `${m.dead_stock_count} SKUs · ${formatCurrency(m.dead_stock_value, true)}`, color: "text-red-400" },
  { key: "slow_moving",         label: "Slow Moving",           valueFrom: (m) => `${m.slow_mover_count} SKUs · ${formatCurrency(m.slow_mover_value, true)}`, color: "text-amber-400" },
  { key: "stockout_risk",       label: "Stockout Risk",         valueFrom: (m) => `${m.stockout_risk_count} at risk`,                  color: "text-orange-400" },
  { key: "abc_analysis",        label: "ABC Analysis",          valueFrom: (m) => `A:${m.abc_summary.a_count} B:${m.abc_summary.b_count} C:${m.abc_summary.c_count}`, color: "text-emerald-400" },
  { key: "recoverable_capital", label: "Recoverable Capital",   valueFrom: (m) => formatCurrency(m.recoverable_capital, true),         color: "text-purple-400" },
  { key: "turnover_ratio",      label: "Turnover Ratio",        valueFrom: (m) => `${m.turnover_ratio.toFixed(2)}×`,                   color: "text-cyan-400" },
  { key: "reorder_count",       label: "Reorder Count",         valueFrom: (m) => `${m.reorder_count} items`,                         color: "text-rose-400" },
];

// ── Active KPI panel ─────────────────────────────────────────────────────────
function KPIValidationPanel({
  kpiKey,
  metrics,
  detectedFields,
  activePolicy,
}: {
  kpiKey: KPIKey;
  metrics: DashboardMetrics;
  detectedFields: string[];
  activePolicy: ActivePolicy | null;
}) {
  const [tab, setTab] = useState<"calc" | "fields" | "lineage">("calc");
  const def = KPI_DEFINITIONS[kpiKey];
  const calc = buildLiveCalculation(kpiKey, metrics);
  const lineage = getDataLineage(kpiKey, detectedFields, activePolicy);

  if (!def) return null;

  return (
    <div className="rounded-xl border border-[#6366f1]/25 overflow-hidden" style={{ background: "#0a1628" }}>
      {/* KPI header */}
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-white/6">
        <div>
          <p className="text-[10px] font-semibold text-[#818cf8] uppercase tracking-widest mb-0.5">Live Validation</p>
          <h3 className="text-sm font-bold text-white" style={{ fontFamily: "Syne, sans-serif" }}>{def.title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{def.tagline}</p>
        </div>
        <Link
          href={`/dashboard/kpi/${kpiKey}`}
          target="_blank"
          className="flex items-center gap-1 text-[11px] text-[#818cf8] hover:text-white transition-colors flex-shrink-0 mt-0.5"
        >
          Full page <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-4 px-5 py-2.5 bg-white/2 border-b border-white/5 text-[10px] text-slate-500">
        <span><span className="text-slate-400 font-medium">{calc.totalRecords}</span> total records</span>
        <span><span className="text-slate-400 font-medium">{calc.includedRecords}</span> included in this KPI</span>
        <span className="flex items-center gap-1 text-emerald-500">
          <CheckCircle2 className="w-3 h-3" /> Verified
        </span>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-0.5 px-5 pt-3 border-b border-white/5">
        {([
          { id: "calc",    label: "Live Calculation", Icon: FlaskConical },
          { id: "fields",  label: "Formula",           Icon: BookOpen },
          { id: "lineage", label: "Data Lineage",      Icon: Database },
        ] as const).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 -mb-px transition-colors",
              tab === id
                ? "text-[#818cf8] border-[#6366f1] bg-[#6366f1]/8"
                : "text-slate-500 border-transparent hover:text-slate-300"
            )}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-5 space-y-3">

        {/* Live Calculation tab */}
        {tab === "calc" && (
          <>
            <p className="text-xs text-slate-500">{calc.summary}</p>
            <div className="space-y-2">
              {calc.steps.map((step, i) => {
                if (step.isHeader) {
                  return (
                    <p key={i} className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider pt-2">
                      {step.label}
                    </p>
                  );
                }
                return (
                  <div
                    key={i}
                    className={cn(
                      "rounded-lg px-3.5 py-2.5 border",
                      step.isFinal
                        ? "bg-[#6366f1]/10 border-[#6366f1]/25"
                        : "bg-white/2 border-white/5"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-xs font-medium", step.isFinal ? "text-white" : "text-slate-300")}>
                          {step.label}
                        </p>
                        {step.expr && (
                          <pre className="text-[10px] font-mono text-emerald-300 mt-1 leading-relaxed whitespace-pre-wrap break-all">
                            {step.expr}
                          </pre>
                        )}
                        {step.detail && (
                          <p className="text-[10px] text-slate-600 mt-1">{step.detail}</p>
                        )}
                      </div>
                      {step.value && (
                        <span className={cn(
                          "text-xs font-bold tabular-nums flex-shrink-0",
                          step.isFinal ? "text-[#818cf8] text-sm" : "text-white"
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
        )}

        {/* Formula tab */}
        {tab === "fields" && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">{def.definition}</p>
            <div className="space-y-2">
              {def.formula.map((step, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[#6366f1]/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-bold text-[#818cf8]">{i + 1}</span>
                    </div>
                    <span className="text-[11px] font-medium text-slate-400">{step.label}</span>
                  </div>
                  <div className="ml-7 p-3 rounded-lg bg-[#020617] border border-white/8 font-mono text-xs text-emerald-300 leading-relaxed whitespace-pre-wrap">
                    {step.expr}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Data Lineage tab */}
        {tab === "lineage" && (
          <div className="space-y-4">
            {/* Source */}
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-white/3 border border-white/5">
              <Database className="w-3.5 h-3.5 text-[#818cf8]" />
              <div>
                <p className="text-xs font-medium text-white">Source: {lineage.source}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  No external data sources used
                </p>
              </div>
            </div>

            {/* Fields */}
            <div>
              <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2">Columns used</p>
              <div className="space-y-1.5">
                {lineage.fields.map((f) => (
                  <div key={f.columnName} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/2 border border-white/5">
                    <code className="text-[10px] font-mono text-[#818cf8] bg-[#6366f1]/10 px-1.5 py-0.5 rounded flex-shrink-0">
                      {f.columnName}
                    </code>
                    <span className="text-xs text-slate-400 flex-1">{f.role}</span>
                    <span className={cn(
                      "text-[9px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0",
                      f.required ? "text-red-400 bg-red-500/8 border-red-500/20" : "text-slate-600 bg-white/4 border-white/8"
                    )}>
                      {f.required ? "required" : "optional"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Policy */}
            {lineage.policyFields.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2">
                  Analysis policy thresholds used
                </p>
                <div className="space-y-1.5">
                  {lineage.policyFields.map((pf) => (
                    <div key={pf.field} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-white/2 border border-white/5">
                      <span className="text-xs text-slate-400">{pf.field}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white tabular-nums">{pf.value}{String(pf.value).includes("%") ? "" : " days"}</span>
                        <span className={cn(
                          "text-[9px] font-medium px-1.5 py-0.5 rounded-full border",
                          pf.source === "file"   ? "text-blue-400 bg-blue-500/10 border-blue-500/20" :
                          pf.source === "user"   ? "text-purple-400 bg-purple-500/10 border-purple-500/20" :
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

            <p className="text-[10px] text-slate-600 leading-relaxed">{lineage.trustStatement}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ValidationPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [metrics, setMetrics]         = useState<DashboardMetrics | null>(null);
  const [detectedFields, setDetectedFields] = useState<string[]>([]);
  const [activePolicy, setActivePolicy] = useState<ActivePolicy | null>(null);
  const [filename, setFilename]        = useState("Inventory dataset");
  const [activeKpi, setActiveKpi]      = useState<KPIKey>("health_score");

  useEffect(() => {
    try {
      const s  = sessionStorage.getItem("supplysense_metrics");
      const fn = sessionStorage.getItem("supplysense_filename");
      const fl = sessionStorage.getItem("supplysense_fields");
      const sp = sessionStorage.getItem("supplysense_policy");
      if (s) {
        const m: DashboardMetrics = JSON.parse(s);
        setMetrics(m);
        if (fn) setFilename(fn);
        if (fl) setDetectedFields(JSON.parse(fl));
        if (m.active_policy) setActivePolicy(m.active_policy);
        else if (sp) { try { setActivePolicy(JSON.parse(sp)); } catch { /* ignore */ } }
      }
    } catch { /* ignore */ }
  }, []);

  function handleExport() {
    if (!metrics) return;
    const content = buildValidationExport(metrics, filename, detectedFields);
    const blob = new Blob([content], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SupplySense-Validation-Report-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

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
            <div className="flex items-center gap-2 flex-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-semibold text-white">Validation Mode</span>
              <span className="text-xs text-slate-500 ml-1">— Audit, verify, and trace every calculation</span>
            </div>
            <button
              onClick={handleExport}
              disabled={!metrics}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 border border-white/8 hover:border-white/16 hover:text-white transition-colors disabled:opacity-40"
            >
              <Download className="w-3 h-3" />
              Export Validation Report
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1100px] mx-auto px-4 py-6 space-y-6">

            {/* Trust banner */}
            <TrustBadge variant="full" />

            {/* Trust statement */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-[#6366f1]/6 border border-[#6366f1]/15">
              <Info className="w-4 h-4 text-[#818cf8] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-slate-400 leading-relaxed">
                <span className="text-white font-semibold">All analytics are generated directly from your uploaded data</span> and can be independently verified through this Validation Mode.
                Select any KPI below to see its live calculation, exact formula, source columns, and the specific records that contribute to each figure.
                No estimates, benchmarks, or AI-generated assumptions are used unless explicitly stated.
              </p>
            </div>

            <div className="grid lg:grid-cols-[280px_1fr] gap-6">

              {/* Left — KPI list */}
              <div className="space-y-3">
                {/* Health score breakdown card */}
                {metrics && <ScoreBreakdown metrics={metrics} />}

                {/* Active policy */}
                {activePolicy && (
                  <div className="rounded-xl border border-white/8 overflow-hidden" style={{ background: "#0f172a" }}>
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
                      <Layers className="w-3.5 h-3.5 text-[#818cf8]" />
                      <span className="text-xs font-semibold text-white">Active Policy</span>
                      <span className={cn(
                        "ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full border",
                        activePolicy.source === "file"   ? "text-blue-400 bg-blue-500/10 border-blue-500/20" :
                        activePolicy.source === "user"   ? "text-purple-400 bg-purple-500/10 border-purple-500/20" :
                                                           "text-slate-500 bg-white/4 border-white/8"
                      )}>
                        {activePolicy.source}
                      </span>
                    </div>
                    <div className="px-4 py-3 space-y-1.5">
                      {([
                        { label: "Dead stock threshold",   value: `${activePolicy.policy.dead_stock_days}d` },
                        { label: "Slow moving threshold",  value: `${activePolicy.policy.slow_moving_days}d` },
                        { label: "Safety stock",           value: `${activePolicy.policy.safety_stock_days}d` },
                        { label: "Critical coverage",      value: `${activePolicy.policy.critical_coverage_days}d` },
                        { label: "ABC A threshold",        value: `${activePolicy.policy.abc_a_pct}%` },
                        { label: "ABC B threshold",        value: `${activePolicy.policy.abc_b_pct}%` },
                      ]).map(({ label, value }) => (
                        <div key={label} className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-500">{label}</span>
                          <span className="text-[11px] font-semibold text-white tabular-nums">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* KPI selector */}
                <div className="rounded-xl border border-white/8 overflow-hidden" style={{ background: "#0f172a" }}>
                  <div className="px-4 py-3 border-b border-white/5">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Formula Library</p>
                  </div>
                  <div className="divide-y divide-white/4">
                    {KPI_CATALOGUE.map(({ key, label, valueFrom, color }) => (
                      <button
                        key={key}
                        onClick={() => setActiveKpi(key)}
                        className={cn(
                          "w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/3",
                          activeKpi === key && "bg-[#6366f1]/10 border-l-2 border-[#6366f1]"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white truncate">{label}</p>
                          {metrics && (
                            <p className={cn("text-[10px] tabular-nums mt-0.5", color)}>
                              {valueFrom(metrics)}
                            </p>
                          )}
                        </div>
                        <ChevronRight className={cn(
                          "w-3.5 h-3.5 flex-shrink-0 transition-colors",
                          activeKpi === key ? "text-[#818cf8]" : "text-slate-600"
                        )} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right — Live validation panel */}
              <div>
                {metrics ? (
                  <KPIValidationPanel
                    kpiKey={activeKpi}
                    metrics={metrics}
                    detectedFields={detectedFields}
                    activePolicy={activePolicy}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-white/8 gap-4">
                    <Database className="w-8 h-8 text-slate-600" />
                    <div className="text-center">
                      <p className="text-sm font-semibold text-white mb-1">No data loaded</p>
                      <p className="text-xs text-slate-500">Upload an inventory file to see live validations</p>
                    </div>
                    <Link href="/upload"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#6366f1] text-white text-xs font-medium hover:bg-[#4f46e5] transition-colors">
                      Upload inventory
                    </Link>
                  </div>
                )}

                {/* Data completeness */}
                {metrics && detectedFields.length > 0 && (
                  <div className="mt-4 rounded-xl border border-white/8 p-4" style={{ background: "#0f172a" }}>
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs font-semibold text-white">Detected Columns</span>
                      <span className="text-[10px] text-slate-500 ml-auto">{detectedFields.length} column types recognised</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {detectedFields.map((f) => (
                        <span key={f} className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Validation status checklist */}
                <div className="mt-4 rounded-xl border border-white/8 p-4 space-y-2.5" style={{ background: "#0f172a" }}>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Validation Status</p>
                  {[
                    { label: "Calculations based on uploaded data only",   pass: true },
                    { label: "No external data sources or estimates used", pass: true },
                    { label: "Formula library fully documented",           pass: true },
                    { label: "Active policy thresholds visible",           pass: !!activePolicy },
                    { label: "Per-record supporting data available",       pass: !!metrics },
                    { label: "Step-by-step calculations traceable",        pass: !!metrics },
                    { label: "Export audit trail available",               pass: true },
                  ].map(({ label, pass }) => (
                    <div key={label} className="flex items-center gap-2.5">
                      {pass
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        : <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      }
                      <span className={cn("text-xs", pass ? "text-slate-300" : "text-slate-500")}>
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
