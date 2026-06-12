"use client";
import { useEffect, useCallback } from "react";
import { X, ShieldCheck, Users, Zap, TrendingUp, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getWhyExplanation } from "@/lib/validation-engine";
import type { KPIKey } from "@/lib/kpi-definitions";
import type { DashboardMetrics } from "@/lib/types";

interface WhyDrawerProps {
  kpiKey: KPIKey;
  metrics: DashboardMetrics;
  onClose: () => void;
}

const CONFIDENCE_STYLE = {
  High:   "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  Medium: "text-amber-400  bg-amber-500/10  border-amber-500/20",
  Low:    "text-slate-400  bg-slate-500/10  border-slate-500/20",
};

export function WhyDrawer({ kpiKey, metrics, onClose }: WhyDrawerProps) {
  const exp = getWhyExplanation(kpiKey, metrics);

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[1000] bg-black/60"
        style={{ backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />

      {/* Drawer — slides in from right */}
      <div
        className="fixed top-0 right-0 h-full z-[1001] flex flex-col w-full max-w-[420px] border-l border-white/8"
        style={{ background: "#0f172a", boxShadow: "-20px 0 60px rgba(0,0,0,0.6)" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-white/6 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-5 h-5 rounded-md bg-[#6366f1]/20 flex items-center justify-center">
                <Zap className="w-3 h-3 text-[#818cf8]" />
              </div>
              <span className="text-[10px] font-semibold text-[#818cf8] uppercase tracking-widest">
                Why am I seeing this?
              </span>
            </div>
            <h2 className="text-sm font-bold text-white leading-snug" style={{ fontFamily: "Syne, sans-serif" }}>
              {exp.headline}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/8 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* Explanation body */}
          <div className="p-4 rounded-xl bg-white/3 border border-white/6">
            <p className="text-sm text-slate-300 leading-relaxed">{exp.body}</p>
          </div>

          {/* Business Impact */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-semibold text-white">Business Impact</span>
            </div>
            <div className="p-3.5 rounded-xl bg-amber-500/6 border border-amber-500/15">
              <p className="text-sm text-slate-300 leading-relaxed">{exp.impact}</p>
            </div>
          </div>

          {/* Recommended Action */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ArrowRight className="w-3.5 h-3.5 text-[#818cf8]" />
              <span className="text-xs font-semibold text-white">Recommended Action</span>
            </div>
            <div className="p-3.5 rounded-xl bg-[#6366f1]/8 border border-[#6366f1]/20">
              <p className="text-sm text-slate-300 leading-relaxed">{exp.action}</p>
            </div>
          </div>

          {/* Audience + Confidence */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-white/3 border border-white/6">
              <div className="flex items-center gap-1.5 mb-2">
                <Users className="w-3 h-3 text-slate-400" />
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Relevant to</span>
              </div>
              <div className="space-y-1">
                {exp.audience.map((a) => (
                  <p key={a} className="text-xs text-slate-300">{a}</p>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/3 border border-white/6">
              <div className="flex items-center gap-1.5 mb-2">
                <ShieldCheck className="w-3 h-3 text-slate-400" />
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Data confidence</span>
              </div>
              <span className={cn(
                "inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border",
                CONFIDENCE_STYLE[exp.confidence]
              )}>
                {exp.confidence}
              </span>
              <p className="text-[11px] text-slate-600 mt-1.5 leading-snug">
                Based solely on uploaded file data — no estimates
              </p>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-white/5 px-5 py-3 flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <p className="text-[11px] text-slate-500 leading-snug">
            All analytics are generated directly from your uploaded data and can be independently verified.
          </p>
        </div>
      </div>
    </>
  );
}
