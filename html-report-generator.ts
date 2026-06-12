"use client";
/**
 * HTML Report Generator — Phase 11
 *
 * Generates a fully self-contained HTML document from DashboardMetrics
 * and ExecutiveSummary. Opened in a new window → user prints/saves as PDF.
 * Zero external dependencies — all styles are inline.
 */

import type { DashboardMetrics } from "./types";
import type { ExecutiveSummary } from "./insights-generator";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, compact = false): string {
  if (!isFinite(n)) return "—";
  if (compact) {
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
  }
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function severityColor(s: string): string {
  const map: Record<string, string> = {
    critical: "#ef4444",
    high:     "#f97316",
    medium:   "#f59e0b",
    low:      "#3b82f6",
  };
  return map[s] ?? "#6b7280";
}

function severityBg(s: string): string {
  const map: Record<string, string> = {
    critical: "#fef2f2",
    high:     "#fff7ed",
    medium:   "#fffbeb",
    low:      "#eff6ff",
  };
  return map[s] ?? "#f9fafb";
}

function scenarioLabel(s: string): string {
  const map: Record<string, string> = {
    CRITICAL: "Stockout Risk",
    DEAD:     "Dead Stock",
    SLOW:     "Slow Mover",
    WATCH:    "Watch",
    HEALTHY:  "Healthy",
    OVERSTOCK:"Overstock",
  };
  return map[s] ?? s;
}

function scenarioColor(s: string): string {
  const map: Record<string, string> = {
    CRITICAL: "#ef4444",
    DEAD:     "#a78bfa",
    SLOW:     "#f59e0b",
    WATCH:    "#3b82f6",
    HEALTHY:  "#10b981",
    OVERSTOCK:"#f97316",
  };
  return map[s] ?? "#6b7280";
}

function healthColor(score: number): string {
  if (score >= 80) return "#10b981";
  if (score >= 60) return "#3b82f6";
  if (score >= 40) return "#f59e0b";
  return "#ef4444";
}

function healthLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Poor";
}

// ─── Financial calculations (same as financial-impact page) ──────────────────

const CARRYING_RATE        = 0.25;
const DEAD_LIQUIDATION_RATE = 0.30;
const SLOW_REDUCTION_PCT   = 0.50;
const SLOW_RECOVERY_RATE   = 0.65;

function calcFinancial(m: DashboardMetrics) {
  const deadRecovery       = m.dead_stock_value * DEAD_LIQUIDATION_RATE;
  const slowRecovery       = m.slow_mover_value * SLOW_REDUCTION_PCT * SLOW_RECOVERY_RATE;
  const recoverableCapital = deadRecovery + slowRecovery;
  const reducibleInventory = m.dead_stock_value + m.slow_mover_value * SLOW_REDUCTION_PCT;
  const annualSavings      = reducibleInventory * CARRYING_RATE;
  const totalImprovement   = deadRecovery + m.slow_mover_value * SLOW_REDUCTION_PCT;
  const wcPct              = m.total_inventory_value > 0 ? (totalImprovement / m.total_inventory_value) * 100 : 0;
  const reductionValue     = m.dead_stock_value + m.slow_mover_value * SLOW_REDUCTION_PCT;
  const reductionPct       = m.total_inventory_value > 0 ? (reductionValue / m.total_inventory_value) * 100 : 0;
  const totalOpportunity   = recoverableCapital + annualSavings * 3;
  return { recoverableCapital, annualSavings, wcPct, reductionValue, reductionPct, totalOpportunity };
}

// ─── HTML builder ─────────────────────────────────────────────────────────────

export function generateHtmlReport(
  metrics: DashboardMetrics,
  summary: ExecutiveSummary,
  sourceFile = "Inventory dataset"
): string {
  const fin         = calcFinancial(metrics);
  const score       = summary.health_overview.score;
  const hColor      = healthColor(score);
  const hLabel      = healthLabel(score);
  const generatedAt = new Date(summary.generated_at).toLocaleString("en-US", {
    month: "long", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  // ── Risk distribution bars ─────────────────────────────────────────────────
  const rd = metrics.risk_distribution;
  const rdTotal = Object.values(rd).reduce((a, b) => a + b, 0) || 1;
  const riskBars = [
    { label: "Low",      count: rd.low,      color: "#10b981" },
    { label: "Watch",    count: rd.watch,     color: "#3b82f6" },
    { label: "Elevated", count: rd.elevated,  color: "#f59e0b" },
    { label: "Critical", count: rd.critical,  color: "#ef4444" },
    { label: "Dead",     count: rd.dead,      color: "#a78bfa" },
  ];

  const riskBarsHtml = riskBars.map(r => `
    <div style="margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="font-size:12px;color:#374151;font-weight:500;">${r.label}</span>
        <span style="font-size:12px;color:#374151;font-weight:600;">${r.count} SKUs</span>
      </div>
      <div style="background:#f3f4f6;border-radius:4px;height:10px;overflow:hidden;">
        <div style="height:100%;border-radius:4px;background:${r.color};width:${Math.max(2, (r.count / rdTotal) * 100).toFixed(1)}%;"></div>
      </div>
    </div>`
  ).join("");

  // ── ABC summary bars ───────────────────────────────────────────────────────
  const abc = metrics.abc_summary;
  const abcBars = [
    { cls: "A", count: abc.a_count, rev: abc.a_revenue_pct, color: "#10b981" },
    { cls: "B", count: abc.b_count, rev: abc.b_revenue_pct, color: "#3b82f6" },
    { cls: "C", count: abc.c_count, rev: abc.c_revenue_pct, color: "#6366f1" },
  ];
  const abcBarsHtml = abcBars.map(a => `
    <div style="margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="font-size:12px;color:#374151;font-weight:500;">Class ${a.cls} &ndash; ${a.count} SKUs</span>
        <span style="font-size:12px;color:${a.color};font-weight:600;">${a.rev}% revenue</span>
      </div>
      <div style="background:#f3f4f6;border-radius:4px;height:10px;overflow:hidden;">
        <div style="height:100%;border-radius:4px;background:${a.color};width:${Math.max(2, a.rev).toFixed(1)}%;"></div>
      </div>
    </div>`
  ).join("");

  // ── Risks ──────────────────────────────────────────────────────────────────
  const risksHtml = summary.key_risks.map(risk => `
    <div style="border-left:4px solid ${severityColor(risk.severity)};background:${severityBg(risk.severity)};padding:14px 16px;border-radius:0 8px 8px 0;margin-bottom:12px;">
      <div style="display:flex;gap:10px;align-items:baseline;margin-bottom:4px;flex-wrap:wrap;">
        <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:${severityColor(risk.severity)};">${esc(risk.severity)}</span>
        ${risk.affected_skus > 0 ? `<span style="font-size:11px;color:#6b7280;">${risk.affected_skus} SKUs affected</span>` : ""}
        ${risk.financial_exposure > 0 ? `<span style="font-size:11px;color:#6b7280;">&bull; ${fmt(risk.financial_exposure, true)} exposure</span>` : ""}
      </div>
      <p style="font-size:13px;font-weight:600;color:#111827;margin:0 0 4px 0;">${esc(risk.title)}</p>
      <p style="font-size:12px;color:#4b5563;margin:0;line-height:1.6;">${esc(risk.detail)}</p>
    </div>`
  ).join("");

  // ── Financial metric cards ─────────────────────────────────────────────────
  const finCards = [
    { label: "Total Inventory Value",      value: fmt(metrics.total_inventory_value),          color: "#111827" },
    { label: "Dead Stock Value",           value: fmt(metrics.dead_stock_value),               color: "#ef4444" },
    { label: "Slow Mover Value",           value: fmt(metrics.slow_mover_value),               color: "#f59e0b" },
    { label: "Recoverable Capital",        value: fmt(fin.recoverableCapital),                 color: "#10b981" },
    { label: "Annual Carrying Cost Savings",value: fmt(fin.annualSavings) + "/yr",             color: "#3b82f6" },
    { label: "Working Capital Improvement",value: pct(fin.wcPct),                              color: "#6366f1" },
    { label: "Inventory Reduction Opp.",   value: fmt(fin.reductionValue) + ` (${pct(fin.reductionPct)})`, color: "#f97316" },
    { label: "3-Year Financial Opportunity",value: fmt(fin.totalOpportunity),                  color: "#10b981" },
  ];
  const finCardsHtml = finCards.map(c => `
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;min-width:0;">
      <p style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 6px 0;">${esc(c.label)}</p>
      <p style="font-size:18px;font-weight:700;color:${c.color};margin:0;font-variant-numeric:tabular-nums;">${esc(c.value)}</p>
    </div>`
  ).join("");

  // ── Actions ────────────────────────────────────────────────────────────────
  const timelineColor: Record<string, string> = {
    "Immediate":    "#ef4444",
    "This week":    "#f59e0b",
    "This month":   "#3b82f6",
    "Next quarter": "#6b7280",
  };
  const actionsHtml = summary.recommended_actions.map(a => `
    <tr style="border-bottom:1px solid #f3f4f6;">
      <td style="padding:10px 12px;font-size:12px;font-weight:700;color:#6366f1;text-align:center;width:32px;">${a.priority}</td>
      <td style="padding:10px 12px;">
        <p style="font-size:12px;font-weight:600;color:#111827;margin:0 0 2px 0;">${esc(a.action)}</p>
        <p style="font-size:11px;color:#6b7280;margin:0;">${esc(a.rationale)}</p>
      </td>
      <td style="padding:10px 12px;white-space:nowrap;">
        <span style="display:inline-block;font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;background:${timelineColor[a.timeline] ?? "#e5e7eb"}20;color:${timelineColor[a.timeline] ?? "#374151"};border:1px solid ${timelineColor[a.timeline] ?? "#e5e7eb"}40;">${esc(a.timeline)}</span>
      </td>
      <td style="padding:10px 12px;font-size:11px;color:#374151;white-space:nowrap;">${esc(a.owner)}</td>
      <td style="padding:10px 12px;font-size:11px;color:#10b981;font-weight:500;">${esc(a.estimated_impact)}</td>
    </tr>`
  ).join("");

  // ── Priority items table ───────────────────────────────────────────────────
  const priorityHtml = summary.priority_items.map(item => {
    const sc = scenarioColor(item.scenario);
    const sl = scenarioLabel(item.scenario);
    const daysLeft = item.days_left !== null ? `${item.days_left}d` : "∞";
    return `
    <tr style="border-bottom:1px solid #f3f4f6;">
      <td style="padding:9px 12px;font-size:11px;font-family:monospace;color:#6b7280;">${esc(item.sku_id)}</td>
      <td style="padding:9px 12px;font-size:12px;font-weight:500;color:#111827;max-width:180px;">${esc(item.product_name)}</td>
      <td style="padding:9px 12px;text-align:center;">
        <span style="display:inline-block;font-size:10px;font-weight:600;padding:2px 7px;border-radius:20px;background:#e0e7ff;color:#4338ca;">${esc(item.abc_class)}</span>
      </td>
      <td style="padding:9px 12px;">
        <span style="display:inline-block;font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;background:${sc}18;color:${sc};border:1px solid ${sc}30;">${esc(sl)}</span>
      </td>
      <td style="padding:9px 12px;font-size:12px;font-weight:600;color:${item.scenario === "CRITICAL" ? "#ef4444" : "#374151"};text-align:right;">${esc(daysLeft)}</td>
      <td style="padding:9px 12px;font-size:11px;font-variant-numeric:tabular-nums;color:#374151;text-align:right;">${esc(fmt(item.value, true))}</td>
    </tr>`;
  }).join("");

  // ── 3-year projection bars ─────────────────────────────────────────────────
  const y1 = fin.recoverableCapital + fin.annualSavings;
  const y2 = y1 + fin.annualSavings;
  const y3 = y2 + fin.annualSavings;
  const maxY = Math.max(y1, y2, y3) || 1;
  const projBars = [
    { yr: "Year 1", val: y1, color: "#6366f1" },
    { yr: "Year 2", val: y2, color: "#818cf8" },
    { yr: "Year 3", val: y3, color: "#a5b4fc" },
  ];
  const projHtml = projBars.map(p => `
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;">
      <span style="font-size:12px;font-weight:700;color:#111827;">${fmt(p.val, true)}</span>
      <div style="width:64px;background:#f3f4f6;border-radius:6px 6px 0 0;overflow:hidden;height:80px;display:flex;align-items:flex-end;">
        <div style="width:100%;background:${p.color};height:${((p.val / maxY) * 80).toFixed(0)}px;border-radius:4px 4px 0 0;"></div>
      </div>
      <span style="font-size:11px;color:#6b7280;">${p.yr}</span>
    </div>`
  ).join("");

  // ── Assumptions table ──────────────────────────────────────────────────────
  const assumptions = [
    { name: "Annual Carrying Rate",      rate: "25%",  basis: "COGS % of inventory value",    std: "20–30%" },
    { name: "Dead Stock Recovery",       rate: "30%",  basis: "Liquidation market value",      std: "20–40%" },
    { name: "Slow Mover Reduction",      rate: "50%",  basis: "Target sell-down volume",       std: "25–75%" },
    { name: "Slow Mover Recovery Rate",  rate: "65%",  basis: "Clearance pricing factor",      std: "55–75%" },
    { name: "WACC",                      rate: "12%",  basis: "Weighted avg cost of capital",  std: "8–15%"  },
  ];
  const assumHtml = assumptions.map(a => `
    <tr style="border-bottom:1px solid #f3f4f6;">
      <td style="padding:8px 12px;font-size:12px;color:#374151;font-weight:500;">${esc(a.name)}</td>
      <td style="padding:8px 12px;font-size:12px;color:#6366f1;font-weight:700;text-align:right;">${esc(a.rate)}</td>
      <td style="padding:8px 12px;font-size:11px;color:#6b7280;">${esc(a.basis)}</td>
      <td style="padding:8px 12px;font-size:11px;color:#9ca3af;text-align:right;">${esc(a.std)}</td>
    </tr>`
  ).join("");

  // ── Policy settings table ──────────────────────────────────────────────────
  const activePolicy = metrics.active_policy;
  const policyRows = activePolicy ? (() => {
    const p = activePolicy.policy;
    const fs = activePolicy.field_sources;
    const srcColor = (src?: string) =>
      src === "file"   ? "#10b981" :  // green
      src === "user"   ? "#6366f1" :  // indigo
                         "#9ca3af";   // slate
    const srcLabel = (src?: string) =>
      src === "file" ? "File" : src === "user" ? "User" : "System Default";
    const rows: Array<{ name: string; value: string; fieldKey: keyof typeof p }> = [
      { name: "Slow Moving Threshold",  value: `${p.slow_moving_days} days`,        fieldKey: "slow_moving_days" },
      { name: "Dead Stock Threshold",   value: `${p.dead_stock_days} days`,          fieldKey: "dead_stock_days" },
      { name: "Critical Coverage",      value: `${p.critical_coverage_days} days`,   fieldKey: "critical_coverage_days" },
      { name: "Safety Stock Days",      value: `${p.safety_stock_days} days`,        fieldKey: "safety_stock_days" },
      { name: "ABC A-Class %",          value: `${p.abc_a_pct}%`,                    fieldKey: "abc_a_pct" },
      { name: "ABC B-Class %",          value: `${p.abc_b_pct}%`,                    fieldKey: "abc_b_pct" },
      { name: "Weight — Dead Stock",    value: `${p.weight_dead_stock}%`,            fieldKey: "weight_dead_stock" },
      { name: "Weight — Slow Moving",   value: `${p.weight_slow_moving}%`,           fieldKey: "weight_slow_moving" },
      { name: "Weight — Stockout Risk", value: `${p.weight_stockout_risk}%`,         fieldKey: "weight_stockout_risk" },
    ];
    return rows.map(r => {
      const src = fs[r.fieldKey];
      return `
    <tr style="border-bottom:1px solid #f3f4f6;">
      <td style="padding:8px 12px;font-size:12px;color:#374151;font-weight:500;">${esc(r.name)}</td>
      <td style="padding:8px 12px;font-size:12px;color:#6366f1;font-weight:700;text-align:right;">${esc(r.value)}</td>
      <td style="padding:8px 12px;font-size:11px;color:${srcColor(src)};font-weight:600;">${esc(srcLabel(src))}</td>
      <td></td>
    </tr>`;
    }).join("");
  })() : "";

  const policyTableHtml = activePolicy ? `
  <tr style="background:#f8fafc;">
    <td colspan="4" style="padding:10px 12px;font-size:12px;font-weight:700;color:#374151;border-top:2px solid #e5e7eb;">
      Policy Settings
    </td>
  </tr>
  ${policyRows}
  ` : "";

  // ── Full HTML document ─────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SupplySense AI – Inventory Report – ${generatedAt}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif; background: #fff; color: #111827; }

    /* ── Print button bar (hidden when printing) ── */
    #print-bar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      background: #1e293b; padding: 10px 24px;
      display: flex; align-items: center; justify-content: space-between;
      gap: 12px;
    }
    #print-bar span { font-size: 12px; color: #94a3b8; }
    #print-bar button {
      display: inline-flex; align-items: center; gap-6px; gap: 6px;
      padding: 7px 18px; border-radius: 8px; border: none; cursor: pointer;
      font-size: 13px; font-weight: 600;
    }
    #btn-print  { background: #6366f1; color: #fff; }
    #btn-print:hover  { background: #4f46e5; }
    #btn-close  { background: #334155; color: #cbd5e1; }
    #btn-close:hover  { background: #475569; }

    /* ── Page wrapper ── */
    #report { max-width: 900px; margin: 0 auto; padding: 80px 40px 60px; }

    /* ── Header ── */
    .report-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #6366f1; padding-bottom: 20px; margin-bottom: 28px; }
    .brand { display: flex; align-items: center; gap: 10px; }
    .brand-icon { width: 36px; height: 36px; background: #6366f1; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 16px; }
    .brand-name { font-size: 18px; font-weight: 800; color: #111827; letter-spacing: -0.02em; }
    .brand-sub { font-size: 11px; color: #6b7280; margin-top: 2px; }
    .report-meta { text-align: right; font-size: 11px; color: #6b7280; line-height: 1.7; }

    /* ── Section ── */
    .section { margin-bottom: 32px; page-break-inside: avoid; }
    .section-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid #e5e7eb; }
    .section-dot { width: 10px; height: 10px; border-radius: 50%; background: #6366f1; flex-shrink: 0; }
    .section-title { font-size: 14px; font-weight: 700; color: #111827; }
    .section-badge { margin-left: auto; font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 20px; background: #ede9fe; color: #6366f1; border: 1px solid #c4b5fd; }

    /* ── Health score box ── */
    .health-row { display: flex; gap: 20px; align-items: flex-start; }
    .health-score-box { flex-shrink: 0; width: 80px; height: 80px; border-radius: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .health-number { font-size: 26px; font-weight: 800; line-height: 1; }
    .health-label  { font-size: 10px; font-weight: 700; margin-top: 2px; }
    .health-body   { font-size: 12px; color: #4b5563; line-height: 1.65; }
    .health-headline { font-size: 14px; font-weight: 700; color: #111827; margin-bottom: 8px; }

    /* ── KPI grid ── */
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }

    /* ── Tables ── */
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    thead th { padding: 8px 12px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; background: #f9fafb; border-bottom: 1px solid #e5e7eb; }
    thead th:last-child { text-align: right; }

    /* ── Projection chart ── */
    .proj-chart { display: flex; gap: 20px; align-items: flex-end; padding: 16px 0; justify-content: center; }

    /* ── Footer ── */
    .report-footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 10px; color: #9ca3af; }
    .disclaimer { font-size: 10px; color: #9ca3af; line-height: 1.6; margin-top: 12px; padding: 10px 14px; background: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb; }

    /* ── Print styles ── */
    @media print {
      #print-bar { display: none !important; }
      #report { padding: 20px 30px 40px; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .section { page-break-inside: avoid; }
      .no-break { page-break-inside: avoid; }
    }
    @page { margin: 1.5cm; size: A4; }
  </style>
</head>
<body>

<!-- Print bar -->
<div id="print-bar">
  <span>SupplySense AI &mdash; Inventory Report &mdash; ${esc(generatedAt)}</span>
  <div style="display:flex;gap:8px;">
    <button id="btn-print" onclick="window.print()">&#128438; Save as PDF / Print</button>
    <button id="btn-close" onclick="window.close()">&#10005; Close</button>
  </div>
</div>

<div id="report">

  <!-- ── Report Header ── -->
  <div class="report-header">
    <div class="brand">
      <div class="brand-icon">S</div>
      <div>
        <div class="brand-name">SupplySense AI</div>
        <div class="brand-sub">Inventory Intelligence Platform</div>
      </div>
    </div>
    <div class="report-meta">
      <div><strong>Inventory Report</strong></div>
      <div>Source: ${esc(sourceFile)}</div>
      <div>Generated: ${esc(generatedAt)}</div>
      <div>${metrics.total_skus.toLocaleString()} SKUs &bull; ${metrics.analysis_mode.toUpperCase()} mode</div>
      <div style="margin-top:4px;font-size:10px;color:#9ca3af;">CONFIDENTIAL &mdash; For internal use only</div>
    </div>
  </div>

  <!-- ── Executive Summary Banner ── -->
  <div style="background:#f5f3ff;border:1px solid #c4b5fd;border-radius:10px;padding:16px 20px;margin-bottom:28px;">
    <p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#7c3aed;margin-bottom:4px;">Executive Summary</p>
    <p style="font-size:14px;font-weight:700;color:#111827;margin-bottom:6px;">${esc(summary.health_overview.headline)}</p>
    <p style="font-size:12px;color:#4b5563;line-height:1.65;">${esc(summary.health_overview.body)}</p>
  </div>

  <!-- ── 1. Health Overview ── -->
  <div class="section no-break">
    <div class="section-header">
      <div class="section-dot"></div>
      <span class="section-title">Inventory Health Overview</span>
      <span class="section-badge">${score}/100 &bull; ${hLabel}</span>
    </div>
    <div class="health-row">
      <div class="health-score-box" style="background:${hColor}15;border:2px solid ${hColor}30;">
        <span class="health-number" style="color:${hColor};">${score}</span>
        <span class="health-label" style="color:${hColor};">${hLabel}</span>
      </div>
      <div style="flex:1;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div>
            <p style="font-size:10px;text-transform:uppercase;color:#6b7280;margin-bottom:10px;font-weight:600;letter-spacing:0.05em;">Risk Distribution</p>
            ${riskBarsHtml}
          </div>
          <div>
            <p style="font-size:10px;text-transform:uppercase;color:#6b7280;margin-bottom:10px;font-weight:600;letter-spacing:0.05em;">ABC Classification</p>
            ${abcBarsHtml}
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ── 2. Financial Impact ── -->
  <div class="section no-break">
    <div class="section-header">
      <div class="section-dot" style="background:#10b981;"></div>
      <span class="section-title">Financial Impact &amp; Opportunity</span>
      <span class="section-badge" style="background:#d1fae5;color:#065f46;border-color:#a7f3d0;">3-yr opportunity: ${esc(fmt(fin.totalOpportunity))}</span>
    </div>
    <div class="kpi-grid" style="margin-bottom:20px;">
      ${finCardsHtml}
    </div>
    <!-- 3-year chart -->
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:20px 24px;">
      <p style="font-size:11px;font-weight:700;color:#374151;margin-bottom:16px;text-transform:uppercase;letter-spacing:0.05em;">3-Year Cumulative Benefit Projection</p>
      <div class="proj-chart">
        ${projHtml}
      </div>
      <p style="font-size:10px;color:#9ca3af;margin-top:8px;text-align:center;">Year 1 = capital release + first-year savings &bull; Years 2–3 add ongoing carrying cost savings</p>
    </div>
  </div>

  <!-- ── 3. Key Risks ── -->
  <div class="section">
    <div class="section-header">
      <div class="section-dot" style="background:#ef4444;"></div>
      <span class="section-title">Key Risks</span>
      <span class="section-badge" style="background:#fee2e2;color:#991b1b;border-color:#fca5a5;">${summary.key_risks.filter(r => r.severity === "critical" || r.severity === "high").length} high priority</span>
    </div>
    ${risksHtml}
  </div>

  <!-- ── 4. Recommended Actions ── -->
  <div class="section">
    <div class="section-header">
      <div class="section-dot" style="background:#f59e0b;"></div>
      <span class="section-title">Recommended Actions</span>
      <span class="section-badge" style="background:#fef3c7;color:#92400e;border-color:#fde68a;">${summary.recommended_actions.length} actions</span>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:32px;">#</th>
          <th>Action &amp; Rationale</th>
          <th style="width:100px;">Timeline</th>
          <th style="width:100px;">Owner</th>
          <th style="text-align:right;width:140px;">Expected Impact</th>
        </tr>
      </thead>
      <tbody>${actionsHtml}</tbody>
    </table>
  </div>

  <!-- ── 5. Priority Items ── -->
  <div class="section">
    <div class="section-header">
      <div class="section-dot" style="background:#6366f1;"></div>
      <span class="section-title">Priority Items</span>
      <span class="section-badge">Top ${summary.priority_items.length} items</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>SKU</th>
          <th>Product Name</th>
          <th style="text-align:center;">ABC</th>
          <th>Status</th>
          <th style="text-align:right;">Days Left</th>
          <th style="text-align:right;">Value</th>
        </tr>
      </thead>
      <tbody>${priorityHtml}</tbody>
    </table>
  </div>

  <!-- ── 6. Assumptions & Methodology ── -->
  <div class="section">
    <div class="section-header">
      <div class="section-dot" style="background:#6b7280;"></div>
      <span class="section-title">Assumptions &amp; Methodology</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>Assumption</th>
          <th style="text-align:right;width:60px;">Rate</th>
          <th>Basis</th>
          <th style="text-align:right;width:100px;">Industry Std.</th>
        </tr>
      </thead>
      <tbody>${assumHtml}${policyTableHtml}</tbody>
    </table>
    <div class="disclaimer">
      <strong>Disclaimer:</strong> All figures are estimates derived from uploaded inventory data using documented assumptions.
      Actual results depend on liquidation channels, market conditions, and execution capability.
      This report is provided for planning purposes only and does not constitute financial advice.
    </div>
  </div>

  <!-- ── Footer ── -->
  <div class="report-footer">
    <span>SupplySense AI &mdash; Inventory Intelligence Platform</span>
    <span>Generated ${esc(generatedAt)} &bull; ${esc(sourceFile)}</span>
    <span>CONFIDENTIAL</span>
  </div>

</div>

<script>
  // Auto-open print dialog after short delay so styles fully render
  window.addEventListener("load", function() {
    // Don't auto-print — let user review first
    // window.print();
  });
</script>
</body>
</html>`;
}

// ─── Public helper: open in new window ───────────────────────────────────────

export function openHtmlReport(
  metrics: DashboardMetrics,
  summary: ExecutiveSummary,
  sourceFile = "Inventory dataset"
): void {
  const html = generateHtmlReport(metrics, summary, sourceFile);
  const blob  = new Blob([html], { type: "text/html;charset=utf-8" });
  const url   = URL.createObjectURL(blob);
  const win   = window.open(url, "_blank", "width=1000,height=800,scrollbars=yes,resizable=yes");
  if (!win) {
    // Fallback: direct download
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `SupplySense-Report-${new Date().toISOString().split("T")[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  // Revoke after a delay so the window has time to load
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
