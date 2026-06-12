import { NextRequest, NextResponse } from "next/server";
import { analyzeInventory, mapColumnName } from "@/lib/analyzer";
import type { InventoryRow, ValidationError, ValidationWarning } from "@/lib/types";
import * as XLSX from "xlsx";

// 10 s = safe for Vercel Hobby; raise to 60 on Pro if needed for very large files.
export const maxDuration = 10;
export const runtime = "nodejs";

const REQUIRED_COLS = [
  "sku_id", "product_name", "category", "units_on_hand", "unit_cost",
  "unit_price", "units_sold_30d", "units_sold_90d", "last_sale_date", "lead_time_days",
] as const;

function parseDate(val: unknown): Date | null {
  if (val == null || val === "") return null;
  if (typeof val === "number") {
    try {
      const p = XLSX.SSF.parse_date_code(val);
      if (p) return new Date(p.y, p.m - 1, p.d);
    } catch { /* fall through */ }
  }
  if (val instanceof Date) return val;
  if (typeof val === "string") {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function parseNum(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const n = parseFloat(val.replace(/[$,\s%]/g, ""));
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

export async function POST(req: NextRequest) {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ success: false, errors: [{ code: "ERR", message: "Invalid request" }] }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ success: false, errors: [{ code: "ERR", message: "No file provided" }] }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!["xlsx", "xls", "csv", "tsv"].includes(ext)) {
    return NextResponse.json({ success: false, errors: [{ code: "R05", message: `File format .${ext} not supported.` }] }, { status: 422 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ success: false, errors: [{ code: "R10", message: "File exceeds 10 MB limit." }] }, { status: 413 });
  }

  const buffer = await file.arrayBuffer();
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  } catch {
    return NextResponse.json({ success: false, errors: [{ code: "R05", message: "Could not read file. May be password-protected." }] }, { status: 422 });
  }

  let sheet: XLSX.WorkSheet | null = null;
  for (const name of workbook.SheetNames) {
    const s = workbook.Sheets[name];
    if (s && Object.keys(s).some((k) => !k.startsWith("!"))) { sheet = s; break; }
  }
  if (!sheet) {
    return NextResponse.json({ success: false, errors: [{ code: "R05", message: "No data found in file." }] }, { status: 422 });
  }

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  if (rawRows.length < 5) {
    return NextResponse.json({ success: false, errors: [{ code: "R03", message: `Only ${rawRows.length} rows. Minimum 5 required.` }] }, { status: 422 });
  }

  const sample = rawRows[0];
  const colMap = new Map<string, string>();
  for (const rawCol of Object.keys(sample)) {
    const canonical = mapColumnName(rawCol);
    if (canonical) colMap.set(rawCol, canonical);
  }

  const presentCanonicals = new Set(colMap.values());
  const missing = REQUIRED_COLS.filter((c) => !presentCanonicals.has(c));
  if (missing.length > 0) {
    return NextResponse.json({ success: false, errors: [{ code: "R01", message: `Missing required columns: ${missing.join(", ")}` }] }, { status: 422 });
  }

  const rows: InventoryRow[] = [];
  const seenSkus = new Set<string>();
  let flagged = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const r: Partial<InventoryRow> = {};
    for (const [rawCol, canonical] of colMap.entries()) {
      const val = raw[rawCol];
      if (["sku_id", "product_name", "category"].includes(canonical)) {
        (r as Record<string, unknown>)[canonical] = String(val ?? "").trim();
      } else if (canonical === "last_sale_date") {
        r.last_sale_date = parseDate(val);
      } else {
        (r as Record<string, unknown>)[canonical] = parseNum(val);
      }
    }
    const row = r as InventoryRow;
    if (seenSkus.has(row.sku_id)) { flagged++; continue; }
    seenSkus.add(row.sku_id);
    if (row.units_on_hand < 0) { flagged++; continue; }
    if (row.units_sold_30d > row.units_sold_90d) {
      row.units_sold_30d = Math.round(row.units_sold_90d / 3);
      warnings.push({ code: "R06", row: i + 2, message: `Row ${i + 2}: 30d/90d auto-corrected.`, severity: "warning" });
      flagged++;
    }
    if (!row.last_sale_date) {
      row.last_sale_date = new Date(Date.now() - 400 * 86_400_000);
      flagged++;
    }
    if (row.lead_time_days === 0) row.lead_time_days = 1;
    rows.push(row);
  }

  const { metrics, analyzedSkus } = analyzeInventory(rows);

  return NextResponse.json({
    success: true,
    filename: file.name,
    rows_parsed: rawRows.length,
    rows_valid: rows.length,
    rows_flagged: flagged,
    warnings,
    errors,
    metrics,
    analyzed_skus: analyzedSkus.slice(0, 200),
  });
}
