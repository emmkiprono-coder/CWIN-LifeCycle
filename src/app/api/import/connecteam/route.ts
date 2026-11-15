import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseConnecteamWorkbook, ParsedShiftRow } from "@/lib/connecteam-import";
import { resolvePayRate, computeShiftAmounts } from "@/lib/pay-rules";

/**
 * Phase 1 Connecteam import: accepts a timesheet .xlsx export (the same
 * shape as timeclock-timesheet_overview_*.xlsx), matches each row's
 * caregiver/client by name against existing records, creates Shift rows,
 * resolves pay via the PayRule engine, and raises a ReconciliationException
 * for anything that needs a human to look at it before it's billed or paid:
 * missing clock-outs, missing/zero rates, and names that don't match an
 * existing Caregiver or Client (so nothing gets silently mis-billed).
 *
 * This intentionally does NOT auto-approve shifts — everything lands as
 * PENDING_REVIEW or EXCEPTION. Approving for pay/invoicing is a separate,
 * explicit step (keeps a human in the loop on money, per the project's
 * exception-based reconciliation requirement).
 */
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "No file uploaded under field 'file'" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = (file as any).name ?? "upload.xlsx";

  let parsed;
  try {
    parsed = parseConnecteamWorkbook(buffer);
  } catch (e: any) {
    return NextResponse.json({ error: `Could not parse workbook: ${e.message}` }, { status: 400 });
  }

  const caregivers = await prisma.caregiver.findMany();
  const clients = await prisma.client.findMany();
  const payRules = await prisma.payRule.findMany();

  const findCaregiver = (name: string) =>
    caregivers.find((c: { name: string }) => c.name.trim().toLowerCase() === name.trim().toLowerCase());
  const findClient = (name: string) =>
    clients.find((c: { name: string }) => c.name.trim().toLowerCase() === name.trim().toLowerCase());

  let shiftCount = 0;
  let errorCount = 0;
  const rowNotes: any[] = [];

  for (const row of parsed.rows as ParsedShiftRow[]) {
    const caregiver = findCaregiver(row.caregiverName);
    const client = findClient(row.clientName);

    if (!caregiver || !client) {
      errorCount++;
      rowNotes.push({
        rowIndex: row.rowIndex,
        skipped: true,
        reason: !caregiver
          ? `No Caregiver record matches "${row.caregiverName}"`
          : `No Client record matches "${row.clientName}"`,
      });
      continue;
    }

    const durationHours = row.durationHours ?? 0;
    const caregiverDefaultRate = Number(caregiver.defaultPayRate);
    const effectiveRate = row.hourlyRate ?? caregiverDefaultRate;

    const resolvedRate = resolvePayRate(
      {
        clientId: client.id,
        clockIn: row.clockIn,
        durationHours,
        caregiverDefaultRate: effectiveRate,
      },
      payRules.map(
        (r: {
          id: string;
          clientId: string | null;
          rateType: string;
          payRatePerHour: unknown;
          multiplier: unknown;
          appliesFrom: Date | null;
          appliesTo: Date | null;
          priority: number;
          active: boolean;
        }) => ({
          id: r.id,
          clientId: r.clientId,
          rateType: r.rateType as "FLAT_HOURLY" | "MULTIPLIER",
          payRatePerHour: Number(r.payRatePerHour),
          multiplier: r.multiplier ? Number(r.multiplier) : null,
          appliesFrom: r.appliesFrom,
          appliesTo: r.appliesTo,
          priority: r.priority,
          active: r.active,
        })
      )
    );

    const { billRatePerHour } = computeShiftAmounts(durationHours, resolvedRate);
    const hasMissingClockOut = row.clockOut === null;
    const hasRateIssue = row.hourlyRate === null;
    const status = hasMissingClockOut || hasRateIssue ? "EXCEPTION" : "PENDING_REVIEW";

    const shift = await prisma.shift.create({
      data: {
        caregiverId: caregiver.id,
        clientId: client.id,
        clockIn: row.clockIn,
        clockOut: row.clockOut,
        durationHours,
        source: "MANUAL_IMPORT",
        status,
        payRatePerHour: resolvedRate,
        billRatePerHour,
        notes: [row.employeeNotes, row.managerNotes].filter(Boolean).join(" | ") || null,
      },
    });
    shiftCount++;

    if (hasMissingClockOut) {
      await prisma.reconciliationException.create({
        data: {
          shiftId: shift.id,
          type: "MISSING_CLOCK_OUT",
          description: `Shift for ${row.caregiverName} at ${row.clientName} starting ${row.clockIn.toISOString()} has no clock-out recorded.`,
        },
      });
    }
    if (hasRateIssue) {
      await prisma.reconciliationException.create({
        data: {
          shiftId: shift.id,
          type: "RATE_MISMATCH",
          description: `Hourly rate was missing or zero in the Connecteam export for this shift; fell back to ${caregiver.name}'s default rate ($${caregiverDefaultRate}/hr). Verify before approving.`,
        },
      });
    }
  }

  const batch = await prisma.timeImportBatch.create({
    data: {
      fileName,
      rowCount: parsed.totalRowsScanned,
      shiftCount,
      errorCount: errorCount + parsed.issues.length,
      rawSummary: { parseIssues: parsed.issues, unmatchedRows: rowNotes },
    },
  });

  return NextResponse.json({
    batchId: batch.id,
    rowsScanned: parsed.totalRowsScanned,
    skippedPlaceholderRows: parsed.skippedPlaceholderRows,
    shiftsCreated: shiftCount,
    unmatchedOrErrorRows: errorCount,
    parseIssues: parsed.issues,
  });
}
