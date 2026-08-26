import type { ValidationIssue, IntakeJob } from "@/lib/domain/schema";

import { deriveStatus, verifyDraft } from "@/lib/domain/verify";
import { duplicateIssues } from "@/lib/domain/duplicates";
import { listInvoices } from "@/lib/accounting/client";
import { listJobs } from "@/lib/store";

/**
 * Verification + intake annotations (duplicates, handwriting, unknown supplier).
 */
export async function buildJobIssues(
  job: IntakeJob,
  alreadyRegistered?: Awaited<ReturnType<typeof listInvoices>>,
): Promise<ValidationIssue[]> {
  if (!job.draft) return [];

  const issues = verifyDraft(job.draft, {
    printed_subtotal: job.extracted?.printed_subtotal,
    printed_tax_amount: job.extracted?.printed_tax_amount,
    printed_total: job.extracted?.printed_total,
  });

  const lowConfidence =
    job.extracted?.overall_confidence === "low" ||
    Object.values(job.extracted?.field_confidence ?? {}).includes("low");
  if (lowConfidence) {
    issues.push({
      code: "LOW_CONFIDENCE",
      severity: "warning",
      message:
        "Model reported low confidence on one or more fields — please review carefully",
    });
  }

  if (job.extracted?.handwritten_notes?.length) {
    issues.push({
      code: "HANDWRITTEN_NOTES",
      severity: "warning",
      message: `Handwriting detected: ${job.extracted.handwritten_notes.join("; ")}`,
    });
  }

  if (!job.draft.partner_code && job.extracted?.supplier_name) {
    const idx = issues.findIndex((i) => i.code === "PARTNER_REQUIRED");
    const detail = {
      code: "UNKNOWN_SUPPLIER" as const,
      severity: "blocker" as const,
      field: "partner_code",
      message: `Supplier "${job.extracted.supplier_name}" is not in the partner master${
        job.extracted.supplier_registration_no
          ? ` (${job.extracted.supplier_registration_no})`
          : ""
      }. Do not guess — skip or wait for master data.`,
    };
    if (idx >= 0) issues[idx] = { ...issues[idx], ...detail };
    else issues.push(detail);
  }

  let registered = alreadyRegistered;
  if (!registered) {
    try {
      registered = await listInvoices();
    } catch {
      registered = [];
    }
  }

  issues.push(
    ...duplicateIssues(job.draft, {
      jobId: job.id,
      registered,
      queued: listJobs(),
    }),
  );

  return issues;
}

export function statusFromIssues(
  issues: ValidationIssue[],
  current?: IntakeJob["status"],
): IntakeJob["status"] {
  if (current === "registered" || current === "failed") return current;
  return deriveStatus(issues);
}
