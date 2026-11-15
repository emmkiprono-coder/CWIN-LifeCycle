/**
 * Invoice and pay-stub generation for a billing period.
 *
 * v1 scope (per decision): documents only. This produces Invoice/PayStub
 * database records plus a PDF buffer for each — nothing here moves money.
 * Marking something paid is a manual status change (PAID_MANUALLY) made by
 * a person after they've actually paid or been paid outside the system.
 *
 * Only shifts with status APPROVED are billed/paid — EXCEPTION and
 * PENDING_REVIEW shifts are deliberately excluded until a person resolves
 * them, so a bad import row can never turn into a wrong invoice or a wrong
 * paycheck by default.
 */
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";

async function nextSequence(prefix: string, periodId: string): Promise<string> {
  const count = await prisma.invoice.count({ where: { billingPeriodId: periodId } });
  return `${prefix}-${periodId.slice(-6).toUpperCase()}-${String(count + 1).padStart(3, "0")}`;
}

export async function generateInvoicesForPeriod(billingPeriodId: string) {
  const period = await prisma.billingPeriod.findUniqueOrThrow({ where: { id: billingPeriodId } });
  if (period.status === "LOCKED") {
    throw new Error("Billing period is locked; cannot generate new invoices against it.");
  }

  const shifts = await prisma.shift.findMany({
    where: {
      status: "APPROVED",
      clockIn: { gte: period.startDate, lte: period.endDate },
    },
    include: { client: true },
  });

  const byClient = new Map<string, typeof shifts>();
  for (const s of shifts) {
    const list = byClient.get(s.clientId) ?? [];
    list.push(s);
    byClient.set(s.clientId, list);
  }

  const results: { invoiceId: string; clientName: string; total: number; pdf: Buffer }[] = [];

  for (const [clientId, clientShifts] of byClient) {
    const client = clientShifts[0].client;
    const lines = clientShifts.map((s: any) => ({
      shiftId: s.id,
      description: `Care visit ${s.clockIn.toISOString().slice(0, 10)} (${Number(s.durationHours ?? 0).toFixed(2)} hrs)`,
      hours: Number(s.durationHours ?? 0),
      rate: Number(s.billRatePerHour ?? 0),
      amount: Math.round(Number(s.durationHours ?? 0) * Number(s.billRatePerHour ?? 0) * 100) / 100,
    }));
    const subtotal = Math.round(lines.reduce((sum: number, l: any) => sum + l.amount, 0) * 100) / 100;

    const invoiceNumber = await nextSequence("INV", billingPeriodId);
    const invoice = await prisma.invoice.create({
      data: {
        clientId,
        billingPeriodId,
        invoiceNumber,
        status: "DRAFT",
        subtotal,
        total: subtotal, // no tax/fees modeled yet — extend here if needed
        lines: { create: lines },
      },
    });

    const pdf = await renderInvoicePdf({
      invoiceNumber,
      clientName: client.name,
      periodStart: period.startDate,
      periodEnd: period.endDate,
      lines,
      total: subtotal,
    });

    results.push({ invoiceId: invoice.id, clientName: client.name, total: subtotal, pdf });
  }

  return results;
}

export async function generatePayStubsForPeriod(billingPeriodId: string) {
  const period = await prisma.billingPeriod.findUniqueOrThrow({ where: { id: billingPeriodId } });
  if (period.status === "LOCKED") {
    throw new Error("Billing period is locked; cannot generate new pay stubs against it.");
  }

  const shifts = await prisma.shift.findMany({
    where: {
      status: "APPROVED",
      clockIn: { gte: period.startDate, lte: period.endDate },
    },
    include: { caregiver: true },
  });

  const byCaregiver = new Map<string, typeof shifts>();
  for (const s of shifts) {
    const list = byCaregiver.get(s.caregiverId) ?? [];
    list.push(s);
    byCaregiver.set(s.caregiverId, list);
  }

  const results: { payStubId: string; caregiverName: string; grossPay: number; pdf: Buffer }[] = [];

  for (const [caregiverId, cgShifts] of byCaregiver) {
    const caregiver = cgShifts[0].caregiver;
    const lines = cgShifts.map((s: any) => ({
      shiftId: s.id,
      description: `Shift ${s.clockIn.toISOString().slice(0, 10)} (${Number(s.durationHours ?? 0).toFixed(2)} hrs)`,
      hours: Number(s.durationHours ?? 0),
      rate: Number(s.payRatePerHour ?? 0),
      amount: Math.round(Number(s.durationHours ?? 0) * Number(s.payRatePerHour ?? 0) * 100) / 100,
    }));
    const totalHours = Math.round(lines.reduce((sum: number, l: any) => sum + l.hours, 0) * 100) / 100;
    const grossPay = Math.round(lines.reduce((sum: number, l: any) => sum + l.amount, 0) * 100) / 100;

    const stubNumber = await nextSequence("PAY", billingPeriodId);
    const payStub = await prisma.payStub.create({
      data: {
        caregiverId,
        billingPeriodId,
        stubNumber,
        status: "DRAFT",
        totalHours,
        grossPay,
        lines: { create: lines },
      },
    });

    const pdf = await renderPayStubPdf({
      stubNumber,
      caregiverName: caregiver.name,
      periodStart: period.startDate,
      periodEnd: period.endDate,
      lines,
      totalHours,
      grossPay,
    });

    results.push({ payStubId: payStub.id, caregiverName: caregiver.name, grossPay, pdf });
  }

  return results;
}

// ---------- PDF rendering (simple, functional layout — swap for a styled
// template later; the point of v1 is correct numbers, not polish) ----------

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function renderInvoicePdf(args: {
  invoiceNumber: string;
  clientName: string;
  periodStart: Date;
  periodEnd: Date;
  lines: { description: string; hours: number; rate: number; amount: number }[];
  total: number;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text("CWIN At Home LLC", { continued: false });
    doc.fontSize(10).text("15941 S. Harlem Ave. #305, Tinley Park, IL 60477");
    doc.moveDown();
    doc.fontSize(14).text(`Invoice ${args.invoiceNumber}`);
    doc.fontSize(10).text(`Billed to: ${args.clientName}`);
    doc.text(`Service period: ${fmtDate(args.periodStart)} – ${fmtDate(args.periodEnd)}`);
    doc.moveDown();

    doc.fontSize(10).text("Description", 50, doc.y, { continued: true, width: 280 });
    doc.text("Hours", 330, doc.y, { continued: true, width: 60, align: "right" });
    doc.text("Rate", 390, doc.y, { continued: true, width: 60, align: "right" });
    doc.text("Amount", 450, doc.y, { width: 90, align: "right" });
    doc.moveDown(0.5);

    for (const line of args.lines) {
      const y = doc.y;
      doc.text(line.description, 50, y, { width: 280 });
      doc.text(line.hours.toFixed(2), 330, y, { width: 60, align: "right" });
      doc.text(`$${line.rate.toFixed(2)}`, 390, y, { width: 60, align: "right" });
      doc.text(`$${line.amount.toFixed(2)}`, 450, y, { width: 90, align: "right" });
    }

    doc.moveDown();
    doc.fontSize(12).text(`Total due: $${args.total.toFixed(2)}`, { align: "right" });
    doc.end();
  });
}

async function renderPayStubPdf(args: {
  stubNumber: string;
  caregiverName: string;
  periodStart: Date;
  periodEnd: Date;
  lines: { description: string; hours: number; rate: number; amount: number }[];
  totalHours: number;
  grossPay: number;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text("CWIN At Home LLC — Pay Statement");
    doc.fontSize(10).text(`Pay stub ${args.stubNumber}`);
    doc.text(`Paid to: ${args.caregiverName}`);
    doc.text(`Pay period: ${fmtDate(args.periodStart)} – ${fmtDate(args.periodEnd)}`);
    doc.moveDown();

    doc.fontSize(10).text("Description", 50, doc.y, { continued: true, width: 280 });
    doc.text("Hours", 330, doc.y, { continued: true, width: 60, align: "right" });
    doc.text("Rate", 390, doc.y, { continued: true, width: 60, align: "right" });
    doc.text("Amount", 450, doc.y, { width: 90, align: "right" });
    doc.moveDown(0.5);

    for (const line of args.lines) {
      const y = doc.y;
      doc.text(line.description, 50, y, { width: 280 });
      doc.text(line.hours.toFixed(2), 330, y, { width: 60, align: "right" });
      doc.text(`$${line.rate.toFixed(2)}`, 390, y, { width: 60, align: "right" });
      doc.text(`$${line.amount.toFixed(2)}`, 450, y, { width: 90, align: "right" });
    }

    doc.moveDown();
    doc.fontSize(11).text(`Total hours: ${args.totalHours.toFixed(2)}`, { align: "right" });
    doc.fontSize(12).text(`Gross pay: $${args.grossPay.toFixed(2)}`, { align: "right" });
    doc.moveDown(0.5);
    doc
      .fontSize(8)
      .text("This is a gross-pay statement generated by CWIN Operations OS. No taxes have been withheld — consult your tax professional for 1099/W2 obligations.", {
        align: "left",
      });
    doc.end();
  });
}
