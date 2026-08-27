import type {
  ValidationIssue,
  InvoiceDraft,
  IntakeJob,
} from "@/lib/domain/schema";
import type { RegisteredInvoice } from "@/lib/accounting/client";

/**
 * Same partner + invoice number must not be booked twice.
 * Accounting-system hits are blockers; another job still in the queue is a warning.
 */
export function duplicateIssues(
  draft: InvoiceDraft,
  options: {
    jobId: string;
    registered: Pick<
      RegisteredInvoice,
      "partner_code" | "invoice_number" | "accounting_id"
    >[];
    queued: IntakeJob[];
  },
): ValidationIssue[] {
  const partner = draft.partner_code;
  const number = draft.invoice_number?.trim();
  if (!partner || !number) return [];

  const issues: ValidationIssue[] = [];

  const booked = options.registered.find(
    (inv) => inv.partner_code === partner && inv.invoice_number === number,
  );
  if (booked) {
    issues.push({
      code: "DUPLICATE_INVOICE",
      severity: "blocker",
      message: `Already registered in the accounting system as ${booked.accounting_id}`,
      field: "invoice_number",
      details: {
        partner_code: partner,
        invoice_number: number,
        accounting_id: booked.accounting_id,
      },
    });
    return issues;
  }

  const others = options.queued.filter(
    (job) =>
      job.id !== options.jobId &&
      job.status !== "failed" &&
      job.draft?.partner_code === partner &&
      job.draft.invoice_number === number,
  );
  if (others.length) {
    const registeredSibling = others.find((j) => j.status === "registered");
    if (registeredSibling?.accounting_id) {
      issues.push({
        code: "DUPLICATE_INVOICE",
        severity: "blocker",
        message: `Already registered from ${registeredSibling.source_filename} as ${registeredSibling.accounting_id}`,
        field: "invoice_number",
      });
    } else {
      issues.push({
        code: "QUEUE_DUPLICATE",
        severity: "warning",
        message: `Same partner + invoice number as ${others.map((j) => j.source_filename).join(", ")} - likely a duplicate (e.g. PDF and scan of the same invoice)`,
        field: "invoice_number",
        details: { other_jobs: others.map((j) => j.id) },
      });
    }
  }

  return issues;
}
