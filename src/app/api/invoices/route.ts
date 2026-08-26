import { NextResponse } from "next/server";

import { statusFromIssues, buildJobIssues } from "@/lib/intake/issues";
import { listJobs, saveJob } from "@/lib/store";
import { listInvoices } from "@/lib/accounting/client";

export const runtime = "nodejs";

export async function GET() {
  let registered: Awaited<ReturnType<typeof listInvoices>> = [];
  try {
    registered = await listInvoices();
  } catch {
    registered = [];
  }

  for (const job of listJobs()) {
    if (!job.draft || job.status === "failed" || job.status === "registered") {
      continue;
    }
    const issues = await buildJobIssues(job, registered);
    saveJob({
      ...job,
      issues,
      status: statusFromIssues(issues, job.status),
      updated_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({ jobs: listJobs() });
}
