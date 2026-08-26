"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePageBreadcrumb } from "@/components/custom/breadcrumb";
import { InvoiceReview } from "@/components/invoice-review";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { IntakeJob, JobStatus } from "@/lib/domain/schema";

const yen = new Intl.NumberFormat("ja-JP");

function statusBadge(status: JobStatus) {
  switch (status) {
    case "ready":
      return <Badge>ready</Badge>;
    case "registered":
      return <Badge variant="secondary">registered</Badge>;
    case "failed":
      return <Badge variant="destructive">failed</Badge>;
    case "needs_review":
      return <Badge variant="outline">needs review</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function blockerCount(job: IntakeJob): number {
  return job.issues.filter((i) => i.severity === "blocker").length;
}

function warningCount(job: IntakeJob): number {
  return job.issues.filter((i) => i.severity === "warning").length;
}

export function InvoiceQueue() {
  const [jobs, setJobs] = useState<IntakeJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"upload" | "samples" | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  usePageBreadcrumb({
    label: "Invoice Intake",
    link: "/dashboard",
    index: 0,
  });

  const refresh = useCallback(async () => {
    const res = await fetch("/api/invoices");
    const body = (await res.json()) as { jobs?: IntakeJob[]; error?: string };
    if (!res.ok) {
      throw new Error(body.error ?? "Failed to load jobs");
    }
    setJobs(body.jobs ?? []);
  }, []);

  useEffect(() => {
    refresh().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Failed to load jobs");
    });
  }, [refresh]);

  async function extractSample(sample: string) {
    const res = await fetch("/api/invoices/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sample }),
    });
    const body = (await res.json()) as { error?: string };
    if (!res.ok) {
      throw new Error(body.error ?? `Failed to extract ${sample}`);
    }
  }

  async function onUpload(file: File) {
    setError(null);
    setBusy("upload");
    setProgress(file.name);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch("/api/invoices/extract", {
        method: "POST",
        body: form,
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error ?? "Upload failed");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(null);
      setProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onProcessSamples() {
    setError(null);
    setBusy("samples");
    try {
      const listRes = await fetch("/api/samples");
      const listBody = (await listRes.json()) as {
        samples?: string[];
        error?: string;
      };
      if (!listRes.ok) {
        throw new Error(listBody.error ?? "Could not list sample invoices");
      }
      const samples = listBody.samples ?? [];
      for (let i = 0; i < samples.length; i++) {
        setProgress(`${samples[i]} (${i + 1}/${samples.length})`);
        await extractSample(samples[i]);
        await refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sample processing failed");
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  const onJobChange = useCallback((updated: IntakeJob) => {
    setJobs((current) =>
      current.map((job) => (job.id === updated.id ? updated : job)),
    );
  }, []);

  const reviewing = jobs.find((job) => job.id === reviewId);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Add invoices</CardTitle>
          <CardDescription>
            Upload a PDF or scan, or run the twelve sample invoices from{" "}
            <code className="font-mono text-xs">invoices/</code>. Nothing is
            posted until you review and register.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onUpload(file);
            }}
          />
          <Button
            type="button"
            disabled={busy !== null}
            onClick={() => fileRef.current?.click()}
          >
            {busy === "upload" ? "Extracting…" : "Upload invoice"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy !== null}
            onClick={() => void onProcessSamples()}
          >
            {busy === "samples" ? "Processing samples…" : "Process samples"}
          </Button>
          {progress ? (
            <span className="text-muted-foreground text-sm">{progress}</span>
          ) : null}
        </CardContent>
      </Card>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <Card className="min-h-0 flex-1">
        <CardHeader>
          <CardTitle>Queue</CardTitle>
          <CardDescription>
            {jobs.length === 0
              ? "No jobs yet."
              : `${jobs.length} job${jobs.length === 1 ? "" : "s"}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Flags</TableHead>
                <TableHead className="text-right"> </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-mono text-xs">
                    {job.source_filename}
                  </TableCell>
                  <TableCell>{statusBadge(job.status)}</TableCell>
                  <TableCell>{job.draft?.partner_code ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {job.draft?.invoice_number || "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {job.draft ? `¥${yen.format(job.draft.total_amount)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {blockerCount(job)}
                    {warningCount(job) ? ` / ${warningCount(job)} warn` : ""}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setReviewId(job.id)}
                    >
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={reviewId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setReviewId(null);
            void refresh();
          }
        }}
      >
        <DialogContent className="flex h-[min(92vh,56rem)] w-[min(96vw,88rem)] max-w-[min(96vw,88rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,88rem)]">
          <DialogHeader className="shrink-0 border-b px-6 py-4 pr-12">
            <DialogTitle className="font-mono text-base">
              {reviewing?.source_filename ?? "Review invoice"}
            </DialogTitle>
            <DialogDescription>
              Compare the original to the draft, correct if needed, then
              register. Totals are recalculated the same way the accounting API
              does.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {reviewId ? (
              <InvoiceReview id={reviewId} onJobChange={onJobChange} />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
