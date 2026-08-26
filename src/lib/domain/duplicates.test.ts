import { describe, expect, it } from "vitest";
import { duplicateIssues } from "@/lib/domain/duplicates";
import type { IntakeJob, InvoiceDraft } from "@/lib/domain/schema";

const draft: InvoiceDraft = {
  partner_code: "P-1001",
  invoice_number: "YM-2026-0107",
  issue_date: "2026-01-07",
  due_date: "2026-02-28",
  currency: "JPY",
  lines: [
    {
      description: "part",
      quantity: 1,
      unit: "個",
      unit_price: 100,
      amount: 100,
      tax_code: "T10",
    },
  ],
  subtotal: 100,
  tax_amount: 10,
  total_amount: 110,
};

function job(partial: Partial<IntakeJob> & Pick<IntakeJob, "id">): IntakeJob {
  return {
    source_filename: "other.pdf",
    media_type: "application/pdf",
    document_url: "/x",
    status: "ready",
    extracted: null,
    draft,
    partner_match: null,
    issues: [],
    accounting_id: null,
    register_error: null,
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

describe("duplicateIssues", () => {
  it("blocks when the accounting API already has the number", () => {
    const issues = duplicateIssues(draft, {
      jobId: "job_a",
      registered: [
        {
          partner_code: "P-1001",
          invoice_number: "YM-2026-0107",
          accounting_id: "ACC-0001",
        },
      ],
      queued: [],
    });
    expect(issues[0]?.code).toBe("DUPLICATE_INVOICE");
    expect(issues[0]?.severity).toBe("blocker");
  });

  it("warns when another queue job has the same number", () => {
    const issues = duplicateIssues(draft, {
      jobId: "job_a",
      registered: [],
      queued: [job({ id: "job_b", source_filename: "invoice_07.jpg" })],
    });
    expect(issues[0]?.code).toBe("QUEUE_DUPLICATE");
    expect(issues[0]?.severity).toBe("warning");
  });

  it("blocks when a sibling job is already registered", () => {
    const issues = duplicateIssues(draft, {
      jobId: "job_a",
      registered: [],
      queued: [
        job({
          id: "job_b",
          status: "registered",
          accounting_id: "ACC-0001",
          source_filename: "invoice_01.pdf",
        }),
      ],
    });
    expect(issues[0]?.code).toBe("DUPLICATE_INVOICE");
    expect(issues[0]?.severity).toBe("blocker");
  });

  it("ignores jobs without a partner or number", () => {
    const issues = duplicateIssues(
      { ...draft, partner_code: null },
      { jobId: "job_a", registered: [], queued: [] },
    );
    expect(issues).toHaveLength(0);
  });
});
