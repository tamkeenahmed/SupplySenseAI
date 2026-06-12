"use client";
import type { DashboardMetrics } from "@/lib/types";
import type { ExecutiveSummary } from "@/lib/insights-generator";
import { formatCurrency, getHealthLabel } from "@/lib/utils";

function $ (v: number) { return formatCurrency(v, true); }

const SEVERITY_COLOR: Record<string, string> = {
  critical: "#ef4444",
  high:     "#f97316",
  medium:   "#f59e0b",
  low:      "#3b82f6",
};

const TIMELINE_COLOR: Record<string, string> = {
  "Immediate":    "#ef4444",
  "This week":    "#f59e0b",
  "This month":   "#3b82f6",
  "Next quarter": "#64748b",
};

const SCENARIO_LABEL: Record<string, string> = {
  CRITICAL: "Critical", DEAD: "Dead stock", SLOW: "Slow mover",
  WATCH: "Watch", HEALTHY: "Healthy",
};

export function generateReportHTML(
  metrics: DashboardMetrics,
  summary: ExecutiveSummary,
  sourceFile: string,
): string {
  const status   = getHealthLabel(metrics.health_score);
  const dateStr  = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const scoreColor =
    metrics.health_score >= 80 ? "#10b981" :
    metrics.health_score >= 60 ? "#3b82f6" :
    metrics.health_score >= 40 ? "#f59e0b" : "#ef4444";

  const risksHTML = summary.key_risks.map(r => `
    <div class="risk-item" style="border-left:3px solid ${SEVERITY_COLOR[r.severity] ?? "#64748b"}">
      <div class="risk-header">
        <span class="badge" style="background:${SEVERITY_COLOR[r.severity]}22;color:${SEVERITY_COLOR[r.severity]}">${r.severity.toUpperCase()}</span>
        ${r.affected_skus > 0 ? `<span class="meta">${r.affected_skus} SKUs affected</span>` : ""}
        ${r.financial_exposure > 0 ? `<span class="meta">${$(r.financial_exposure)} exposure</span>` : ""}
      </div>
      <p class="risk-title">${r.title}</p>
      <p class="risk-detail">${r.detail}</p>
    </div>`).join("");

  const finMetricsHTML = summary.financial_impact.metrics.map(m => `
    <div class="fin-cell${m.highlight ? " highlight" : ""}">
      <div class="fin-label">${m.label}</div>
      <div class="fin-value">${m.value}</div>
      ${m.sub ? `<div class="fin-sub">${m.sub}</div>` : ""}
    </div>`).join("");

  const actionsHTML = summary.recommended_actions.map(a => `
    <tr>
      <td class="priority-num">${a.priority}</td>
      <td>
        <div class="action-title">${a.action}</div>
        <div class="action-rationale">${a.rationale}</div>
        <div class="action-impact">✓ ${a.estimated_impact}</div>
      </td>
      <td><span class="badge" style="background:${TIMELINE_COLOR[a.timeline]}22;color:${TIMELINE_COLOR[a.timeline]}">${a.timeline}</span></td>
      <td class="owner-cell">${a.owner}</td>
    </tr>`).join("");

  const priorityHTML = summary.priority_items.map(p => `
    <tr>
      <td class="mono">${p.sku_id}</td>
      <td>${p.product_name}</td>
      <td><span class="badge abc-badge">${p.abc_class}</span></td>
      <td>${SCENARIO_LABEL[p.scenario] ?? p.scenario}</td>
      <td class="${p.scenario === "CRITICAL" ? "urgent" : ""}">${p.days_left !== null ? `${p.days_left}d` : "∞"}</td>
      <td class="action-verb">${p.urgency_label}</td>
      <td class="mono">${$(p.value)}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SupplySense AI — Executive Report</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 13px; color: #1e293b; background: #fff; line-height: 1.6; }
  @page { margin: 18mm 16mm; }

  /* Layout */
  .page { max-width: 860px; margin: 0 auto; padding: 32px 24px; }
  .section { margin-bottom: 36px; }
  h1 { font-size: 22px; font-weight: 700; color: #0f172a; }
  h2 { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1.5px solid #e2e8f0; }
  p { color: #475569; margin-bottom: 8px; }

  /* Header */
  .report-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #6366f1; }
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand-dot { width: 32px; height: 32px; border-radius: 8px; background: #6366f1; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 14px; }
  .brand-name { font-size: 16px; font-weight: 700; color: #0f172a; }
  .report-meta { text-align: right; color: #94a3b8; font-size: 11px; }
  .report-meta strong { display: block; color: #0f172a; font-size: 13px; margin-bottom: 2px; }

  /* Health score pill */
  .health-row { display: flex; align-items: center; gap: 20px; margin-bottom: 16px; }
  .score-pill { width: 80px; height: 80px; border-radius: 16px; border: 2px solid ${scoreColor}40; background: ${scoreColor}10; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; }
  .score-num { font-size: 28px; font-weight: 800; color: ${scoreColor}; line-height: 1; }
  .score-status { font-size: 11px; font-weight: 600; color: ${scoreColor}; margin-top: 2px; }
  .overview-body { color: #475569; font-size: 13px; line-height: 1.7; }

  /* Badges */
  .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 600; }
  .abc-badge { background: #eef2ff; color: #4f46e5; }

  /* Risk items */
  .risk-item { background: #f8fafc; border-radius: 8px; padding: 12px 14px; margin-bottom: 10px; }
  .risk-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .meta { font-size: 11px; color: #94a3b8; }
  .risk-title { font-weight: 600; color: #0f172a; font-size: 13px; margin-bottom: 4px; }
  .risk-detail { font-size: 12px; color: #64748b; line-height: 1.6; }

  /* Financial grid */
  .fin-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
  .fin-cell { background: #f8fafc; border-radius: 8px; padding: 12px; border: 1px solid #e2e8f0; }
  .fin-cell.highlight { background: #fffbeb; border-color: #fde68a; }
  .fin-label { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  .fin-value { font-size: 18px; font-weight: 700; color: #0f172a; }
  .fin-cell.highlight .fin-value { color: #d97706; }
  .fin-sub { font-size: 10px; color: #94a3b8; margin-top: 2px; }

  /* Tables */
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead tr { background: #f1f5f9; }
  th { text-align: left; padding: 8px 10px; font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
  td { padding: 9px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .priority-num { font-weight: 700; color: #6366f1; font-size: 14px; width: 28px; }
  .action-title { font-weight: 600; color: #0f172a; margin-bottom: 3px; }
  .action-rationale { color: #64748b; font-size: 11px; line-height: 1.5; margin-bottom: 3px; }
  .action-impact { font-size: 11px; color: #059669; }
  .owner-cell { color: #64748b; white-space: nowrap; font-size: 11px; }
  .mono { font-family: "SF Mono", "Fira Code", monospace; font-size: 11px; color: #64748b; }
  .urgent { color: #ef4444; font-weight: 600; }
  .action-verb { font-weight: 600; color: #6366f1; white-space: nowrap; }

  /* Audience notes */
  .audience-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .audience-card { background: #f8fafc; border-radius: 8px; padding: 12px; border: 1px solid #e2e8f0; }
  .audience-title { font-size: 11px; font-weight: 700; color: #6366f1; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
  .audience-body { font-size: 11px; color: #64748b; line-height: 1.6; }

  /* Footer */
  .report-footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; }

  @media print {
    .page { padding: 0; }
    .section { page-break-inside: avoid; }
    h2 { page-break-after: avoid; }
    .fin-grid { grid-template-columns: repeat(3, 1fr); }
  }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="report-header">
    <div class="brand">
      <div class="brand-dot">S</div>
      <div>
        <div class="brand-name">SupplySense AI</div>
        <div style="font-size:11px;color:#94a3b8">Executive Inventory Report</div>
      </div>
    </div>
    <div class="report-meta">
      <strong>${dateStr}</strong>
      Source: ${sourceFile}<br>
      ${metrics.total_skus} SKUs analysed
    </div>
  </div>

  <!-- 1. Health Overview -->
  <div class="section">
    <h2>1 · Inventory Health Overview</h2>
    <div class="health-row">
      <div class="score-pill">
        <div class="score-num">${metrics.health_score}</div>
        <div class="score-status">${status}</div>
      </div>
      <div class="overview-body">
        <strong style="color:#0f172a;display:block;margin-bottom:6px">${summary.health_overview.headline}</strong>
        ${summary.health_overview.body}
      </div>
    </div>
  </div>

  <!-- 2. Key Risks -->
  <div class="section">
    <h2>2 · Key Risks</h2>
    ${risksHTML}
  </div>

  <!-- 3. Financial Impact -->
  <div class="section">
    <h2>3 · Financial Impact</h2>
    <p style="margin-bottom:14px">${summary.financial_impact.body}</p>
    <div class="fin-grid">${finMetricsHTML}</div>
  </div>

  <!-- 4. Recommended Actions -->
  <div class="section">
    <h2>4 · Recommended Actions</h2>
    <table>
      <thead>
        <tr>
          <th>#</th><th>Action</th><th>Timeline</th><th>Owner</th>
        </tr>
      </thead>
      <tbody>${actionsHTML}</tbody>
    </table>
  </div>

  <!-- 5. Priority Items -->
  <div class="section">
    <h2>5 · Priority Items</h2>
    <table>
      <thead>
        <tr>
          <th>SKU</th><th>Product</th><th>ABC</th><th>Status</th><th>Days Left</th><th>Action</th><th>Value</th>
        </tr>
      </thead>
      <tbody>${priorityHTML}</tbody>
    </table>
  </div>

  <!-- Audience Notes -->
  <div class="section">
    <h2>Executive Briefings by Role</h2>
    <div class="audience-grid">
      <div class="audience-card">
        <div class="audience-title">CEO</div>
        <div class="audience-body">${summary.audience_notes.ceo}</div>
      </div>
      <div class="audience-card">
        <div class="audience-title">Supply Chain</div>
        <div class="audience-body">${summary.audience_notes.supply_chain}</div>
      </div>
      <div class="audience-card">
        <div class="audience-title">Procurement</div>
        <div class="audience-body">${summary.audience_notes.procurement}</div>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="report-footer">
    <span>Generated by SupplySense AI · ${dateStr}</span>
    <span>Confidential — for internal use only</span>
  </div>

</div>
</body>
</html>`;
}

/** Triggers a browser download of the HTML report. */
export function downloadReport(
  metrics: DashboardMetrics,
  summary: ExecutiveSummary,
  sourceFile: string,
): void {
  const html  = generateReportHTML(metrics, summary, sourceFile);
  const blob  = new Blob([html], { type: "text/html;charset=utf-8" });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement("a");
  const date  = new Date().toISOString().slice(0, 10);
  a.href      = url;
  a.download  = `SupplySense-Report-${date}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
