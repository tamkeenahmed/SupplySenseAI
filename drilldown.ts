"use client";
/**
 * Drill-through engine — Phase 11
 *
 * openDrilldown(context, metrics)
 *   → stores payload in sessionStorage
 *   → opens /dashboard/drilldown in a new window
 *
 * Each "context" maps a chart click to a set of rows + column definitions,
 * exactly like double-clicking a cell in an Excel pivot table.
 */

import type { DashboardMetrics, AnalyzedSKU } from "./types";

// ─── Column definition ────────────────────────────────────────────────────────

export interface DrillColumn {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  format?: "currency" | "number" | "percent" | "days" | "badge" | "text";
  /** badge colour class, keyed by cell value */
  badgeColors?: Record<string, string>;
}

// ─── Payload stored in sessionStorage ─────────────────────────────────────────

export interface DrilldownPayload {
  title: string;
  subtitle: string;
  sourceChart: string;           // human-readable e.g. "Risk Distribution Bar Chart"
  segment: string;               // clicked segment e.g. "Critical"
  totalRows: number;
  columns: DrillColumn[];
  rows: Record<string, unknown>[];
  generatedAt: string;           // ISO timestamp
}

// ─── Context types ────────────────────────────────────────────────────────────

export type DrillContext =
  | { chart: "risk_distribution";  segment: string }   // Low / Watch / Elevated / Critical / Dead
  | { chart: "abc_distribution";   segment: "A" | "B" | "C" }
  | { chart: "health_factor";      segment: "Dead Stock" | "Slow Movers" | "Stockout Risk" | "ABC Quality" }
  | { chart: "aging_bucket";       segment: string }   // bucket label e.g. "0–30 days"
  | { chart: "abc_pareto";         segment: "A" | "B" | "C" }
  | { chart: "turnover_benchmark"; segment: string }   // not item-level; shows scenario rows
  | { chart: "carrying_cost";      segment: string };  // Active / Slow movers / Dead stock

// ─── Column sets ──────────────────────────────────────────────────────────────

const SKU_COLS: DrillColumn[] = [
  { key: "sku_id",           label: "SKU",           align: "left",   format: "text"     },
  { key: "product_name",     label: "Product",       align: "left",   format: "text"     },
  { key: "category",         label: "Category",      align: "left",   format: "text"     },
  { key: "abc_class",        label: "ABC",           align: "center", format: "badge",
    badgeColors: { A: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                   B: "text-blue-400 bg-blue-500/10 border-blue-500/20",
                   C: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20" } },
  { key: "units_on_hand",    label: "Stock Qty",     align: "right",  format: "number"   },
  { key: "unit_cost",        label: "Unit Cost",     align: "right",  format: "currency" },
  { key: "inventory_value",  label: "Value",         align: "right",  format: "currency" },
];

const RISK_COLS: DrillColumn[] = [
  { key: "sku_id",                label: "SKU",            align: "left",   format: "text"     },
  { key: "product_name",          label: "Product",        align: "left",   format: "text"     },
  { key: "category",              label: "Category",       align: "left",   format: "text"     },
  { key: "scenario",              label: "Scenario",       align: "center", format: "badge",
    badgeColors: {
      CRITICAL:  "text-red-300 bg-red-500/15 border-red-500/25",
      DEAD:      "text-purple-300 bg-purple-500/15 border-purple-500/25",
      SLOW:      "text-amber-300 bg-amber-500/15 border-amber-500/25",
      OVERSTOCK: "text-orange-300 bg-orange-500/15 border-orange-500/25",
      WATCH:     "text-blue-300 bg-blue-500/15 border-blue-500/25",
      HEALTHY:   "text-emerald-300 bg-emerald-500/15 border-emerald-500/25",
    }},
  { key: "abc_class",             label: "ABC",            align: "center", format: "badge",
    badgeColors: { A: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                   B: "text-blue-400 bg-blue-500/10 border-blue-500/20",
                   C: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20" } },
  { key: "units_on_hand",         label: "Stock Qty",      align: "right",  format: "number"   },
  { key: "days_stock_remaining",  label: "Days Left",      align: "right",  format: "days"     },
  { key: "stockout_risk_score",   label: "Risk Score",     align: "right",  format: "number"   },
  { key: "inventory_value",       label: "Value",          align: "right",  format: "currency" },
];

const REORDER_COLS: DrillColumn[] = [
  { key: "sku_id",         label: "SKU",           align: "left",   format: "text"     },
  { key: "product_name",   label: "Product",       align: "left",   format: "text"     },
  { key: "abc_class",      label: "ABC",           align: "center", format: "badge",
    badgeColors: { A: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                   B: "text-blue-400 bg-blue-500/10 border-blue-500/20",
                   C: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20" } },
  { key: "eoq",            label: "EOQ (units)",   align: "right",  format: "number"   },
  { key: "rop",            label: "Reorder Point", align: "right",  format: "number"   },
  { key: "days_until_stockout", label: "Days Left",align: "right",  format: "days"     },
  { key: "unit_cost",      label: "Unit Cost",     align: "right",  format: "currency" },
  { key: "order_value",    label: "Order Value",   align: "right",  format: "currency" },
];

// ─── Row builders ─────────────────────────────────────────────────────────────

function skuRows(items: AnalyzedSKU[]) {
  return items.map((i) => ({
    sku_id: i.sku_id,
    product_name: i.product_name,
    category: i.category || "—",
    abc_class: i.abc_class,
    scenario: i.scenario,
    units_on_hand: i.units_on_hand,
    unit_cost: i.unit_cost,
    inventory_value: i.inventory_value,
    days_stock_remaining: isFinite(i.days_stock_remaining) ? Math.round(i.days_stock_remaining) : null,
    stockout_risk_score: i.stockout_risk_score,
  }));
}

// Maps risk-chart bar names → scenario codes
const RISK_SEGMENT_MAP: Record<string, string[]> = {
  Low:      ["HEALTHY"],
  Watch:    ["WATCH"],
  Elevated: ["SLOW", "OVERSTOCK"],
  Critical: ["CRITICAL"],
  Dead:     ["DEAD"],
};

// ─── Main builder ─────────────────────────────────────────────────────────────

export function buildDrilldown(
  ctx: DrillContext,
  metrics: DashboardMetrics
): DrilldownPayload {
  const now = new Date().toISOString();

  // Helper: use all_skus (full dataset) with fallback to top_risk_items
  const allSkus: AnalyzedSKU[] = (metrics.all_skus?.length ? metrics.all_skus : metrics.top_risk_items);

  // ── Risk distribution bar chart ──────────────────────────────────────────────
  if (ctx.chart === "risk_distribution") {
    const scenarios = RISK_SEGMENT_MAP[ctx.segment] ?? [];
    const items = allSkus.filter((i) => scenarios.includes(i.scenario));
    return {
      title: `${ctx.segment} SKUs`,
      subtitle: `${items.length} SKU${items.length !== 1 ? "s" : ""} classified as ${ctx.segment} risk`,
      sourceChart: "Risk Distribution Chart",
      segment: ctx.segment,
      totalRows: items.length,
      columns: RISK_COLS,
      rows: skuRows(items),
      generatedAt: now,
    };
  }

  // ── ABC pie / pareto bar ─────────────────────────────────────────────────────
  if (ctx.chart === "abc_distribution" || ctx.chart === "abc_pareto") {
    const items = allSkus.filter((i) => i.abc_class === ctx.segment);
    const label = ctx.segment === "A"
      ? `A-Class — Top revenue drivers (${metrics.abc_summary.a_revenue_pct}% of revenue)`
      : ctx.segment === "B"
      ? `B-Class — Mid-tier items (${metrics.abc_summary.b_revenue_pct}% of revenue)`
      : `C-Class — Low revenue items (${metrics.abc_summary.c_revenue_pct}% of revenue)`;
    return {
      title: `Class ${ctx.segment} Items`,
      subtitle: label,
      sourceChart: ctx.chart === "abc_pareto" ? "ABC Pareto Chart" : "ABC Distribution Chart",
      segment: ctx.segment,
      totalRows: items.length,
      columns: SKU_COLS,
      rows: skuRows(items),
      generatedAt: now,
    };
  }

  // ── Health score factor bars ─────────────────────────────────────────────────
  if (ctx.chart === "health_factor") {
    let items: AnalyzedSKU[] = [];
    let subtitle = "";
    if (ctx.segment === "Dead Stock") {
      items = allSkus.filter((i) => i.scenario === "DEAD" || i.is_dead_stock);
      subtitle = `${items.length} SKUs with zero movement — ${metrics.health_components.dead_stock_pct}% of portfolio`;
    } else if (ctx.segment === "Slow Movers") {
      items = allSkus.filter((i) => i.scenario === "SLOW");
      subtitle = `${items.length} SKUs with > 6 months of stock on hand`;
    } else if (ctx.segment === "Stockout Risk") {
      items = allSkus.filter((i) => i.scenario === "CRITICAL" || i.scenario === "WATCH");
      subtitle = `${items.length} SKUs below their reorder point`;
    } else {
      items = allSkus.filter((i) => i.abc_class === "A");
      subtitle = `${items.length} A-class SKUs driving ${metrics.health_components.a_item_revenue_pct}% of revenue`;
    }
    return {
      title: `Health Factor: ${ctx.segment}`,
      subtitle,
      sourceChart: "Health Score Factor Bar",
      segment: ctx.segment,
      totalRows: items.length,
      columns: RISK_COLS,
      rows: skuRows(items),
      generatedAt: now,
    };
  }

  // ── Aging bucket bar chart ───────────────────────────────────────────────────
  if (ctx.chart === "aging_bucket") {
    const aging = metrics.aging_metrics;
    if (!aging) {
      return {
        title: ctx.segment,
        subtitle: "No ageing data available",
        sourceChart: "Ageing Distribution Chart",
        segment: ctx.segment,
        totalRows: 0,
        columns: [],
        rows: [],
        generatedAt: now,
      };
    }
    const bucket = aging.buckets.find((b) => b.label === ctx.segment);
    const items  = aging.liquidation_opportunities.filter((i) => i.bucket_label === ctx.segment);
    return {
      title: ctx.segment,
      subtitle: bucket
        ? `${bucket.count} items · ${bucket.pct_value}% of inventory value · ${bucket.pct_count}% of SKU count`
        : `Items in bucket: ${ctx.segment}`,
      sourceChart: "Ageing Distribution Chart",
      segment: ctx.segment,
      totalRows: items.length,
      columns: [
        { key: "item_code",        label: "Item Code",     align: "left",   format: "text"     },
        { key: "item_name",        label: "Item Name",     align: "left",   format: "text"     },
        { key: "category",         label: "Category",      align: "left",   format: "text"     },
        { key: "supplier",         label: "Supplier",      align: "left",   format: "text"     },
        { key: "stock_qty",        label: "Qty",           align: "right",  format: "number"   },
        { key: "unit_cost",        label: "Unit Cost",     align: "right",  format: "currency" },
        { key: "ageing_days",      label: "Ageing Days",   align: "right",  format: "days"     },
        { key: "inventory_value",  label: "Value",         align: "right",  format: "currency" },
      ],
      rows: items.map((i) => ({
        item_code: i.item_code,
        item_name: i.item_name,
        category: i.category || "—",
        supplier: i.supplier || "—",
        stock_qty: i.stock_qty,
        unit_cost: i.unit_cost,
        ageing_days: i.ageing_days,
        inventory_value: i.inventory_value,
      })),
      generatedAt: now,
    };
  }

  // ── Carrying cost breakdown (Turnover page) ──────────────────────────────────
  if (ctx.chart === "carrying_cost") {
    let items: AnalyzedSKU[] = [];
    if (ctx.segment === "Dead stock") {
      items = allSkus.filter((i) => i.scenario === "DEAD" || i.is_dead_stock);
    } else if (ctx.segment === "Slow movers") {
      items = allSkus.filter((i) => i.scenario === "SLOW");
    } else {
      items = allSkus.filter((i) => i.scenario === "HEALTHY");
    }
    return {
      title: `Carrying Cost: ${ctx.segment}`,
      subtitle: `${items.length} SKUs contributing to ${ctx.segment.toLowerCase()} carrying cost`,
      sourceChart: "Annual Carrying Cost Breakdown",
      segment: ctx.segment,
      totalRows: items.length,
      columns: SKU_COLS,
      rows: skuRows(items),
      generatedAt: now,
    };
  }

  // Fallback
  return {
    title: ctx.segment,
    subtitle: "",
    sourceChart: "Chart",
    segment: ctx.segment,
    totalRows: 0,
    columns: [],
    rows: [],
    generatedAt: now,
  };
}

// ─── Public helper called from chart onClick ──────────────────────────────────

export function openDrilldown(ctx: DrillContext, metrics: DashboardMetrics) {
  const payload = buildDrilldown(ctx, metrics);
  const key = `drilldown_${Date.now()}`;
  try {
    sessionStorage.setItem(key, JSON.stringify(payload));
  } catch {
    console.warn("sessionStorage full — drill-through data not stored");
    return;
  }
  window.open(
    `/dashboard/drilldown?key=${key}`,
    `drilldown_${Date.now()}`,
    "width=1100,height=700,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no"
  );
}
