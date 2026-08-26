import type {
  ExtractedInvoice,
  InvoiceDraft,
  TaxCode,
} from "@/lib/domain/schema";
import { recalculateFromLines } from "@/lib/domain/verify";

/** Map a printed tax rate percent to an accounting tax code. */
export function taxCodeFromHint(hint: number | null | undefined): TaxCode {
  if (hint === 8 || hint === 0.08) return "T08";
  return "T10";
}

function toInt(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return Math.round(value);
}

/**
 * Build an editable draft from LLM extraction + resolved partner_code.
 * Totals are always recomputed from lines (API truth), not taken from the model.
 */
export function draftFromExtraction(
  extracted: ExtractedInvoice,
  partnerCode: string | null,
): InvoiceDraft {
  const lines = extracted.lines.map((line) => {
    const amount = toInt(line.amount) ?? 0;
    return {
      description: line.description?.trim() || "(no description)",
      quantity: toInt(line.quantity),
      unit: line.unit?.trim() || "式",
      unit_price: toInt(line.unit_price),
      amount,
      tax_code: taxCodeFromHint(line.tax_rate_hint),
    };
  });

  const totals = recalculateFromLines(lines);

  return {
    partner_code: partnerCode,
    invoice_number: extracted.invoice_number?.trim() || "",
    issue_date: extracted.issue_date?.trim() || "",
    due_date: extracted.due_date?.trim() || null,
    currency: "JPY",
    lines,
    subtotal: totals.subtotal,
    tax_amount: totals.tax_amount,
    total_amount: totals.total_amount,
  };
}
