"use client";
import { useState } from "react";
import { ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrustBadgeProps {
  variant?: "full" | "compact" | "icon";
  className?: string;
}

export function TrustBadge({ variant = "full", className }: TrustBadgeProps) {
  const [tooltipOpen, setTooltipOpen] = useState(false);

  if (variant === "icon") {
    return (
      <div className={cn("relative inline-flex", className)}>
        <button
          onClick={() => setTooltipOpen((v) => !v)}
          className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center hover:bg-emerald-500/25 transition-colors"
          aria-label="Explainable analytics — click for details"
        >
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
        </button>
        {tooltipOpen && (
          <div className="absolute bottom-full right-0 mb-2 w-64 p-3 rounded-xl border border-emerald-500/20 bg-[#0f172a] shadow-xl z-50 text-left">
            <p className="text-xs font-semibold text-emerald-400 mb-1">✓ Fully Explainable Analytics</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Every KPI, score, and recommendation can be traced back to source data and validated independently.
            </p>
            <button onClick={() => setTooltipOpen(false)} className="absolute top-1.5 right-1.5 p-0.5 text-slate-600 hover:text-white">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("relative inline-flex", className)}>
        <button
          onClick={() => setTooltipOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/15 transition-colors"
        >
          <ShieldCheck className="w-3 h-3" />
          Explainable
        </button>
        {tooltipOpen && (
          <div className="absolute bottom-full left-0 mb-2 w-72 p-3.5 rounded-xl border border-emerald-500/20 bg-[#0f172a] shadow-xl z-50">
            <p className="text-xs font-semibold text-emerald-400 mb-1.5">✓ Fully Explainable Analytics</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Every KPI, score, and recommendation can be traced back to source data and validated independently through Validation Mode.
            </p>
            <button onClick={() => setTooltipOpen(false)} className="absolute top-2 right-2 p-0.5 text-slate-600 hover:text-white">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // full
  return (
    <div className={cn(
      "flex items-start gap-3 p-4 rounded-xl border bg-emerald-500/5 border-emerald-500/15",
      className
    )}>
      <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-xs font-semibold text-emerald-400 mb-0.5">✓ Fully Explainable Analytics</p>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          All analytics are generated directly from uploaded data and can be independently verified through Validation Mode.
          Every KPI, score, and recommendation can be traced back to source data.
        </p>
      </div>
    </div>
  );
}
