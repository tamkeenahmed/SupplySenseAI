"use client";
import { useState } from "react";
import { ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildScoreBreakdown } from "@/lib/validation-engine";
import type { DashboardMetrics } from "@/lib/types";

interface ScoreBreakdownProps {
  metrics: DashboardMetrics;
  className?: string;
}

export function ScoreBreakdown({ metrics, className }: ScoreBreakdownProps) {
  const [expanded, setExpanded] = useState(false);
  const bd = buildScoreBreakdown(metrics);

  const factorColor = (score: number) =>
    score >= 80 ? "#10b981" : score >= 60 ? "#3b82f6" : score >= 40 ? "#f59e0b" : "#ef4444";

  const scoreColor = (score: number) =>
    score >= 80 ? "text-emerald-400" : score >= 60 ? "text-blue-400" : score >= 40 ? "text-amber-400" : "text-red-400";

  return (
    <div className={cn("rounded-xl border border-white/8 overflow-hidden", className)}
      style={{ background: "#0f172a" }}>

      {/* Header row — always visible */}
      <button
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-white/3 transition-colors text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#818cf8]" />
          <span className="text-xs font-semibold text-white">Score Breakdown</span>
          <span className="text-[10px] text-slate-500">How {bd.finalScore} was calculated</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-bold tabular-nums", scoreColor(bd.finalScore))}>
            {bd.finalScore} / 100
          </span>
          {expanded
            ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
            : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          }
        </div>
      </button>

      {/* Expanded breakdown */}
      {expanded && (
        <div className="border-t border-white/6 px-4 py-4 space-y-4">

          {/* Base score */}
          <div className="flex items-center justify-between py-2 border-b border-white/5">
            <span className="text-xs text-slate-400">Base Score</span>
            <span className="text-xs font-bold text-white tabular-nums">100</span>
          </div>

          {/* Factor contributions */}
          {bd.deductions.map((d) => {
            const color = factorColor(d.rawScore);
            return (
              <div key={d.factor} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-300">{d.factor}</span>
                      <span className="text-[10px] text-slate-600">({d.weight}% weight)</span>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-0.5 leading-snug">{d.detail}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-bold tabular-nums" style={{ color }}>
                      {d.rawScore}/100
                    </p>
                    <p className="text-[10px] text-slate-600">
                      {d.deduction > 0 ? `−${d.deduction} pts` : "no impact"}
                    </p>
                  </div>
                </div>
                {/* Mini bar */}
                <div className="h-1 bg-white/6 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${d.rawScore}%`, background: color }}
                  />
                </div>
              </div>
            );
          })}

          {/* Final score row */}
          <div className="pt-3 border-t border-white/6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-white">Final Health Score</p>
                <p className="text-[10px] text-slate-600 mt-0.5 font-mono break-all">{bd.formula}</p>
              </div>
              <span className={cn("text-xl font-bold tabular-nums ml-3", scoreColor(bd.finalScore))}>
                {bd.finalScore}
              </span>
            </div>
          </div>

          {/* Trust note */}
          <div className="flex items-center gap-1.5 pt-1">
            <ShieldCheck className="w-3 h-3 text-emerald-400 flex-shrink-0" />
            <p className="text-[10px] text-slate-600">
              Calculated from {metrics.total_skus} SKUs in your uploaded file.
              <a href="/dashboard/kpi/health_score" target="_blank" className="text-[#818cf8] hover:text-white ml-1 underline underline-offset-2">
                Full formula →
              </a>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
