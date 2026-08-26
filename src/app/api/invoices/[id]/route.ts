import { NextResponse } from "next/server";

import { statusFromIssues, buildJobIssues } from "@/lib/intake/issues";
import { InvoiceDraftSchema } from "@/lib/domain/schema";
import { saveJob, getJob } from "@/lib/store";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const job = getJob(id);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  if (!job.draft || job.status === "failed" || job.status === "registered") {
    return NextResponse.json({ job });
  }
  const issues = await buildJobIssues(job);
  const updated = saveJob({
    ...job,
    issues,
    status: statusFromIssues(issues, job.status),
    updated_at: new Date().toISOString(),
  });
  return NextResponse.json({ job: updated });
}

/** Human edits: replace draft, re-verify only (no second LLM call). */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const job = getJob(id);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  if (job.status === "registered") {
    return NextResponse.json(
      { error: "Registered invoices cannot be edited" },
      { status: 409 },
    );
  }

  const body = await request.json();
  const parsed = InvoiceDraftSchema.safeParse(body.draft ?? body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid draft", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const draft = parsed.data;
  const pending = saveJob({
    ...job,
    draft,
    register_error: null,
    updated_at: new Date().toISOString(),
  });
  const issues = await buildJobIssues(pending);
  const updated = saveJob({
    ...pending,
    issues,
    status: statusFromIssues(issues, pending.status),
    updated_at: new Date().toISOString(),
  });

  return NextResponse.json({ job: updated });
}
