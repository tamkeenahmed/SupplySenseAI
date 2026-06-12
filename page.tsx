"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Settings, ArrowLeft, CheckCircle2, Building2, DollarSign,
  Calendar, RotateCcw,
} from "lucide-react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { Palette } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Preferences {
  company_name: string;
  currency: string;
  date_format: string;
  dead_stock_threshold: number;
  slow_mover_threshold: number;
}

const DEFAULTS: Preferences = {
  company_name: "",
  currency: "USD",
  date_format: "MM/DD/YYYY",
  dead_stock_threshold: 181,
  slow_mover_threshold: 91,
};

const STORAGE_KEY = "supplysense_preferences";

function loadPrefs(): Preferences {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULTS;
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, label, desc }: { icon: React.ElementType; label: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 pb-4 border-b border-white/5">
      <div className="w-8 h-8 rounded-lg bg-[#6366f1]/15 flex items-center justify-center flex-shrink-0">
        <Icon className="w-3.5 h-3.5 text-[#818cf8]" />
      </div>
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-[11px] text-slate-500 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-xs font-medium text-slate-300">{label}</p>
        {hint && <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{hint}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PreferencesPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  function update<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setPrefs((p) => ({ ...p, [key]: value }));
    setDirty(true);
    setSaved(false);
  }

  function handleSave() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      setSaved(true);
      setDirty(false);
      setTimeout(() => setSaved(false), 3000);
    } catch { /* ignore */ }
  }

  function handleReset() {
    setPrefs(DEFAULTS);
    localStorage.removeItem(STORAGE_KEY);
    setDirty(false);
    setSaved(false);
  }

  const inputCls = "bg-white/4 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#6366f1]/50 focus:bg-white/6 transition-colors w-52";
  const selectCls = inputCls + " cursor-pointer";

  return (
    <div className="flex h-screen bg-[#020617] ss-page overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="nav-glass sticky top-0 z-30 flex-shrink-0">
          <div className="flex items-center h-[46px] px-4 gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:bg-white/5">
              <Settings className="w-4 h-4" />
            </button>
            <Link href="/dashboard" className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
            </Link>
            <span className="text-slate-700">/</span>
            <span className="text-xs text-white font-medium">Preferences</span>
            <div className="flex-1" />
            {/* Save / reset actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
              >
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
              <button
                onClick={handleSave}
                disabled={!dirty}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                  saved
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                    : dirty
                    ? "bg-[#6366f1] text-white hover:bg-[#4f46e5]"
                    : "bg-white/4 text-slate-600 cursor-not-allowed"
                }`}
              >
                {saved ? (
                  <><CheckCircle2 className="w-3.5 h-3.5" /> Saved</>
                ) : (
                  <>Save preferences</>
                )}
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[680px] mx-auto px-4 py-6 space-y-6">

            {/* Page header */}
            <div>
              <h1 className="text-lg font-bold text-white" style={{ fontFamily: "Syne, sans-serif" }}>
                Preferences
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Customize display settings and analysis thresholds. Preferences are saved in your browser only — no account required.
              </p>
            </div>

            {/* ── Organisation ── */}
            <div className="card p-5 space-y-4">
              <SectionHeader
                icon={Building2}
                label="Organisation"
                desc="Used in report headers and export filenames."
              />
              <FieldRow
                label="Company / Organisation name"
                hint="Appears on exported reports and the AI executive brief."
              >
                <input
                  type="text"
                  value={prefs.company_name}
                  onChange={(e) => update("company_name", e.target.value)}
                  placeholder="e.g. Acme Industries"
                  className={inputCls}
                />
              </FieldRow>
            </div>

            {/* ── Colour theme ── */}
            <div className="card p-5 space-y-4">
              <SectionHeader
                icon={Palette}
                label="Colour Theme"
                desc="Choose how SupplySense looks across all pages. Saved automatically."
              />
              <ThemeSwitcher variant="full" />
            </div>

            {/* ── Display ── */}
            <div className="card p-5 space-y-4">
              <SectionHeader
                icon={DollarSign}
                label="Display"
                desc="Controls how values are shown across the dashboard and exports."
              />
              <FieldRow
                label="Currency"
                hint="Applied to all monetary values displayed in the dashboard."
              >
                <select
                  value={prefs.currency}
                  onChange={(e) => update("currency", e.target.value)}
                  className={selectCls}
                >
                  <option value="USD">USD — US Dollar ($)</option>
                  <option value="EUR">EUR — Euro (€)</option>
                  <option value="GBP">GBP — British Pound (£)</option>
                  <option value="AED">AED — UAE Dirham (د.إ)</option>
                  <option value="SAR">SAR — Saudi Riyal (﷼)</option>
                  <option value="INR">INR — Indian Rupee (₹)</option>
                  <option value="PKR">PKR — Pakistani Rupee (₨)</option>
                </select>
              </FieldRow>
              <FieldRow
                label="Date format"
                hint="Controls how dates are displayed in tables and exports."
              >
                <select
                  value={prefs.date_format}
                  onChange={(e) => update("date_format", e.target.value)}
                  className={selectCls}
                >
                  <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY (International)</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD (ISO 8601)</option>
                </select>
              </FieldRow>
            </div>


            <p className="text-[11px] text-slate-700 text-center pb-2">
              Preferences are stored in your browser&apos;s localStorage. Clearing browser data will reset them.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
