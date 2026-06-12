/**
 * Validation Engine — Phase 13: Explainable Analytics & Trust Framework
 *
 * Provides:
 *  - buildLiveCalculation() — step-by-step real-data computations for each KPI
 *  - getWhyExplanation()    — plain-English "why am I seeing this?" per KPI
 *  - getDataLineage()       — source columns + policy info per KPI
 *  - buildScoreBreakdown()  — health-score decomposition from 100 down
 *  - buildValidationExport() — full audit payload for download
 */

import { formatCurrency } from "@/lib/utils";
import type { DashboardMetrics } from "@/lib/types";
import type { KPIKey } from "@/lib/kpi-definitions";
import type { ActivePolicy } from "@/lib/policy";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LiveCalcStep {
  label: string;
  expr?: string;          // formula expression (monospace)
  value: string;          // computed value
  detail?: string;        // extra context
  isFinal?: boolean;      // highlight as the result row
  isHeader?: boolean;     // section divider label
}

export interface LiveCalculation {
  totalRecords: number;
  includedRecords: number;
  summary: string;
  steps: LiveCalcStep[];
}

export interface WhyExplanation {
  headline: string;       // 1-line bold headline
  body: string;           // 2–3 sentence plain-English explanation
  impact: string;         // business impact
  action: string;         // recommended action
  confidence: "High" | "Medium" | "Low";
  audience: string[];     // roles this matters to
}

export interface DataLineageField {
  columnName: string;
  role: string;
  required: boolean;
  detected: boolean;      // was it found in the uploaded file?
}

export interface DataLineage {
  source: string;
  fields: DataLineageField[];
  policySource: "file" | "user" | "system";
  policyFields: { field: string; value: string | number; source: string }[];
  trustStatement: string;
}

export interface ScoreDeduction {
  factor: string;
  weight: number;
  rawScore: number;
  contribution: number;   // raw contribution to final score
  deduction: number;      // points lost vs perfect
  detail: string;
}

export interface ScoreBreakdown {
  baseScore: 100;
  finalScore: number;
  deductions: ScoreDeduction[];
  formula: string;
}

// ── Live Calculation Builder ──────────────────────────────────────────────────

export function buildLiveCalculation(
  key: KPIKey,
  metrics: DashboardMetrics
): LiveCalculation {
  switch (key) {

    case "inventory_value": {
      const allSkus = metrics.all_skus ?? metrics.top_risk_items;
      const sample = [...allSkus]
        .sort((a, b) => b.inventory_value - a.inventory_value)
        .slice(0, 5);
      const steps: LiveCalcStep[] = [
        { label: "Formula applied per SKU", expr: "SKU Value = Units on Hand × Unit Cost", value: "" },
        { isHeader: true, label: "Top 5 contributors", value: "" },
        ...sample.map((s) => ({
          label: `${s.product_name} (${s.sku_id})`,
          expr: `${s.units_on_hand.toLocaleString()} units × ${formatCurrency(s.unit_cost)}`,
          value: formatCurrency(s.inventory_value),
        })),
        { isHeader: true, label: "Portfolio total", value: "" },
        {
          label: `Sum across all ${metrics.total_skus} SKUs`,
          expr: "Σ (Units × Unit Cost)",
          value: formatCurrency(metrics.total_inventory_value),
          isFinal: true,
        },
        {
          label: "Annual carrying cost (25% of value)",
          expr: `${formatCurrency(metrics.total_inventory_value)} × 0.25`,
          value: formatCurrency(metrics.annual_carrying_cost),
          detail: "Standard industry carrying cost rate",
        },
      ];
      return {
        totalRecords: metrics.total_skus,
        includedRecords: metrics.total_skus,
        summary: `Calculated from all ${metrics.total_skus} SKUs in the uploaded file`,
        steps,
      };
    }

    case "dead_stock": {
      const deadItems = metrics.all_skus
        ? metrics.all_skus.filter((s) => s.is_dead_stock)
        : metrics.top_dead_stock;
      const sample = deadItems.slice(0, 5);
      const policy = metrics.active_policy?.policy;
      const thresholdDays = policy?.dead_stock_days ?? 365;
      const steps: LiveCalcStep[] = [
        {
          label: "Classification rule",
          expr: `daily_velocity = 0 AND days_since_last_sale ≥ ${thresholdDays} days`,
          value: "",
          detail: `Threshold: ${thresholdDays} days (${thresholdDays >= 365 ? "system default" : "policy override"})`,
        },
        { isHeader: true, label: "Sample dead stock items", value: "" },
        ...sample.map((s) => ({
          label: `${s.product_name} (${s.sku_id})`,
          expr: `${s.units_on_hand} units × ${formatCurrency(s.unit_cost)}`,
          value: formatCurrency(s.inventory_value),
          detail: `No movement for ${s.days_since_last_sale} days`,
        })),
        { isHeader: true, label: "Totals", value: "" },
        { label: "Dead stock SKUs", value: String(metrics.dead_stock_count), expr: "COUNT(is_dead_stock = true)" },
        {
          label: "Total dead stock value",
          expr: "Σ (Units × Unit Cost) for dead items",
          value: formatCurrency(metrics.dead_stock_value),
          isFinal: true,
        },
      ];
      return {
        totalRecords: metrics.total_skus,
        includedRecords: metrics.dead_stock_count,
        summary: `${metrics.dead_stock_count} of ${metrics.total_skus} SKUs classified as dead stock (no movement ≥ ${thresholdDays} days)`,
        steps,
      };
    }

    case "slow_moving": {
      const slowItems = metrics.all_skus
        ? metrics.all_skus.filter((s) => s.is_slow_mover && !s.is_dead_stock)
        : metrics.top_risk_items.filter((s) => s.scenario === "SLOW");
      const sample = slowItems.slice(0, 5);
      const policy = metrics.active_policy?.policy;
      const thresholdDays = policy?.slow_moving_days ?? 180;
      const steps: LiveCalcStep[] = [
        {
          label: "Classification rule",
          expr: `is_slow_mover = true AND NOT is_dead_stock\n(daily_velocity > 0 but days_of_supply > ${thresholdDays} days)`,
          value: "",
        },
        { isHeader: true, label: "Sample slow-moving items", value: "" },
        ...sample.map((s) => ({
          label: `${s.product_name} (${s.sku_id})`,
          expr: `${s.units_on_hand} units, ${isFinite(s.days_stock_remaining) ? Math.round(s.days_stock_remaining) + "d supply" : "∞ supply"}`,
          value: formatCurrency(s.inventory_value),
        })),
        { isHeader: true, label: "Totals", value: "" },
        { label: "Slow-moving SKUs", value: String(metrics.slow_mover_count), expr: "COUNT(is_slow_mover AND NOT is_dead_stock)" },
        {
          label: "Total slow-moving value",
          expr: "Σ (Units × Unit Cost) for slow movers",
          value: formatCurrency(metrics.slow_mover_value),
          isFinal: true,
        },
      ];
      return {
        totalRecords: metrics.total_skus,
        includedRecords: metrics.slow_mover_count,
        summary: `${metrics.slow_mover_count} SKUs classified as slow-moving (>${thresholdDays} days of supply)`,
        steps,
      };
    }

    case "stockout_risk": {
      const policy = metrics.active_policy?.policy;
      const safetyDays = policy?.safety_stock_days ?? 15;
      const atRisk = metrics.all_skus
        ? metrics.all_skus.filter(
            (s) => !s.is_dead_stock && s.daily_velocity > 0 && s.units_on_hand <= s.reorder_point_calc
          )
        : metrics.top_risk_items.filter((s) => s.scenario === "CRITICAL" || s.scenario === "WATCH");
      const sample = atRisk.slice(0, 5);
      const steps: LiveCalcStep[] = [
        {
          label: "Reorder Point formula",
          expr: "ROP = (daily_velocity × lead_time_days) + safety_stock\nsafety_stock = daily_velocity × " + safetyDays + " days",
          value: "",
        },
        {
          label: "At-risk classification",
          expr: "stock_qty ≤ ROP  AND  daily_velocity > 0  AND  NOT dead_stock",
          value: "",
        },
        { isHeader: true, label: "Sample at-risk items", value: "" },
        ...sample.map((s) => ({
          label: `${s.product_name} (${s.sku_id})`,
          expr: `${s.units_on_hand} on hand ≤ ROP ${Math.round(s.reorder_point_calc)}, ${isFinite(s.days_stock_remaining) ? Math.round(s.days_stock_remaining) + "d stock" : "—"}`,
          value: s.units_on_hand <= (s.reorder_point_calc * 0.5) ? "⚠ Critical" : "Watch",
          detail: `Lead time: ${s.lead_time_days}d, velocity: ${s.daily_velocity.toFixed(2)} units/day`,
        })),
        { isHeader: true, label: "Summary", value: "" },
        {
          label: "SKUs at stockout risk",
          expr: "COUNT(stock_qty ≤ ROP)",
          value: String(metrics.stockout_risk_count),
          isFinal: true,
        },
        {
          label: "Critical (< 50% of ROP)",
          value: String(metrics.critical_stockout_count),
        },
      ];
      return {
        totalRecords: metrics.total_skus,
        includedRecords: metrics.stockout_risk_count,
        summary: `${metrics.stockout_risk_count} SKUs have stock at or below reorder point`,
        steps,
      };
    }

    case "health_score": {
      const hc = metrics.health_components;
      const p = metrics.active_policy?.policy;
      const wDead = p?.weight_dead_stock ?? 25;
      const wSlow = p?.weight_slow_moving ?? 25;
      const wStock = p?.weight_stockout_risk ?? 50;
      const wAbc = 100 - wDead - wSlow - wStock;
      const steps: LiveCalcStep[] = [
        { isHeader: true, label: "Factor scores (0–100, higher = better)", value: "" },
        {
          label: "Dead Stock Score",
          expr: `100 − (dead_stock_pct × 2)  →  dead_stock_pct = ${hc.dead_stock_pct.toFixed(1)}%`,
          value: `${Math.round(hc.dead_stock_score)} / 100`,
          detail: `Weight: ${wDead}%`,
        },
        {
          label: "Slow Mover Score",
          expr: `100 − slow_mover_pct  →  slow_mover_pct = ${hc.slow_mover_pct.toFixed(1)}%`,
          value: `${Math.round(hc.slow_mover_score)} / 100`,
          detail: `Weight: ${wSlow}%`,
        },
        {
          label: "Stockout Risk Score",
          expr: `100 − (stockout_risk_pct × 3)  →  at_risk_pct = ${hc.stockout_risk_pct.toFixed(1)}%`,
          value: `${Math.round(hc.stockout_score)} / 100`,
          detail: `Weight: ${wStock}%`,
        },
        {
          label: "ABC Quality Score",
          expr: `min(a_revenue_pct / 0.70 × 100, 100)  →  a_revenue_pct = ${hc.a_item_revenue_pct.toFixed(1)}%`,
          value: `${Math.round(hc.abc_score)} / 100`,
          detail: `Weight: ${wAbc}%`,
        },
        { isHeader: true, label: "Composite formula", value: "" },
        {
          label: "Weighted average",
          expr: `(${Math.round(hc.dead_stock_score)} × ${wDead / 100}) + (${Math.round(hc.slow_mover_score)} × ${wSlow / 100}) + (${Math.round(hc.stockout_score)} × ${wStock / 100}) + (${Math.round(hc.abc_score)} × ${wAbc / 100})`,
          value: String(metrics.health_score),
          isFinal: true,
        },
      ];
      return {
        totalRecords: metrics.total_skus,
        includedRecords: metrics.total_skus,
        summary: "Composite score from 4 weighted health factors",
        steps,
      };
    }

    case "abc_analysis": {
      const abc = metrics.abc_summary;
      const aItems = metrics.all_skus
        ? metrics.all_skus.filter((s) => s.abc_class === "A").slice(0, 5)
        : metrics.top_risk_items.filter((s) => s.abc_class === "A").slice(0, 5);
      const p = metrics.active_policy?.policy;
      const aPct = p?.abc_a_pct ?? 70;
      const bPct = p?.abc_b_pct ?? 20;
      const steps: LiveCalcStep[] = [
        {
          label: "ABC classification logic",
          expr: `Rank all SKUs by cumulative revenue contribution:\nA = first ${aPct}% of cumulative value\nB = next ${bPct}% of cumulative value\nC = remaining items`,
          value: "",
        },
        { isHeader: true, label: "Classification results", value: "" },
        {
          label: "A-class items",
          expr: `${abc.a_count} SKUs driving ${abc.a_revenue_pct}% of portfolio value`,
          value: `${abc.a_count} SKUs`,
          detail: `${Math.round((abc.a_count / metrics.total_skus) * 100)}% of SKU count`,
        },
        {
          label: "B-class items",
          expr: `${abc.b_count} SKUs driving ${abc.b_revenue_pct}% of portfolio value`,
          value: `${abc.b_count} SKUs`,
        },
        {
          label: "C-class items",
          expr: `${abc.c_count} SKUs driving ${abc.c_revenue_pct}% of portfolio value`,
          value: `${abc.c_count} SKUs`,
          isFinal: true,
        },
        { isHeader: true, label: "Top A-class items", value: "" },
        ...aItems.map((s) => ({
          label: `${s.product_name} (${s.sku_id})`,
          value: formatCurrency(s.inventory_value),
          detail: `A-class · ${s.scenario}`,
        })),
      ];
      return {
        totalRecords: metrics.total_skus,
        includedRecords: metrics.total_skus,
        summary: `${abc.a_count} A-items drive ${abc.a_revenue_pct}% of portfolio value`,
        steps,
      };
    }

    case "turnover_ratio": {
      const steps: LiveCalcStep[] = [
        {
          label: "Turnover ratio formula",
          expr: "Turnover = Annualised COGS ÷ Average Inventory Value\nAnnualised COGS = daily_velocity × 365 × unit_cost",
          value: "",
        },
        {
          label: "Portfolio turnover ratio",
          expr: `Σ(annualised_cogs) ÷ total_inventory_value`,
          value: `${metrics.turnover_ratio.toFixed(2)}×`,
          isFinal: true,
          detail: metrics.turnover_ratio >= 4 ? "Good — stock turns at least quarterly" : metrics.turnover_ratio >= 2 ? "Average — room to improve" : "Low — inventory may be overstocked",
        },
        {
          label: "Benchmark context",
          expr: "Industry average: 4–8× | Good: ≥ 4× | Poor: < 2×",
          value: "",
        },
      ];
      return {
        totalRecords: metrics.total_skus,
        includedRecords: metrics.total_skus,
        summary: `Overall portfolio turns ${metrics.turnover_ratio.toFixed(2)} times per year`,
        steps,
      };
    }

    case "recoverable_capital": {
      const steps: LiveCalcStep[] = [
        {
          label: "Recoverable capital components",
          expr: "Recoverable = Dead Stock Value + Slow Moving Value",
          value: "",
        },
        {
          label: "Dead stock component",
          expr: `${metrics.dead_stock_count} dead stock SKUs`,
          value: formatCurrency(metrics.dead_stock_value),
        },
        {
          label: "Slow-moving component",
          expr: `${metrics.slow_mover_count} slow-moving SKUs`,
          value: formatCurrency(metrics.slow_mover_value),
        },
        {
          label: "Total recoverable capital",
          expr: `${formatCurrency(metrics.dead_stock_value)} + ${formatCurrency(metrics.slow_mover_value)}`,
          value: formatCurrency(metrics.recoverable_capital),
          isFinal: true,
          detail: `= ${((metrics.recoverable_capital / metrics.total_inventory_value) * 100).toFixed(1)}% of total inventory value`,
        },
      ];
      return {
        totalRecords: metrics.total_skus,
        includedRecords: metrics.dead_stock_count + metrics.slow_mover_count,
        summary: `Capital tied up in non-performing stock`,
        steps,
      };
    }

    case "reorder_count": {
      const recs = metrics.reorder_recommendations;
      const immediate = recs.filter((r) => r.urgency === "immediate").length;
      const thisWeek = recs.filter((r) => r.urgency === "this_week").length;
      const steps: LiveCalcStep[] = [
        {
          label: "Reorder triggered when",
          expr: "stock_qty ≤ ROP  AND  daily_velocity > 0  AND  lead_time_days > 0",
          value: "",
        },
        { isHeader: true, label: "By urgency", value: "" },
        { label: "Immediate (stockout imminent)", value: String(immediate), detail: "< 7 days remaining" },
        { label: "This week", value: String(thisWeek), detail: "7–14 days remaining" },
        { label: "This month", value: String(recs.length - immediate - thisWeek), detail: "14–30 days remaining" },
        {
          label: "Total reorder recommendations",
          value: String(metrics.reorder_count),
          isFinal: true,
          expr: "COUNT(items requiring reorder)",
        },
      ];
      return {
        totalRecords: metrics.total_skus,
        includedRecords: metrics.reorder_count,
        summary: `${metrics.reorder_count} SKUs have fallen to or below their reorder point`,
        steps,
      };
    }

    default:
      return {
        totalRecords: metrics.total_skus,
        includedRecords: 0,
        summary: "Calculation details not available for this KPI.",
        steps: [],
      };
  }
}

// ── Plain-English "Why am I seeing this?" ────────────────────────────────────

export function getWhyExplanation(
  key: KPIKey,
  metrics: DashboardMetrics
): WhyExplanation {
  const hc = metrics.health_components;

  switch (key) {

    case "health_score": {
      const score = metrics.health_score;
      const dominantIssue =
        hc.dead_stock_score < hc.slow_mover_score && hc.dead_stock_score < hc.stockout_score
          ? "dead stock"
          : hc.stockout_score < hc.slow_mover_score
          ? "stockout risk"
          : "slow-moving inventory";
      const label = score >= 80 ? "healthy" : score >= 60 ? "moderate" : score >= 40 ? "concerning" : "critical";
      return {
        headline: `Your inventory health is ${label} at ${score}/100`,
        body: `The score is calculated from four factors: dead stock (${Math.round(hc.dead_stock_score)}/100), slow movers (${Math.round(hc.slow_mover_score)}/100), stockout risk (${Math.round(hc.stockout_score)}/100), and ABC quality (${Math.round(hc.abc_score)}/100). The primary drag on your score is ${dominantIssue}.`,
        impact: `A score below 60 typically signals that more than 20% of capital is locked in non-performing stock or that stockout risk is high enough to affect customer service levels.`,
        action: `Focus on reducing ${dominantIssue} first — this will have the highest impact on your score. Even a 10-point improvement in the worst-performing factor can move the overall score by 3–5 points.`,
        confidence: "High",
        audience: ["CEO", "Finance Manager", "Supply Chain Manager", "Operations"],
      };
    }

    case "dead_stock": {
      const pct = hc.dead_stock_pct;
      const policy = metrics.active_policy?.policy;
      const thresholdDays = policy?.dead_stock_days ?? 365;
      return {
        headline: `${metrics.dead_stock_count} items have had no sales in over ${thresholdDays} days`,
        body: `These ${metrics.dead_stock_count} SKUs represent ${pct.toFixed(1)}% of your portfolio by value — ${formatCurrency(metrics.dead_stock_value)}. They have a daily sales velocity of zero, meaning no units are being sold and stock levels are not decreasing. Left unaddressed, this ties up working capital and incurs ongoing storage costs.`,
        impact: `At a 25% annual carrying cost rate, this dead stock is costing approximately ${formatCurrency(metrics.dead_stock_value * 0.25)} per year in holding costs alone, without generating any revenue.`,
        action: `Consider running a liquidation discount campaign for these items, returning them to suppliers if possible, or writing off stock that has no realistic sales path. Freeing this capital could fund faster-moving inventory.`,
        confidence: "High",
        audience: ["CEO", "Finance Manager", "Warehouse Manager"],
      };
    }

    case "slow_moving": {
      const policy = metrics.active_policy?.policy;
      const thresholdDays = policy?.slow_moving_days ?? 180;
      return {
        headline: `${metrics.slow_mover_count} items are moving significantly slower than expected`,
        body: `Slow movers are items that still have some sales activity but are moving so slowly that their stock-on-hand would last more than ${thresholdDays} days at the current rate. This dataset shows ${metrics.slow_mover_count} such SKUs worth ${formatCurrency(metrics.slow_mover_value)}.`,
        impact: `Slow movers tie up shelf space and working capital. If these items become dead stock, the value at risk grows to ${formatCurrency(metrics.slow_mover_value)}. Early intervention is significantly cheaper than liquidation.`,
        action: `Identify whether slow movers are seasonal (in which case they may self-correct) or structurally slow (demand has permanently declined). For structural slow movers, consider bundling, promotions, or reducing future order quantities.`,
        confidence: "High",
        audience: ["Supply Chain Manager", "Procurement", "Operations"],
      };
    }

    case "stockout_risk": {
      const policy = metrics.active_policy?.policy;
      const safetyDays = policy?.safety_stock_days ?? 15;
      return {
        headline: `${metrics.stockout_risk_count} items may run out of stock before the next delivery`,
        body: `These ${metrics.stockout_risk_count} SKUs have current stock levels at or below their reorder point — the minimum quantity needed to cover expected demand during the supplier lead time plus a ${safetyDays}-day safety buffer. If no action is taken, these items risk becoming unavailable to customers before a replenishment order arrives.`,
        impact: `Stockouts directly cost revenue through lost sales, and indirectly through customer dissatisfaction and order cancellations. The ${metrics.critical_stockout_count} critical items are the most urgent — they may stock out within days.`,
        action: `Raise purchase orders for the ${metrics.critical_stockout_count} critical items immediately. Review the remaining ${metrics.stockout_risk_count - metrics.critical_stockout_count} watch-level items and prioritise those with the longest lead times.`,
        confidence: "High",
        audience: ["Procurement", "Supply Chain Manager", "Operations"],
      };
    }

    case "abc_analysis": {
      const abc = metrics.abc_summary;
      return {
        headline: `${abc.a_count} A-class items drive ${abc.a_revenue_pct}% of your portfolio value`,
        body: `ABC analysis ranks every item by its contribution to total inventory value. A-class items (${abc.a_count} SKUs, ${Math.round((abc.a_count / metrics.total_skus) * 100)}% of your range) account for ${abc.a_revenue_pct}% of value. B-class items (${abc.b_count} SKUs) account for ${abc.b_revenue_pct}%, and C-class (${abc.c_count} SKUs) account for the rest.`,
        impact: `Mismanaging A-class items — either by stocking out or over-ordering — has an outsized financial impact. B and C items offer opportunities to reduce carrying cost without significant revenue risk.`,
        action: `Apply tighter reorder policies and shorter review cycles to A-class items. For C-class items, consider rationalising the range — eliminating slow-sellers reduces complexity and frees capital for high-performers.`,
        confidence: "High",
        audience: ["CEO", "Finance Manager", "Procurement"],
      };
    }

    case "inventory_value": {
      return {
        headline: `Your total inventory is valued at ${formatCurrency(metrics.total_inventory_value)}`,
        body: `This is the sum of (units on hand × unit cost) for all ${metrics.total_skus} SKUs in your uploaded file. It represents the total capital currently locked in physical stock. The annual carrying cost — storage, insurance, obsolescence, and capital cost — is estimated at ${formatCurrency(metrics.annual_carrying_cost)} (25% of inventory value, standard industry rate).`,
        impact: `Every dollar of inventory that is not generating sales is incurring carrying costs. ${formatCurrency(metrics.recoverable_capital)} (${((metrics.recoverable_capital / metrics.total_inventory_value) * 100).toFixed(0)}% of total value) is in dead or slow-moving stock.`,
        action: `Compare your inventory value to your monthly revenue to assess turns. If inventory exceeds 3 months of cost of goods sold, there is likely over-stocking that warrants a buying freeze on slow categories.`,
        confidence: "High",
        audience: ["CEO", "Finance Manager"],
      };
    }

    case "turnover_ratio": {
      const turns = metrics.turnover_ratio;
      const label = turns >= 6 ? "excellent" : turns >= 4 ? "healthy" : turns >= 2 ? "below average" : "poor";
      return {
        headline: `Your inventory turns ${turns.toFixed(1)} times per year — ${label}`,
        body: `Inventory turnover measures how many times your average stock is sold and replaced in a year. A higher number means faster-moving inventory and less capital tied up at any given time. Your ratio of ${turns.toFixed(1)}× compares to an industry benchmark of 4–8× for most distribution businesses.`,
        impact: `Increasing turnover from ${turns.toFixed(1)}× to 4× would reduce average inventory investment by approximately ${formatCurrency(metrics.total_inventory_value * (1 - turns / 4))} while maintaining the same sales volume.`,
        action: `Focus reorder policies on buying smaller quantities more frequently for high-velocity items. For low-velocity items, reduce safety stock targets and consider demand-driven purchasing rather than periodic replenishment.`,
        confidence: "Medium",
        audience: ["CEO", "Finance Manager", "Supply Chain Manager"],
      };
    }

    case "recoverable_capital": {
      return {
        headline: `${formatCurrency(metrics.recoverable_capital)} is locked in non-performing stock`,
        body: `This figure combines dead stock (${formatCurrency(metrics.dead_stock_value)} across ${metrics.dead_stock_count} SKUs) and slow-moving inventory (${formatCurrency(metrics.slow_mover_value)} across ${metrics.slow_mover_count} SKUs). These items are generating little or no revenue and are actively costing money through carrying costs.`,
        impact: `If even 30% of this capital were recovered through liquidation or write-downs, it could free ${formatCurrency(metrics.recoverable_capital * 0.3)} for investment in faster-moving stock, reducing carrying costs and improving cash flow.`,
        action: `Prioritise dead stock for immediate action (liquidation, return to supplier, or write-off). For slow movers, a targeted clearance promotion often recovers 40–60% of book value while freeing shelf space.`,
        confidence: "High",
        audience: ["CEO", "Finance Manager"],
      };
    }

    case "reorder_count": {
      return {
        headline: `${metrics.reorder_count} items need to be reordered now`,
        body: `These items have stock levels at or below their calculated reorder point. The reorder point is the minimum stock needed to cover expected demand during the supplier delivery lead time, plus a safety buffer. Waiting longer increases the risk of stockouts.`,
        impact: `The ${metrics.critical_stockout_count} critical items are most urgent — their stock may be exhausted before the next scheduled delivery. Each stockout event typically costs 1.5–3× the product margin in lost revenue and rush order premiums.`,
        action: `Export the purchase order draft from the dashboard and send to your procurement team today. Prioritise items marked "Immediate" — they require same-day action.`,
        confidence: "High",
        audience: ["Procurement", "Supply Chain Manager", "Operations"],
      };
    }

    default:
      return {
        headline: "Analytics explanation",
        body: "This metric is calculated directly from your uploaded inventory data.",
        impact: "Monitor this value regularly as part of your inventory management routine.",
        action: "Review the Formula and Supporting Data tabs for full calculation details.",
        confidence: "Medium",
        audience: ["Supply Chain Manager"],
      };
  }
}

// ── Data Lineage ──────────────────────────────────────────────────────────────

const FIELD_MAP: Record<KPIKey, { column: string; role: string; required: boolean }[]> = {
  inventory_value: [
    { column: "units_on_hand", role: "Stock quantity",   required: true },
    { column: "unit_cost",     role: "Per-unit cost",    required: true },
  ],
  dead_stock: [
    { column: "units_on_hand",      role: "Stock quantity",     required: true },
    { column: "unit_cost",          role: "Per-unit cost",      required: true },
    { column: "last_movement_date", role: "Days-since-sale",    required: false },
    { column: "monthly_usage",      role: "Sales velocity",     required: true },
  ],
  slow_moving: [
    { column: "units_on_hand",  role: "Stock quantity",  required: true },
    { column: "monthly_usage",  role: "Sales velocity",  required: true },
    { column: "unit_cost",      role: "Per-unit cost",   required: true },
  ],
  stockout_risk: [
    { column: "units_on_hand",  role: "Stock quantity",  required: true },
    { column: "monthly_usage",  role: "Sales velocity",  required: true },
    { column: "lead_time",      role: "Supplier lead time", required: false },
    { column: "unit_cost",      role: "Per-unit cost",   required: false },
  ],
  health_score: [
    { column: "units_on_hand",  role: "Stock quantity",  required: true },
    { column: "monthly_usage",  role: "Sales velocity",  required: true },
    { column: "unit_cost",      role: "Per-unit cost",   required: true },
    { column: "lead_time",      role: "Supplier lead time", required: false },
  ],
  abc_analysis: [
    { column: "units_on_hand",  role: "Stock quantity",  required: true },
    { column: "unit_cost",      role: "Per-unit cost",   required: true },
  ],
  turnover_ratio: [
    { column: "units_on_hand",  role: "Stock quantity",  required: true },
    { column: "unit_cost",      role: "Per-unit cost",   required: true },
    { column: "monthly_usage",  role: "Sales velocity",  required: true },
  ],
  recoverable_capital: [
    { column: "units_on_hand",  role: "Stock quantity",  required: true },
    { column: "unit_cost",      role: "Per-unit cost",   required: true },
    { column: "monthly_usage",  role: "Sales velocity",  required: true },
  ],
  reorder_count: [
    { column: "units_on_hand",  role: "Stock quantity",  required: true },
    { column: "monthly_usage",  role: "Sales velocity",  required: true },
    { column: "lead_time",      role: "Supplier lead time", required: true },
  ],
  ageing_score: [
    { column: "ageing_days",        role: "Days since last movement", required: true },
    { column: "units_on_hand",      role: "Stock quantity",           required: true },
    { column: "unit_cost",          role: "Per-unit cost",            required: false },
  ],
  blocked_capital: [
    { column: "units_on_hand",  role: "Stock quantity",  required: true },
    { column: "unit_cost",      role: "Per-unit cost",   required: true },
    { column: "ageing_days",    role: "Ageing days",     required: true },
  ],
  avg_ageing_days: [
    { column: "ageing_days",    role: "Days since last movement", required: true },
    { column: "units_on_hand",  role: "Stock quantity",           required: false },
  ],
};

export function getDataLineage(
  key: KPIKey,
  detectedFields: string[],
  activePolicy?: ActivePolicy | null
): DataLineage {
  const fields = (FIELD_MAP[key] ?? []).map((f) => ({
    columnName: f.column,
    role: f.role,
    required: f.required,
    detected: detectedFields.some(
      (d) => d.toLowerCase().includes(f.column.toLowerCase().replace(/_/g, " ").split(" ")[0])
    ),
  }));

  const policy = activePolicy?.policy;
  const sources = activePolicy?.field_sources ?? {};
  const policySource = activePolicy?.source ?? "system";

  const policyFields: DataLineage["policyFields"] = [];
  if (policy) {
    const relevantFields: Array<{ field: keyof typeof policy; label: string }> = [
      { field: "slow_moving_days",       label: "Slow moving threshold" },
      { field: "dead_stock_days",        label: "Dead stock threshold" },
      { field: "critical_coverage_days", label: "Critical coverage days" },
      { field: "safety_stock_days",      label: "Safety stock days" },
      { field: "abc_a_pct",              label: "ABC A-class threshold" },
      { field: "abc_b_pct",              label: "ABC B-class threshold" },
    ];
    for (const { field, label } of relevantFields) {
      if (policy[field] != null) {
        policyFields.push({
          field: label,
          value: policy[field] as number,
          source: sources[field] ?? "system",
        });
      }
    }
  }

  return {
    source: "Uploaded Excel/CSV file",
    fields,
    policySource,
    policyFields,
    trustStatement:
      "All calculations are performed client-side in your browser using only your uploaded data. No data is sent to any server.",
  };
}

// ── Score Breakdown ───────────────────────────────────────────────────────────

export function buildScoreBreakdown(metrics: DashboardMetrics): ScoreBreakdown {
  const hc = metrics.health_components;
  const p = metrics.active_policy?.policy;
  const wDead  = (p?.weight_dead_stock    ?? 25) / 100;
  const wSlow  = (p?.weight_slow_moving   ?? 25) / 100;
  const wStock = (p?.weight_stockout_risk ?? 50) / 100;
  const wAbc   = Math.max(0, 1 - wDead - wSlow - wStock);

  const deductions: ScoreDeduction[] = [
    {
      factor: "Dead Stock",
      weight: Math.round(wDead * 100),
      rawScore: Math.round(hc.dead_stock_score),
      contribution: Math.round(hc.dead_stock_score * wDead),
      deduction: Math.round((100 - hc.dead_stock_score) * wDead),
      detail: `${hc.dead_stock_pct.toFixed(1)}% of SKUs classified as dead (no movement ≥ ${p?.dead_stock_days ?? 365} days)`,
    },
    {
      factor: "Slow Moving",
      weight: Math.round(wSlow * 100),
      rawScore: Math.round(hc.slow_mover_score),
      contribution: Math.round(hc.slow_mover_score * wSlow),
      deduction: Math.round((100 - hc.slow_mover_score) * wSlow),
      detail: `${hc.slow_mover_pct.toFixed(1)}% of SKUs moving slower than ${p?.slow_moving_days ?? 180}-day threshold`,
    },
    {
      factor: "Stockout Risk",
      weight: Math.round(wStock * 100),
      rawScore: Math.round(hc.stockout_score),
      contribution: Math.round(hc.stockout_score * wStock),
      deduction: Math.round((100 - hc.stockout_score) * wStock),
      detail: `${hc.stockout_risk_pct.toFixed(1)}% of SKUs at or below reorder point`,
    },
    {
      factor: "ABC Quality",
      weight: Math.round(wAbc * 100),
      rawScore: Math.round(hc.abc_score),
      contribution: Math.round(hc.abc_score * wAbc),
      deduction: Math.round((100 - hc.abc_score) * wAbc),
      detail: `A-items drive ${hc.a_item_revenue_pct.toFixed(1)}% of portfolio value`,
    },
  ];

  const formula = `(${Math.round(hc.dead_stock_score)} × ${Math.round(wDead * 100)}%) + (${Math.round(hc.slow_mover_score)} × ${Math.round(wSlow * 100)}%) + (${Math.round(hc.stockout_score)} × ${Math.round(wStock * 100)}%) + (${Math.round(hc.abc_score)} × ${Math.round(wAbc * 100)}%)`;

  return {
    baseScore: 100,
    finalScore: metrics.health_score,
    deductions,
    formula,
  };
}

// ── Validation Export ─────────────────────────────────────────────────────────

export function buildValidationExport(
  metrics: DashboardMetrics,
  filename: string,
  detectedFields: string[]
): string {
  const lines: string[] = [
    "SupplySense AI — Validation Report",
    `Generated: ${new Date().toISOString()}`,
    `Source file: ${filename}`,
    `Total SKUs analysed: ${metrics.total_skus}`,
    "",
    "=== KPI VALUES ===",
    `Health Score,${metrics.health_score}/100`,
    `Inventory Value,${formatCurrency(metrics.total_inventory_value)}`,
    `Dead Stock Count,${metrics.dead_stock_count}`,
    `Dead Stock Value,${formatCurrency(metrics.dead_stock_value)}`,
    `Slow Moving Count,${metrics.slow_mover_count}`,
    `Slow Moving Value,${formatCurrency(metrics.slow_mover_value)}`,
    `Stockout Risk Count,${metrics.stockout_risk_count}`,
    `Critical Stockout Count,${metrics.critical_stockout_count}`,
    `Recoverable Capital,${formatCurrency(metrics.recoverable_capital)}`,
    `Turnover Ratio,${metrics.turnover_ratio.toFixed(2)}x`,
    `Reorder Count,${metrics.reorder_count}`,
    "",
    "=== HEALTH SCORE BREAKDOWN ===",
    `Dead Stock Score (factor),${Math.round(metrics.health_components.dead_stock_score)}/100`,
    `Slow Mover Score (factor),${Math.round(metrics.health_components.slow_mover_score)}/100`,
    `Stockout Risk Score (factor),${Math.round(metrics.health_components.stockout_score)}/100`,
    `ABC Quality Score (factor),${Math.round(metrics.health_components.abc_score)}/100`,
    `Composite Score,${metrics.health_score}/100`,
    "",
    "=== ACTIVE POLICY ===",
    `Policy Source,${metrics.active_policy?.source ?? "system defaults"}`,
    `Dead Stock Threshold,${metrics.active_policy?.policy.dead_stock_days ?? 365} days`,
    `Slow Moving Threshold,${metrics.active_policy?.policy.slow_moving_days ?? 180} days`,
    `Safety Stock Days,${metrics.active_policy?.policy.safety_stock_days ?? 15} days`,
    `Critical Coverage Days,${metrics.active_policy?.policy.critical_coverage_days ?? 30} days`,
    `ABC A Threshold,${metrics.active_policy?.policy.abc_a_pct ?? 70}%`,
    "",
    "=== DETECTED COLUMNS ===",
    detectedFields.join(", "),
    "",
    "=== FORMULA LIBRARY ===",
    "Inventory Value,SUM(units_on_hand × unit_cost)",
    "Dead Stock,units where daily_velocity=0 AND days_since_last_sale >= threshold",
    "Slow Moving,units where days_of_supply > slow_moving_threshold AND NOT dead_stock",
    "Stockout Risk,units where stock_qty <= ROP AND daily_velocity > 0",
    "ROP,daily_velocity × lead_time_days + safety_stock_days × daily_velocity",
    "Health Score,weighted average of 4 factor scores",
    "Turnover Ratio,annualised_COGS / average_inventory_value",
    "",
    "=== TRUST STATEMENT ===",
    "All analytics are generated directly from uploaded data and can be independently verified.",
    "No external data sources, estimates, or third-party benchmarks are used unless explicitly stated.",
    "This report can be independently audited against the source file.",
  ];
  return lines.join("\n");
}
