import { NextRequest, NextResponse } from "next/server";
import { generateInvoicesForPeriod, generatePayStubsForPeriod } from "@/lib/billing";

/**
 * Triggers invoice + pay-stub generation for a billing period.
 * Returns PDFs base64-encoded in the response for now (Phase 1 has no
 * document storage wired up yet — plug in S3/Blob storage and set
 * Invoice.pdfUrl / PayStub.pdfUrl once that exists; see README "Next steps").
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const [invoices, payStubs] = await Promise.all([
      generateInvoicesForPeriod(params.id),
      generatePayStubsForPeriod(params.id),
    ]);

    return NextResponse.json({
      invoices: invoices.map((i) => ({
        invoiceId: i.invoiceId,
        clientName: i.clientName,
        total: i.total,
        pdfBase64: i.pdf.toString("base64"),
      })),
      payStubs: payStubs.map((p) => ({
        payStubId: p.payStubId,
        caregiverName: p.caregiverName,
        grossPay: p.grossPay,
        pdfBase64: p.pdf.toString("base64"),
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
