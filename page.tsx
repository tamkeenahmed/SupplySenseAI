"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, RotateCcw, Save, CheckCircle2, Settings,
  AlertTriangle, Info,
} from "lucide-react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import {
  SYSTEM_DEFAULTS,
  loadUserPolicy,
  saveUserPolicy,
  resetUserPolicy,
  resolvePolicy,
} from "@/lib/policy";
import type { InventoryPolicy } from "@/lib/policy";

// ── Field metadata ─────────────────────────────────────────────────────────────

const THRESHOLD_FIELDS: Array<{
  key: keyof InventoryPolicy;
  label: string;
  description: string;
  unit: string;
  min: number;
  max: number;
}> = [
  {
    key: "slow_moving_days",
    label: "Slow Moving Threshold",
    description: "Items with days-on-hand exceeding this value are classified as slow movers.",
    unit: "days",
    min: 30,
    max: 730,
  },
  {
    key: "dead_stock_days",
    label: "Dead Stock Threshold",
    description: "Items with zero movement for this many days are classified as dead stock.",
    unit: "days",
    min: 60,
    max: 1825,
  },
  {
    key: "critical_coverage_days",
    label: "Critical Coverage Days",
    description: "Items with fewer than this many days of remaining stock are flagged as critical.",
    unit: "days",
    min: 7,
    max: 180,
  },
  {
    key: "safety_stock_days",
    label: "Safety Stock Days",
    description: "Days of demand used as a safety buffer when calculating reorder points.",
    unit: "days",
    min: 1,
    max: 90,
  },
];

const ABC_FIELDS: Array<{
  key: keyof InventoryPolicy;
  label: string;
  description: string;
}> = [
  {
    key: "abc_a_pct",
    label: "A-Class Percentage",
    description: "Cumulative inventory value % that defines the A tier (high-value items).",
  },
  {
    key: "abc_b_pct",
    label: "B-Class Percentage",
    description: "Next % for the B tier. C tier = 100 − A − B (auto-calculated).",
  },
];

const WEIGHT_FIELDS: Array<{
  key: keyof InventoryPolicy;
  label: string;
  description: string;
}> = [
  {
    key: "weight_dead_stock",
    label: "Dead Stock Weight",
    description: "How heavily dead stock penalises the overall health score.",
  },
  {
    key: "weight_slow_moving",
    label: "Slow Moving Weight",
    description: "How heavily slow-moving stock penalises the overall health score.",
  },
  {
    key: "weight_stockout_risk",
    label: "Stockout Risk Weight",
    description: "How heavily stockout risk penalises the overall health score.",
  },
];

// ── Reusable field input ───────────────────────────────────────────────────────

function FieldInput({
  label,
  description,
  value,
  defaultValue,
  unit,
  min,
  max,
  onChange,
  onReset,
  isModified,
}: {
  label: string;
  description: string;
  value: number;
  defaultValue: number;
  unit?: string;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  onReset: () => void;
  isModified: boolean;
}) {
  return (
    <div className="flex items-start gap-4 py-4 border-b border-white/5 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium text-white">{label}</span>
          {isModified && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#6366f1]/15 text-[#818cf8] border border-[#6366f1]/20">
              Modified
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
        <p className="text-[11px] text-slate-600 mt-1">System default: {defaultValue}{unit ? ` ${unit}` : ""}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="relative">
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            onChange={(e) => {
              const n = parseFloat(e.target.value);
              if (!isNaN(n) && n > 0) onChange(n);
            }}
            className="w-24 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white text-right focus:outline-none focus:border-[#6366f1]/60 focus:bg-white/8 transition-colors"
          />
          {unit && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 pointer-events-none">
              {unit}
            </span>
          )}
        </div>
        {isModified && (
          <button
            onClick={onReset}
            title="Reset to default"
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── ABC Visual Bar ─────────────────────────────────────────────────────────────

function ABCBar({ aPct, bPct }: { aPct: number; bPct: number }) {
  const cPct = Math.max(0, 100 - aPct - bPct);
  return (
    <div className="mt-3">
      <div className="flex rounded-lg overflow-hidden h-5 text-[10px] font-medium">
        <div
          className="flex items-center justify-center bg-[#6366f1]/80 text-white transition-all"
          style={{ width: `${aPct}%` }}
        >
          {aPct >= 10 ? `A ${aPct}%` : ""}
        </div>
        <div
          className="flex items-center justify-center bg-blue-500/60 text-white transition-all"
          style={{ width: `${bPct}%` }}
        >
          {bPct >= 10 ? `B ${bPct}%` : ""}
        </div>
        <div
          className="flex items-center justify-center bg-slate-500/40 text-slate-300 transition-all"
          style={{ width: `${cPct}%` }}
        >
          {cPct >= 10 ? `C ${cPct}%` : ""}
        </div>
      </div>
      <div className="flex justify-between text-[10px] text-slate-500 mt-1">
        <span>A: {aPct}% · B: {bPct}% · C: {cPct}%</span>
        {aPct + bPct > 100 && (
          <span className="text-red-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> A + B exceeds 100%
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [values, setValues] = useState<InventoryPolicy>({ ...SYSTEM_DEFAULTS });
  const [savedValues, setSavedValues] = useState<InventoryPolicy>({ ...SYSTEM_DEFAULTS });
  const [sourceInfo, setSourceInfo] = useState<string>("Using System Defaults");
  const [toast, setToast] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Load user policy from localStorage on mount
  useEffect(() => {
    const userPolicy = loadUserPolicy();
    const resolved = resolvePolicy(undefined, userPolicy);
    setValues({ ...resolved.policy });
    setSavedValues({ ...resolved.policy });

    const src = resolved.source;
    setSourceInfo(
      src === "file" ? "File settings active for some fields" :
      src === "user" ? "User preferences active" :
      "Using System Defaults"
    );
    setLoaded(true);
  }, []);

  const set = useCallback((key: keyof InventoryPolicy, val: number) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  }, []);

  const resetField = useCallback((key: keyof InventoryPolicy) => {
    setValues((prev) => ({ ...prev, [key]: SYSTEM_DEFAULTS[key] }));
  }, []);

  const resetSection = useCallback((keys: (keyof InventoryPolicy)[]) => {
    setValues((prev) => {
      const next = { ...prev };
      for (const k of keys) next[k] = SYSTEM_DEFAULTS[k];
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    setValues({ ...SYSTEM_DEFAULTS });
  }, []);

  const handleSave = useCallback(async () => {
    // Build partial policy — only fields that differ from system defaults
    const partial: Partial<InventoryPolicy> = {};
    for (const key of Object.keys(SYSTEM_DEFAULTS) as (keyof InventoryPolicy)[]) {
      if (values[key] !== SYSTEM_DEFAULTS[key]) {
        (partial as Record<string, number>)[key] = values[key];
      }
    }
    saveUserPolicy(partial);
    setSavedValues({ ...values });
    setSourceInfo(
      Object.keys(partial).length > 0 ? "User preferences active" : "Using System Defaults"
    );

    // Re-run analysis with new policy if raw items are available in sessionStorage
    if (typeof window !== "undefined") {
      const rawItemsJson  = sessionStorage.getItem("supplysense_raw_items");
      const filePolicyJson = sessionStorage.getItem("supplysense_file_policy");
      const fieldsJson    = sessionStorage.getItem("supplysense_fields");

      if (rawItemsJson && fieldsJson) {
        try {
          setToast("Re-analysing… ⏳");
          const { analyzeInventoryItems } = await import("@/lib/inventory-analyzer");
          const rawItems     = JSON.parse(rawItemsJson);
          const filePolicy   = filePolicyJson ? JSON.parse(filePolicyJson) : {};
          const detectedFields = JSON.parse(fieldsJson) as string[];
          const activePolicy = resolvePolicy(filePolicy, partial);
          const { metrics }  = analyzeInventoryItems(rawItems, detectedFields, activePolicy);

          sessionStorage.setItem("supplysense_metrics",         JSON.stringify(metrics));
          sessionStorage.setItem("supplysense_policy",          JSON.stringify(activePolicy));
          sessionStorage.setItem("supplysense_metrics_version", "4");

          setToast("Settings saved — dashboard updated ✓");
          setTimeout(() => {
            setToast(null);
            router.push("/dashboard");
          }, 1200);
          return;
        } catch {
          // fall through to plain save toast
        }
      }
    }

    setToast("Settings saved ✓");
    setTimeout(() => setToast(null), 3000);
  }, [values, router]);

  const handleResetAll = useCallback(async () => {
    resetAll();
    resetUserPolicy();
    setSavedValues({ ...SYSTEM_DEFAULTS });
    setSourceInfo("Using System Defaults");

    // Re-run analysis with system defaults if raw items available
    if (typeof window !== "undefined") {
      const rawItemsJson   = sessionStorage.getItem("supplysense_raw_items");
      const filePolicyJson = sessionStorage.getItem("supplysense_file_policy");
      const fieldsJson     = sessionStorage.getItem("supplysense_fields");

      if (rawItemsJson && fieldsJson) {
        try {
          setToast("Resetting analysis… ⏳");
          const { analyzeInventoryItems } = await import("@/lib/inventory-analyzer");
          const rawItems       = JSON.parse(rawItemsJson);
          const filePolicy     = filePolicyJson ? JSON.parse(filePolicyJson) : {};
          const detectedFields = JSON.parse(fieldsJson) as string[];
          const activePolicy   = resolvePolicy(filePolicy, undefined);
          const { metrics }    = analyzeInventoryItems(rawItems, detectedFields, activePolicy);

          sessionStorage.setItem("supplysense_metrics",         JSON.stringify(metrics));
          sessionStorage.setItem("supplysense_policy",          JSON.stringify(activePolicy));
          sessionStorage.setItem("supplysense_metrics_version", "4");

          setToast("Reset to system defaults — dashboard updated ✓");
          setTimeout(() => {
            setToast(null);
            router.push("/dashboard");
          }, 1200);
          return;
        } catch {
          // fall through
        }
      }
    }

    setToast("Reset to system defaults ✓");
    setTimeout(() => setToast(null), 3000);
  }, [resetAll, router]);

  const isModified = (key: keyof InventoryPolicy) => values[key] !== savedValues[key];
  const hasUnsaved = (Object.keys(SYSTEM_DEFAULTS) as (keyof InventoryPolicy)[]).some(
    (k) => values[k] !== savedValues[k]
  );

  const weightSum = values.weight_dead_stock + values.weight_slow_moving + values.weight_stockout_risk;
  const abcOverflow = values.abc_a_pct + values.abc_b_pct > 100;

  if (!loaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#020617]">
        <div className="w-5 h-5 rounded-full border-2 border-[#6366f1] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#020617] overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="nav-glass sticky top-0 z-30 flex-shrink-0">
          <div className="flex items-center h-[46px] px-4 gap-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Dashboard
            </Link>
            <span className="text-slate-700">/</span>
            <span className="text-xs text-white font-medium">Policy Settings</span>
            <div className="ml-auto flex items-center gap-2">
              <span className={`text-[11px] px-2 py-0.5 rounded-full border ${
                sourceInfo.includes("File") ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                sourceInfo.includes("User") ? "bg-[#6366f1]/10 border-[#6366f1]/20 text-[#818cf8]" :
                "bg-slate-500/10 border-slate-500/20 text-slate-400"
              }`}>
                {sourceInfo}
              </span>
            </div>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[720px] mx-auto px-4 py-6 space-y-6">

            {/* Page header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-lg font-bold text-white" style={{ fontFamily: "Syne, sans-serif" }}>
                  Inventory Policy
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure the thresholds used for analysis, classification, and health scoring.
                  Settings are saved locally and apply to all future uploads.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleResetAll}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 border border-white/8 hover:border-white/16 hover:text-white transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset All
                </button>
                <button
                  onClick={handleSave}
                  disabled={!hasUnsaved || abcOverflow}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white bg-[#6366f1] hover:bg-[#4f46e5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save
                </button>
              </div>
            </div>

            {/* Section 1: Inventory Thresholds */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <h2 className="text-sm font-semibold text-white">Inventory Thresholds</h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Days-based cutoffs for classifying items as slow-moving, dead, or at critical stock levels.
                  </p>
                </div>
                <button
                  onClick={() => resetSection(THRESHOLD_FIELDS.map((f) => f.key))}
                  className="text-[11px] text-slate-500 hover:text-[#818cf8] transition-colors flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset section
                </button>
              </div>
              <div className="mt-2">
                {THRESHOLD_FIELDS.map((field) => (
                  <FieldInput
                    key={field.key}
                    label={field.label}
                    description={field.description}
                    value={values[field.key]}
                    defaultValue={SYSTEM_DEFAULTS[field.key]}
                    unit={field.unit}
                    min={field.min}
                    max={field.max}
                    onChange={(v) => set(field.key, v)}
                    onReset={() => resetField(field.key)}
                    isModified={isModified(field.key)}
                  />
                ))}
              </div>
            </div>

            {/* Section 2: ABC Classification */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <h2 className="text-sm font-semibold text-white">ABC Classification</h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Pareto-based tiers by cumulative inventory value. A = high-value, C = low-value.
                  </p>
                </div>
                <button
                  onClick={() => resetSection(ABC_FIELDS.map((f) => f.key))}
                  className="text-[11px] text-slate-500 hover:text-[#818cf8] transition-colors flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset section
                </button>
              </div>
              <div className="mt-2">
                {ABC_FIELDS.map((field) => (
                  <FieldInput
                    key={field.key}
                    label={field.label}
                    description={field.description}
                    value={values[field.key]}
                    defaultValue={SYSTEM_DEFAULTS[field.key]}
                    unit="%"
                    min={1}
                    max={98}
                    onChange={(v) => set(field.key, Math.min(98, Math.round(v)))}
                    onReset={() => resetField(field.key)}
                    isModified={isModified(field.key)}
                  />
                ))}
                <div className="pt-3">
                  <p className="text-[11px] text-slate-500 mb-1">ABC split preview</p>
                  <ABCBar aPct={values.abc_a_pct} bPct={values.abc_b_pct} />
                </div>
              </div>
            </div>

            {/* Section 3: Health Score Weights */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <h2 className="text-sm font-semibold text-white">Health Score Weights</h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Relative importance of each factor when computing the overall health score (0–100).
                    ABC quality gets any remaining weight.
                  </p>
                </div>
                <button
                  onClick={() => resetSection(WEIGHT_FIELDS.map((f) => f.key))}
                  className="text-[11px] text-slate-500 hover:text-[#818cf8] transition-colors flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset section
                </button>
              </div>

              <div className="mt-2">
                {WEIGHT_FIELDS.map((field) => (
                  <FieldInput
                    key={field.key}
                    label={field.label}
                    description={field.description}
                    value={values[field.key]}
                    defaultValue={SYSTEM_DEFAULTS[field.key]}
                    unit="%"
                    min={0}
                    max={100}
                    onChange={(v) => set(field.key, Math.min(100, Math.round(v)))}
                    onReset={() => resetField(field.key)}
                    isModified={isModified(field.key)}
                  />
                ))}
              </div>

              {/* Weight sum indicator */}
              <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-lg border text-[11px] ${
                weightSum <= 100
                  ? "bg-emerald-500/8 border-emerald-500/20 text-emerald-400"
                  : "bg-red-500/8 border-red-500/20 text-red-400"
              }`}>
                {weightSum <= 100 ? (
                  <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                )}
                <span>
                  Dead Stock + Slow Moving + Stockout Risk = <strong>{weightSum}%</strong>
                  {weightSum <= 100
                    ? ` · ABC Quality gets the remaining ${100 - weightSum}%`
                    : " · Total exceeds 100% — please reduce one or more weights"}
                </span>
              </div>

              <div className="flex items-start gap-2 mt-3 px-3 py-2 rounded-lg bg-white/3 border border-white/5">
                <Info className="w-3 h-3 text-slate-500 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-slate-500">
                  If the three weights sum to less than 100, ABC quality automatically receives the remainder.
                  If they sum to exactly 100, ABC quality has no impact on the score.
                </p>
              </div>
            </div>

            {/* Save bar */}
            {hasUnsaved && (
              <div className="sticky bottom-4 flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#0f172a] border border-white/10 shadow-2xl">
                <span className="text-xs text-slate-400">You have unsaved changes.</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={resetAll}
                    className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white border border-white/8 hover:border-white/16 transition-colors"
                  >
                    Discard
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={abcOverflow}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs text-white bg-[#6366f1] hover:bg-[#4f46e5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save settings
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1e293b] border border-white/10 shadow-2xl text-sm text-white animate-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {toast}
        </div>
      )}
    </div>
  );
}
