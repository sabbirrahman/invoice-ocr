import type { AccountingInvoicePayload } from "@/lib/domain/schema";

import { NextResponse } from "next/server";

import {
  AccountingApiError,
  registerInvoice,
  listInvoices,
} from "@/lib/accounting/client";
import { hasBlockers, verifyDraft } from "@/lib/domain/verify";
import { saveJob, getJob } from "@/lib/store";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  const job = getJob(id);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  if (!job.draft) {
    return NextResponse.json(
      { error: "No draft to register" },
      { status: 400 },
    );
  }
  if (job.status === "registered") {
    return NextResponse.json(
      { error: "Already registered", accounting_id: job.accounting_id },
      { status: 409 },
    );
  }

  const issues = verifyDraft(job.draft, {
    printed_subtotal: job.extracted?.printed_subtotal,
    printed_tax_amount: job.extracted?.printed_tax_amount,
    printed_total: job.extracted?.printed_total,
  });
  if (hasBlockers(issues) || job.status !== "ready") {
    const updated = saveJob({
      ...job,
      issues,
      status: "needs_review",
      updated_at: new Date().toISOString(),
    });
    return NextResponse.json(
      {
        error: "Cannot register while blockers remain",
        job: updated,
      },
      { status: 422 },
    );
  }

  const draft = job.draft;
  if (!draft.partner_code || !draft.due_date) {
    return NextResponse.json(
      { error: "partner_code and due_date are required" },
      { status: 422 },
    );
  }

  try {
    const existing = await listInvoices();
    const dup = existing.find(
      (inv) =>
        inv.partner_code === draft.partner_code &&
        inv.invoice_number === draft.invoice_number,
    );
    if (dup) {
      const updated = saveJob({
        ...job,
        status: "needs_review",
        register_error: `Duplicate of ${dup.accounting_id}`,
        issues: [
          ...job.issues.filter((i) => i.code !== "DUPLICATE_INVOICE"),
          {
            code: "DUPLICATE_INVOICE",
            severity: "blocker",
            message: `Already registered as ${dup.accounting_id}`,
            details: {
              partner_code: draft.partner_code,
              invoice_number: draft.invoice_number,
            },
          },
        ],
        updated_at: new Date().toISOString(),
      });
      return NextResponse.json(
        { error: "DUPLICATE_INVOICE", job: updated },
        { status: 409 },
      );
    }
  } catch {
    // If list fails, still attempt register - API will enforce uniqueness
  }

  const payload: AccountingInvoicePayload = {
    partner_code: draft.partner_code,
    invoice_number: draft.invoice_number,
    issue_date: draft.issue_date,
    due_date: draft.due_date,
    currency: "JPY",
    lines: draft.lines,
    subtotal: draft.subtotal,
    tax_amount: draft.tax_amount,
    total_amount: draft.total_amount,
  };

  try {
    const record = await registerInvoice(payload);
    const updated = saveJob({
      ...job,
      status: "registered",
      accounting_id: record.accounting_id,
      register_error: null,
      updated_at: new Date().toISOString(),
    });
    return NextResponse.json({ job: updated, record }, { status: 201 });
  } catch (err) {
    if (err instanceof AccountingApiError) {
      const updated = saveJob({
        ...job,
        status: "needs_review",
        register_error: `${err.code}: ${err.message}`,
        issues: [
          ...job.issues.filter((i) => i.code !== err.code),
          {
            code: err.code,
            severity: "blocker",
            message: err.message,
            details: (err.details as Record<string, unknown>) ?? undefined,
          },
        ],
        updated_at: new Date().toISOString(),
      });
      return NextResponse.json(
        { error: err.code, message: err.message, job: updated },
        { status: err.status },
      );
    }
    const message = err instanceof Error ? err.message : "Register failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
