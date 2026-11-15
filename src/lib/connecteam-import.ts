/**
 * Connecteam timesheet import (Phase 1: manual file import).
 *
 * Shaped from a real export (`timeclock-timesheet_overview_...xlsx`,
 * "All Employees" sheet). Known quirks of this export format, handled below:
 *
 *  - First/Last name are only populated on the FIRST row of each employee's
 *    block; subsequent rows for the same person leave them blank (a classic
 *    merged-cell-style export). We forward-fill within the sheet.
 *  - The "Type" column actually holds the CLIENT name (Connecteam's generic
 *    "schedule type" field repurposed by CWIN to mean "which client"), not a
 *    shift type. "Sub item" is unused ("No sub item" always).
 *  - "Shift hours" / times are "HH:MM" strings, not decimal hours.
 *  - A shift still clocked in has no End Date/Out — these must NOT be
 *    silently dropped; they become a MISSING_CLOCK_OUT exception.
 *  - "Hourly rate (USD)" is sometimes blank/0 due to sync glitches on
 *    Connecteam's side — these become a RATE_MISMATCH-style exception rather
 *    than a shift with a $0 pay rate.
 *  - Rows with Type === "No records for this day" are placeholders, not
 *    shifts, and are skipped entirely.
 */
import * as XLSX from "xlsx";

export interface ParsedShiftRow {
  caregiverName: string;
  clientName: string;
  clockIn: Date;
  clockOut: Date | null;
  durationHours: number | null;
  hourlyRate: number | null;
  startLocation: string | null;
  endLocation: string | null;
  employeeNotes: string | null;
  managerNotes: string | null;
  rowIndex: number; // 1-based row number in the source sheet, for audit/debugging
}

export interface ImportIssue {
  rowIndex: number;
  caregiverName: string;
  clientName: string;
  issue:
    | "MISSING_CLOCK_OUT"
    | "MISSING_OR_ZERO_RATE"
    | "UNPARSEABLE_ROW";
  detail: string;
}

export interface ImportResult {
  rows: ParsedShiftRow[];
  issues: ImportIssue[];
  totalRowsScanned: number;
  skippedPlaceholderRows: number;
}

function hhmmToHours(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v; // already decimal hours in some exports
  const s = String(v).trim();
  const m = s.match(/^(\d{1,3}):(\d{2})$/);
  if (!m) return null;
  const hours = parseInt(m[1], 10);
  const minutes = parseInt(m[2], 10);
  return Math.round((hours + minutes / 60) * 100) / 100;
}

function toDateOnly(v: unknown): Date | null {
  if (v instanceof Date) return v;
  if (typeof v === "string" && v.trim()) {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function combineDateAndTime(date: Date, timeStr: string): Date | null {
  const m = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const d = new Date(date);
  d.setHours(parseInt(m[1], 10), parseInt(m[2], 10), 0, 0);
  return d;
}

/** Parses the "All Employees" sheet of a Connecteam timesheet export. */
export function parseConnecteamWorkbook(buffer: Buffer): ImportResult {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = wb.SheetNames.includes("All Employees")
    ? "All Employees"
    : wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  const header = raw[0].map((h: string) => String(h).trim());
  const col = (name: string) => header.indexOf(name);

  const idx = {
    firstName: col("First name"),
    lastName: col("Last name"),
    type: col("Type"), // client name, per the note above
    startDate: col("Start Date"),
    in: col("In"),
    startLocation: col("Start - location"),
    endDate: col("End Date"),
    out: col("Out"),
    endLocation: col("End - location"),
    employeeNotes: col("Employee notes"),
    managerNotes: col("Manager notes"),
    shiftHours: col("Shift hours"),
    hourlyRate: col("Hourly rate (USD)"),
  };

  const rows: ParsedShiftRow[] = [];
  const issues: ImportIssue[] = [];
  let skippedPlaceholderRows = 0;
  let currentFirst = "";
  let currentLast = "";

  for (let i = 1; i < raw.length; i++) {
    const row = raw[i];
    const rowIndex = i + 1; // 1-based, matches spreadsheet row numbers

    const first = String(row[idx.firstName] ?? "").trim();
    const last = String(row[idx.lastName] ?? "").trim();
    if (first) currentFirst = first;
    if (last) currentLast = last;

    const clientName = String(row[idx.type] ?? "").trim();
    if (!clientName || clientName === "No records for this day") {
      skippedPlaceholderRows++;
      continue;
    }

    const caregiverName = `${currentFirst} ${currentLast}`.trim();
    const startDate = toDateOnly(row[idx.startDate]);
    const inTime = String(row[idx.in] ?? "").trim();

    if (!startDate || !inTime) {
      issues.push({
        rowIndex,
        caregiverName,
        clientName,
        issue: "UNPARSEABLE_ROW",
        detail: `Missing start date or clock-in time (startDate=${row[idx.startDate]}, in=${row[idx.in]})`,
      });
      continue;
    }

    const clockIn = combineDateAndTime(startDate, inTime);
    if (!clockIn) {
      issues.push({
        rowIndex,
        caregiverName,
        clientName,
        issue: "UNPARSEABLE_ROW",
        detail: `Could not parse clock-in time "${inTime}"`,
      });
      continue;
    }

    const endDate = toDateOnly(row[idx.endDate]);
    const outTime = String(row[idx.out] ?? "").trim();
    const clockOut = endDate && outTime ? combineDateAndTime(endDate, outTime) : null;

    if (!clockOut) {
      issues.push({
        rowIndex,
        caregiverName,
        clientName,
        issue: "MISSING_CLOCK_OUT",
        detail: `Shift starting ${clockIn.toISOString()} has no recorded clock-out`,
      });
    }

    const durationHours = hhmmToHours(row[idx.shiftHours]);
    const hourlyRateRaw = row[idx.hourlyRate];
    const hourlyRate =
      typeof hourlyRateRaw === "number" ? hourlyRateRaw : parseFloat(String(hourlyRateRaw));
    const validRate = !isNaN(hourlyRate) && hourlyRate > 0 ? hourlyRate : null;

    if (validRate === null) {
      issues.push({
        rowIndex,
        caregiverName,
        clientName,
        issue: "MISSING_OR_ZERO_RATE",
        detail: `Hourly rate missing or zero for this shift (raw value: "${hourlyRateRaw}")`,
      });
    }

    rows.push({
      caregiverName,
      clientName,
      clockIn,
      clockOut,
      durationHours,
      hourlyRate: validRate,
      startLocation: String(row[idx.startLocation] ?? "").trim() || null,
      endLocation: String(row[idx.endLocation] ?? "").trim() || null,
      employeeNotes: String(row[idx.employeeNotes] ?? "").trim() || null,
      managerNotes: String(row[idx.managerNotes] ?? "").trim() || null,
      rowIndex,
    });
  }

  return { rows, issues, totalRowsScanned: raw.length - 1, skippedPlaceholderRows };
}
