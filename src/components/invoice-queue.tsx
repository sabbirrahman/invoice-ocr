"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { usePageBreadcrumb } from "@/components/custom/breadcrumb";
import { InvoiceReview } from "@/components/invoice-review";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Separator } from "./ui/separator";

const yen = new Intl.NumberFormat("ja-JP");

function statusBadge(status: JobStatus) {
  switch (status) {
    case "ready":
      return (
        <Badge className="bg-green-600 dark:bg-green-900 text-white">
          Ready
        </Badge>
      );
    case "registered":
      return <Badge variant="secondary">Registered</Badge>;
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    case "needs_review":
      return (
        <Badge
          className="bg-yellow-600 dark:bg-yellow-900 text-white"
          variant="outline"
        >
          Needs Review
        </Badge>
      );
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
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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

  async function extractFile(file: File): Promise<void> {
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
  }

  async function onUpload(fileList: FileList) {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setError(null);
    setBusy(true);
    const failures: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress(
          files.length === 1
            ? file.name
            : `${file.name} (${i + 1}/${files.length})`,
        );
        try {
          await extractFile(file);
          await refresh();
        } catch (err) {
          const message = err instanceof Error ? err.message : "Upload failed";
          failures.push(`${file.name}: ${message}`);
        }
      }
      if (failures.length > 0) {
        setError(failures.join(" · "));
      }
    } finally {
      setBusy(false);
      setProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onDeleteFailed(id: string) {
    setError(null);
    setDeletingId(id);
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error ?? "Delete failed");
      }
      if (reviewId === id) setReviewId(null);
      setJobs((current) => current.filter((job) => job.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
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
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div className="w-full max-w-2xl space-y-1 sm:w-auto">
          <h2 className="font-bold text-2xl capitalize">Invoice Intake</h2>
          <p className="text-muted-foreground text-sm">
            Upload one or more PDFs or scans. Nothing will be posted until you
            review and register.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            className="hidden"
            onChange={(e) => {
              const selected = e.target.files;
              if (selected && selected.length > 0) void onUpload(selected);
            }}
          />
          <Button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? "Extracting…" : "Upload invoices"}
          </Button>
          {progress ? (
            <span className="text-muted-foreground text-sm">{progress}</span>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <Separator />

      <div className="flex items-center justify-between gap-4">
        <h3 className="font-bold text-lg capitalize">Queue</h3>
        <p className="text-muted-foreground text-sm">
          {jobs.length === 0
            ? "No jobs yet."
            : `${jobs.length} job${jobs.length === 1 ? "" : "s"}`}
        </p>
      </div>

      <div className="border rounded-md mb-20">
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
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setReviewId(job.id)}
                    >
                      Review
                    </Button>
                    {job.status === "failed" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label={`Delete ${job.source_filename}`}
                        className="text-destructive hover:text-destructive"
                        disabled={deletingId === job.id}
                        onClick={() => void onDeleteFailed(job.id)}
                      >
                        <Trash2 />
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}

            {jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-40">
                  No jobs yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

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
