"use client";
import { useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Zap } from "lucide-react";
import { DropZone } from "@/components/upload/DropZone";
import { ValidationProgress } from "@/components/upload/ValidationProgress";
import type { UploadResult, AnalysisMode } from "@/lib/types";
import { detectAnalysisMode } from "@/lib/analysis-detector";

type UploadState = "idle" | "processing" | "done" | "error";

export default function UploadPage() {
  const [state, setState] = useState<UploadState>("idle");
  const [step, setStep] = useState(-1);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode | undefined>(undefined);
  const [detectedFields, setDetectedFields] = useState<string[]>([]);

  const handleFile = useCallback(async (file: File) => {
    setCurrentFile(file);
    setState("processing");
    setResult(null);

    // Step 0: Uploading
    setStep(0); setProgress(10);
    await delay(400);

    // Step 1: Parsing columns
    setStep(1); setProgress(28);
    await delay(300);

    // Dynamically import parser + analyzer (client-side)
    const { parseInventoryFile } = await import("@/lib/inventory-parser");
    const { analyzeInventoryItems } = await import("@/lib/inventory-analyzer");
    const { resolvePolicy, loadUserPolicy } = await import("@/lib/policy");

    let parseResult;
    try {
      parseResult = await parseInventoryFile(file);
    } catch (err) {
      const errResult: UploadResult = {
        success: false,
        filename: file.name,
        rows_parsed: 0,
        rows_valid: 0,
        rows_flagged: 0,
        warnings: [],
        errors: [{ code: "ERR", message: String(err) }],
      };
      setResult(errResult);
      setStep(-1);
      setState("error");
      return;
    }

    // Step 2: Validating data
    setStep(2); setProgress(50);
    await delay(400);

    if (parseResult.errors.length > 0) {
      const errResult: UploadResult = {
        success: false,
        filename: file.name,
        rows_parsed: parseResult.rows_parsed,
        rows_valid: parseResult.rows_valid,
        rows_flagged: parseResult.rows_flagged,
        warnings: parseResult.warnings,
        errors: parseResult.errors,
      };
      setResult(errResult);
      setStep(-1);
      setState("error");
      return;
    }

    // Step 3: Running AI analysis
    setStep(3); setProgress(72);
    await delay(600);

    const mode = detectAnalysisMode(parseResult.detected_fields);
    setAnalysisMode(mode);
    setDetectedFields(parseResult.detected_fields);

    const activePolicy = resolvePolicy(parseResult.filePolicy, loadUserPolicy());
    const { metrics, analyzedSkus } = analyzeInventoryItems(parseResult.items, parseResult.detected_fields, activePolicy);

    // Step 4: Generating insights
    setStep(4); setProgress(90);
    await delay(500);

    setProgress(100);
    await delay(300);

    const finalResult: UploadResult = {
      success: true,
      filename: file.name,
      rows_parsed: parseResult.rows_parsed,
      rows_valid: parseResult.rows_valid,
      rows_flagged: parseResult.rows_flagged,
      warnings: parseResult.warnings,
      errors: [],
      metrics,
      analyzed_skus: analyzedSkus.slice(0, 200),
    };

    setResult(finalResult);
    setStep(5);
    setState("done");

    // Store in sessionStorage for dashboard consumption
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("supplysense_metrics",        JSON.stringify(metrics));
        sessionStorage.setItem("supplysense_filename",       file.name);
        sessionStorage.setItem("supplysense_rows",           String(parseResult.rows_valid));
        sessionStorage.setItem("supplysense_fields",         JSON.stringify(parseResult.detected_fields));
        sessionStorage.setItem("supplysense_policy",         JSON.stringify(activePolicy));
        sessionStorage.setItem("supplysense_metrics_version","4");
        // Store raw items + file policy so settings changes can re-run analysis
        // without requiring a file re-upload
        sessionStorage.setItem("supplysense_raw_items",      JSON.stringify(parseResult.items));
        sessionStorage.setItem("supplysense_file_policy",    JSON.stringify(parseResult.filePolicy ?? {}));
      } catch {
        // storage quota — ignore (large files may not fit; re-upload will be needed)
      }
    }
  }, []);

  const handleReset = useCallback(() => {
    setState("idle");
    setStep(-1);
    setProgress(0);
    setResult(null);
    setCurrentFile(null);
    setAnalysisMode(undefined);
    setDetectedFields([]);
  }, []);

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col">
      {/* Topbar */}
      <header className="nav-glass sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#6366f1] flex items-center justify-center">
              <span className="text-white text-[10px] font-bold" style={{ fontFamily: "Syne, sans-serif" }}>S</span>
            </div>
            <span className="text-sm font-semibold text-white" style={{ fontFamily: "Syne, sans-serif" }}>SupplySense AI</span>
          </div>
          <Link
            href="/dashboard"
            className="text-xs text-slate-500 hover:text-brand-300 transition-colors"
          >
            View demo →
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-[520px]">
          {/* Page header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-[#6366f1]/10 text-[#818cf8] border border-[#6366f1]/20 mb-4">
              <Zap className="w-3 h-3" />
              60-second analysis
            </div>
            <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: "Syne, sans-serif" }}>
              Upload your inventory file
            </h1>
            <p className="text-sm text-slate-500 max-w-xs mx-auto">
              Any Excel or CSV format. AI auto-maps your columns.
              No reformatting required.
            </p>
          </div>

          {/* Upload zone or progress */}
          {state === "idle" ? (
            <DropZone onFile={handleFile} />
          ) : (
            <ValidationProgress
              filename={currentFile?.name ?? ""}
              fileSize={currentFile?.size ?? 0}
              step={step}
              progress={progress}
              result={result}
              onReset={handleReset}
              analysisMode={analysisMode}
              detectedFields={detectedFields ?? []}
            />
          )}

          {/* Column intelligence hint */}
          {state === "idle" && (
            <div className="mt-6 p-4 rounded-xl bg-white/2 border border-white/5 space-y-3">
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Auto-detected analysis modes</p>

              <div className="space-y-2">
                <div>
                  <p className="text-[10px] text-emerald-400 font-medium mb-1">✓ Inventory Health Analysis</p>
                  <div className="flex flex-wrap gap-1">
                    {["Item Code", "Item Name", "Stock Qty"].map((c) => (
                      <span key={c} className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{c} *</span>
                    ))}
                    {["Monthly Usage", "Unit Cost", "Lead Time"].map((c) => (
                      <span key={c} className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-slate-400 border border-white/8">{c}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-blue-400 font-medium mb-1">✓ Stock Ageing Analysis</p>
                  <div className="flex flex-wrap gap-1">
                    {["Item Code", "Item Name", "Stock Qty"].map((c) => (
                      <span key={c} className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{c} *</span>
                    ))}
                    {["Ageing Days", "Last Movement Date"].map((c) => (
                      <span key={c} className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20">{c}</span>
                    ))}
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-slate-600">
                <span className="text-emerald-500">*</span> Always required · Column names auto-detected — no renaming needed · 50+ aliases recognized
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
