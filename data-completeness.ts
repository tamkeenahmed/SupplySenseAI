"use client";
/**
 * Data Completeness Advisor
 *
 * Evaluates which canonical fields are present in an uploaded file,
 * computes a 0–100 completeness score, and surfaces which additional
 * fields would unlock more analytical value for the user.
 */

// ---------------------------------------------------------------------------
// Field definitions — each field has a weight and a list of features it unlocks
// ---------------------------------------------------------------------------
export interface FieldDef {
  canonical: string;
  label: string;
  description: string;
  example: string;
  weight: number; // contribution to total score (all weights sum to 100)
  group: "required" | "operational" | "intelligence";
  unlocks: string[]; // feature names that become available when this field is present
}

export const FIELD_DEFS: FieldDef[] = [
  // ── Required (25 pts total) ──────────────────────────────────────────────
  {
    canonical: "item_code",
    label: "Item Code",
    description: "Unique identifier for each SKU",
    example: "SKU-001, PART-XYZ",
    weight: 10,
    group: "required",
    unlocks: ["Item identification", "Duplicate detection"],
  },
  {
    canonical: "item_name",
    label: "Item Name",
    description: "Human-readable product description",
    example: "Bearing 6205, O-Ring 50mm",
    weight: 5,
    group: "required",
    unlocks: ["Named reporting", "Executive summary"],
  },
  {
    canonical: "stock_qty",
    label: "Stock Quantity",
    description: "Current units on hand",
    example: "500, 1200",
    weight: 10,
    group: "required",
    unlocks: ["Inventory overview", "Stock level reporting"],
  },

  // ── Operational (50 pts total) ───────────────────────────────────────────
  {
    canonical: "monthly_usage",
    label: "Monthly Usage",
    description: "Average units consumed or sold per month",
    example: "120, 45",
    weight: 20,
    group: "operational",
    unlocks: [
      "Inventory Health Score",
      "Stockout Risk Analysis",
      "Slow Mover Detection",
      "Dead Stock Identification",
    ],
  },
  {
    canonical: "unit_cost",
    label: "Unit Cost",
    description: "Purchase or standard cost per unit",
    example: "24.50, 8.75",
    weight: 15,
    group: "operational",
    unlocks: [
      "Inventory Value ($)",
      "Dead Stock Value",
      "Recoverable Capital",
      "Carrying Cost Analysis",
      "ABC Value Classification",
    ],
  },
  {
    canonical: "lead_time",
    label: "Lead Time (months)",
    description: "Supplier delivery time in months",
    example: "1.5, 3.0",
    weight: 10,
    group: "operational",
    unlocks: [
      "Reorder Point Calculation",
      "Economic Order Quantity (EOQ)",
      "Safety Stock Calculation",
      "Reorder Recommendations",
    ],
  },
  {
    canonical: "supplier",
    label: "Supplier / Vendor",
    description: "Supplier name for procurement recommendations",
    example: "Acme Corp, Global Parts",
    weight: 5,
    group: "operational",
    unlocks: ["Supplier-level Reorder POs", "Vendor Performance Tracking"],
  },

  // ── Intelligence (25 pts total) ──────────────────────────────────────────
  {
    canonical: "ageing_days",
    label: "Ageing Days",
    description: "Days since last stock movement or receipt",
    example: "45, 180, 365",
    weight: 15,
    group: "intelligence",
    unlocks: [
      "Stock Ageing Analysis",
      "Ageing Bucket Distribution",
      "Liquidation Opportunities",
      "Blocked Capital Analysis",
    ],
  },
  {
    canonical: "last_movement_date",
    label: "Last Movement Date",
    description: "Date of last receipt, issue, or sale",
    example: "2024-08-15",
    weight: 5,
    group: "intelligence",
    unlocks: ["Date-based Ageing Computation", "Movement History"],
  },
  {
    canonical: "category",
    label: "Category / Group",
    description: "Product category or item group",
    example: "Electrical, Bearings",
    weight: 5,
    group: "intelligence",
    unlocks: ["Category-level ABC Analysis", "Category Reporting"],
  },
];

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface MissingFieldAdvice {
  field: FieldDef;
  unlocks: string[];
}

export type CompletenessTier =
  | "basic"    // 0–30
  | "partial"  // 31–60
  | "good"     // 61–85
  | "complete" // 86–100

export interface CompletenessResult {
  score: number;           // 0–100
  tier: CompletenessTier;
  tier_label: string;
  tier_color: string;
  present_fields: FieldDef[];
  missing_fields: FieldDef[];
  current_capabilities: string[];
  missing_advice: MissingFieldAdvice[];
}

// ---------------------------------------------------------------------------
// Compute
// ---------------------------------------------------------------------------

const TIER_MAP: Array<{ min: number; tier: CompletenessTier; label: string; color: string }> = [
  { min: 86, tier: "complete", label: "Complete Analysis",  color: "#10b981" },
  { min: 61, tier: "good",     label: "Most Insights",     color: "#3b82f6" },
  { min: 31, tier: "partial",  label: "Partial Analysis",  color: "#f59e0b" },
  { min: 0,  tier: "basic",    label: "Basic Analysis",    color: "#ef4444" },
];

export function computeCompleteness(detectedFields: string[]): CompletenessResult {
  const present = new Set(detectedFields);

  const present_fields: FieldDef[] = [];
  const missing_fields: FieldDef[] = [];
  let score = 0;

  for (const def of FIELD_DEFS) {
    if (present.has(def.canonical)) {
      present_fields.push(def);
      score += def.weight;
    } else {
      missing_fields.push(def);
    }
  }

  score = Math.min(100, Math.max(0, Math.round(score)));

  const { tier, label, color } = TIER_MAP.find((t) => score >= t.min) ?? TIER_MAP[TIER_MAP.length - 1];

  // Current capabilities = unlocks of all present fields (de-duped)
  const current_capabilities = Array.from(
    new Set(present_fields.flatMap((f) => f.unlocks))
  );

  // Missing advice = only fields that would add meaningful new unlocks
  const missing_advice: MissingFieldAdvice[] = missing_fields
    .filter((f) => f.unlocks.length > 0 && f.group !== "required")
    .map((f) => ({ field: f, unlocks: f.unlocks }));

  return {
    score,
    tier,
    tier_label: label,
    tier_color: color,
    present_fields,
    missing_fields,
    current_capabilities,
    missing_advice,
  };
}

// ---------------------------------------------------------------------------
// Enhanced template content (all columns with sample data)
// ---------------------------------------------------------------------------

export const ENHANCED_TEMPLATE_CSV = `Item Code,Item Name,Category,Supplier,Stock Qty,Monthly Usage,Unit Cost,Lead Time,Ageing Days,Last Movement Date
SKU-001,Widget Type A,Components,Acme Corp,500,120,24.50,1.5,15,2025-05-15
SKU-002,Widget Type B,Components,Acme Corp,80,45,38.00,2.0,62,2025-03-20
SKU-003,Fastener M8x20,Hardware,FastenWorld,2000,600,0.45,1.0,8,2025-06-01
SKU-004,Bearing 6205,Mechanical,GlobalBearing,15,8,12.75,3.0,95,2025-02-25
SKU-005,Fuse 16A,Electrical,ElectroSupply,300,0,1.20,1.0,210,2024-11-01
SKU-006,Gasket Set A,Seals,SealMaster,40,22,18.90,2.5,44,2025-04-28
SKU-007,O-Ring 50mm,Seals,SealMaster,850,30,0.85,1.0,12,2025-05-28
SKU-008,Motor 0.5kW,Motors,MotorDirect,3,2,285.00,6.0,180,2024-12-01
SKU-009,Cable 2.5mm 100m,Electrical,CablePro,12,5,95.00,2.0,55,2025-04-05
SKU-010,Sensor Temp NTC,Electronics,SensorTech,25,18,34.50,4.0,390,2024-06-15
`;

export function downloadEnhancedTemplate(): void {
  const blob = new Blob([ENHANCED_TEMPLATE_CSV], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "SupplySense-Enhanced-Template.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
