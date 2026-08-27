import type { IntakeJob } from "@/lib/domain/schema";

/**
 * In-memory job store for the demo.
 * Survives within a single Node process; resets on server restart.
 */
const globalForStore = globalThis as unknown as {
  __invoiceJobs?: Map<string, IntakeJob>;
};

const jobs: Map<string, IntakeJob> =
  globalForStore.__invoiceJobs ?? new Map<string, IntakeJob>();

if (process.env.NODE_ENV !== "production") {
  globalForStore.__invoiceJobs = jobs;
}

export function listJobs(): IntakeJob[] {
  return [...jobs.values()].sort((a, b) =>
    a.created_at < b.created_at ? 1 : -1,
  );
}

export function getJob(id: string): IntakeJob | undefined {
  return jobs.get(id);
}

export function saveJob(job: IntakeJob): IntakeJob {
  jobs.set(job.id, job);
  return job;
}

export function deleteJob(id: string): boolean {
  return jobs.delete(id);
}

export function newJobId(): string {
  return `job_${crypto.randomUUID()}`;
}
