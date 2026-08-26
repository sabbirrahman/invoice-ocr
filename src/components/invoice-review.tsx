"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Partner } from "@/lib/accounting/client";
import {
  type IntakeJob,
  type InvoiceDraft,
  type InvoiceLine,
  type JobStatus,
  TAX_CODES,
  type TaxCode,
} from "@/lib/domain/schema";
import { recalculateFromLines } from "@/lib/domain/verify";

const yen = new Intl.NumberFormat("ja-JP");

const EMPTY_LINE: InvoiceLine = {
  description: "",
  quantity: null,
  unit: "式",
  unit_price: null,
  amount: 0,
  tax_code: "T10",
};

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

function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function parseIntOrZero(value: string): number {
  return parseOptionalInt(value) ?? 0;
}

function withTotals<T extends { lines: InvoiceLine[] }>(draft: T): T {
  return { ...draft, ...recalculateFromLines(draft.lines) };
}

type FormLine = InvoiceLine & { uid: string };
type FormDraft = Omit<InvoiceDraft, "lines"> & { lines: FormLine[] };

function tagDraft(draft: InvoiceDraft): FormDraft {
  return {
    ...withTotals(draft),
    lines: draft.lines.map((line) => ({ ...line, uid: crypto.randomUUID() })),
  };
}

function untagDraft(draft: FormDraft): InvoiceDraft {
  return withTotals({
    ...draft,
    lines: draft.lines.map(({ uid: _uid, ...line }) => line),
  });
}

export function InvoiceReview({
  id,
  onJobChange,
}: {
  id: string;
  onJobChange?: (job: IntakeJob) => void;
}) {
  const [job, setJob] = useState<IntakeJob | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [draft, setDraft] = useState<FormDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "register" | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/invoices/${id}`);
    const body = (await res.json()) as { job?: IntakeJob; error?: string };
    if (!res.ok || !body.job) {
      throw new Error(body.error ?? "Job not found");
    }
    setJob(body.job);
    setDraft(body.job.draft ? tagDraft(body.job.draft) : null);
  }, [id]);

  useEffect(() => {
    load().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Failed to load job");
    });
    fetch("/api/partners")
      .then(async (res) => {
        const body = (await res.json()) as { partners?: Partner[] };
        setPartners(body.partners ?? []);
      })
      .catch(() => {
        // Partner dropdown can still use match candidates
      });
  }, [load]);

  const blockers = useMemo(
    () => job?.issues.filter((i) => i.severity === "blocker") ?? [],
    [job],
  );
  const warnings = useMemo(
    () => job?.issues.filter((i) => i.severity === "warning") ?? [],
    [job],
  );

  const partnerOptions = useMemo(() => {
    const fromMaster = partners.map((p) => ({
      partner_code: p.partner_code,
      name: p.name,
    }));
    const fromMatch = job?.partner_match?.candidates ?? [];
    const seen = new Set<string>();
    const merged = [...fromMatch, ...fromMaster].filter((p) => {
      if (seen.has(p.partner_code)) return false;
      seen.add(p.partner_code);
      return true;
    });
    return merged;
  }, [partners, job]);

  const readOnly = job?.status === "registered";
  const canRegister =
    !readOnly && job?.status === "ready" && blockers.length === 0 && !!draft;

  function updateDraft(patch: Partial<FormDraft>) {
    setDraft((current) =>
      current ? withTotals({ ...current, ...patch }) : current,
    );
  }

  function updateLine(index: number, patch: Partial<InvoiceLine>) {
    setDraft((current) => {
      if (!current) return current;
      const lines = current.lines.map((line, i) =>
        i === index ? { ...line, ...patch } : line,
      );
      return withTotals({ ...current, lines });
    });
  }

  async function onSave() {
    if (!draft) return;
    setError(null);
    setBusy("save");
    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: untagDraft(draft) }),
      });
      const body = (await res.json()) as { job?: IntakeJob; error?: string };
      if (!res.ok || !body.job) {
        throw new Error(body.error ?? "Save failed");
      }
      setJob(body.job);
      if (body.job.draft) setDraft(tagDraft(body.job.draft));
      onJobChange?.(body.job);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  async function onRegister() {
    if (!draft) return;
    setError(null);
    setBusy("register");
    try {
      const saveRes = await fetch(`/api/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: untagDraft(draft) }),
      });
      const saved = (await saveRes.json()) as {
        job?: IntakeJob;
        error?: string;
      };
      if (!saveRes.ok || !saved.job) {
        throw new Error(saved.error ?? "Save failed");
      }
      setJob(saved.job);
      if (saved.job.draft) setDraft(tagDraft(saved.job.draft));
      onJobChange?.(saved.job);
      if (
        saved.job.status !== "ready" ||
        saved.job.issues.some((i) => i.severity === "blocker")
      ) {
        throw new Error("Cannot register while blockers remain");
      }

      const res = await fetch(`/api/invoices/${id}/register`, {
        method: "POST",
      });
      const body = (await res.json()) as {
        job?: IntakeJob;
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        if (body.job) {
          setJob(body.job);
          if (body.job.draft) setDraft(tagDraft(body.job.draft));
          onJobChange?.(body.job);
        }
        throw new Error(body.message ?? body.error ?? "Register failed");
      }
      if (body.job) {
        setJob(body.job);
        if (body.job.draft) setDraft(tagDraft(body.job.draft));
        onJobChange?.(body.job);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Register failed");
    } finally {
      setBusy(null);
    }
  }

  if (!job && !error) {
    return <p className="text-muted-foreground py-8 text-sm">Loading…</p>;
  }

  if (!job) {
    return (
      <p className="text-destructive py-8 text-sm" role="alert">
        {error}
      </p>
    );
  }

  const isPdf = job.media_type === "application/pdf";

  return (
    <div className="flex w-full flex-col gap-4">
      <header className="flex flex-wrap items-center gap-3">
        {statusBadge(job.status)}
        {job.accounting_id ? (
          <span className="font-mono text-muted-foreground text-xs">
            {job.accounting_id}
          </span>
        ) : null}
      </header>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {blockers.length > 0 ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
          <p className="font-medium text-destructive">Blockers</p>
          <ul className="mt-1 list-disc pl-5">
            {blockers.map((issue) => (
              <li key={`${issue.code}-${issue.field ?? issue.message}`}>
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
          <p className="font-medium">Warnings</p>
          <ul className="mt-1 list-disc pl-5 text-muted-foreground">
            {warnings.map((issue) => (
              <li key={`${issue.code}-${issue.field ?? issue.message}`}>
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {job.extracted?.handwritten_notes?.length ? (
        <p className="text-muted-foreground text-sm">
          Handwriting: {job.extracted.handwritten_notes.join("; ")}
        </p>
      ) : null}

      {job.partner_match ? (
        <p className="text-muted-foreground text-sm">
          Partner match ({job.partner_match.confidence}):{" "}
          {job.partner_match.reason}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Document</CardTitle>
            <CardDescription>Original file for visual check</CardDescription>
          </CardHeader>
          <CardContent>
            {isPdf ? (
              <iframe
                title={job.source_filename}
                src={job.document_url}
                className="h-[min(50vh,28rem)] w-full rounded-md border border-border bg-muted"
              />
            ) : (
              // biome-ignore lint/performance/noImgElement: invoice scan from our own API
              <img
                alt={job.source_filename}
                src={job.document_url}
                className="max-h-[min(50vh,28rem)] w-full rounded-md border border-border bg-muted object-contain"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Extracted data</CardTitle>
            <CardDescription>
              Edit, save to re-verify (no extra LLM call), then register. Totals
              are recalculated from line amounts the same way the accounting API
              does.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {!draft ? (
              <p className="text-sm text-muted-foreground">
                No draft to edit. Extraction failed — go back to the queue and
                retry after fixing the error.
              </p>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <Label htmlFor="partner">Partner</Label>
                    <select
                      id="partner"
                      disabled={readOnly}
                      className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                      value={draft.partner_code ?? ""}
                      onChange={(e) =>
                        updateDraft({
                          partner_code: e.target.value || null,
                        })
                      }
                    >
                      <option value="">— unmatched —</option>
                      {partnerOptions.map((p) => (
                        <option key={p.partner_code} value={p.partner_code}>
                          {p.partner_code} · {p.name}
                        </option>
                      ))}
                    </select>
                    {job.extracted?.supplier_name ? (
                      <span className="text-muted-foreground text-xs">
                        Printed: {job.extracted.supplier_name}
                        {job.extracted.supplier_registration_no
                          ? ` · ${job.extracted.supplier_registration_no}`
                          : ""}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="invoice_number">Invoice number</Label>
                    <Input
                      id="invoice_number"
                      disabled={readOnly}
                      value={draft.invoice_number}
                      onChange={(e) =>
                        updateDraft({ invoice_number: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="issue_date">Issue date</Label>
                    <Input
                      id="issue_date"
                      disabled={readOnly}
                      value={draft.issue_date}
                      onChange={(e) =>
                        updateDraft({ issue_date: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="due_date">Due date</Label>
                    <Input
                      id="due_date"
                      disabled={readOnly}
                      value={draft.due_date ?? ""}
                      onChange={(e) =>
                        updateDraft({ due_date: e.target.value || null })
                      }
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label>Lines</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={readOnly}
                      onClick={() =>
                        updateDraft({
                          lines: [
                            ...draft.lines,
                            { ...EMPTY_LINE, uid: crypto.randomUUID() },
                          ],
                        })
                      }
                    >
                      Add line
                    </Button>
                  </div>
                  {draft.lines.map((line, index) => (
                    <div
                      key={line.uid}
                      className="grid gap-2 rounded-lg border border-border p-2 sm:grid-cols-6"
                    >
                      <Input
                        className="sm:col-span-6"
                        disabled={readOnly}
                        placeholder="Description"
                        value={line.description}
                        onChange={(e) =>
                          updateLine(index, { description: e.target.value })
                        }
                      />
                      <Input
                        disabled={readOnly}
                        placeholder="Qty"
                        value={line.quantity ?? ""}
                        onChange={(e) =>
                          updateLine(index, {
                            quantity: parseOptionalInt(e.target.value),
                          })
                        }
                      />
                      <Input
                        disabled={readOnly}
                        placeholder="Unit"
                        value={line.unit}
                        onChange={(e) =>
                          updateLine(index, { unit: e.target.value })
                        }
                      />
                      <Input
                        disabled={readOnly}
                        placeholder="Unit price"
                        value={line.unit_price ?? ""}
                        onChange={(e) =>
                          updateLine(index, {
                            unit_price: parseOptionalInt(e.target.value),
                          })
                        }
                      />
                      <Input
                        disabled={readOnly}
                        placeholder="Amount"
                        value={line.amount}
                        onChange={(e) =>
                          updateLine(index, {
                            amount: parseIntOrZero(e.target.value),
                          })
                        }
                      />
                      <select
                        disabled={readOnly}
                        className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                        value={line.tax_code}
                        onChange={(e) =>
                          updateLine(index, {
                            tax_code: e.target.value as TaxCode,
                          })
                        }
                      >
                        {TAX_CODES.map((code) => (
                          <option key={code} value={code}>
                            {code}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={readOnly || draft.lines.length === 1}
                        onClick={() =>
                          updateDraft({
                            lines: draft.lines.filter((_, i) => i !== index),
                          })
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>

                <dl className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Subtotal</dt>
                    <dd className="tabular-nums">
                      ¥{yen.format(draft.subtotal)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Tax</dt>
                    <dd className="tabular-nums">
                      ¥{yen.format(draft.tax_amount)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Total</dt>
                    <dd className="font-medium tabular-nums">
                      ¥{yen.format(draft.total_amount)}
                    </dd>
                  </div>
                </dl>
                {job.extracted?.printed_total != null ? (
                  <p className="text-muted-foreground text-xs">
                    Printed total: ¥{yen.format(job.extracted.printed_total)}
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={readOnly || busy !== null}
                    onClick={() => void onSave()}
                  >
                    {busy === "save" ? "Saving…" : "Save & re-check"}
                  </Button>
                  <Button
                    type="button"
                    disabled={!canRegister || busy !== null}
                    onClick={() => void onRegister()}
                  >
                    {busy === "register" ? "Registering…" : "Register"}
                  </Button>
                  {!canRegister && !readOnly ? (
                    <span className="text-muted-foreground self-center text-xs">
                      Register stays disabled until blockers are cleared.
                    </span>
                  ) : null}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
