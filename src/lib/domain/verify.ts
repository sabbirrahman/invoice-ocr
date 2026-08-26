import type {
  ValidationIssue,
  InvoiceDraft,
  TaxCode,
} from "@/lib/domain/schema";
import { TAX_RATES } from "@/lib/domain/schema";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Recompute tax the same way the accounting API does:
 * floor(subtotal_by_tax_code * rate) per code, then sum.
 */
export function recalculateFromLines(lines: InvoiceDraft["lines"]): {
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  tax_by_code: Record<string, number>;
} {
  const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
  const subtotalByCode: Record<string, number> = {};

  for (const line of lines) {
    subtotalByCode[line.tax_code] =
      (subtotalByCode[line.tax_code] ?? 0) + line.amount;
  }

  const tax_by_code: Record<string, number> = {};
  for (const [code, amount] of Object.entries(subtotalByCode)) {
    const rate = TAX_RATES[code as TaxCode];
    if (rate === undefined) continue;
    tax_by_code[code] = Math.floor(amount * rate);
  }

  const tax_amount = Object.values(tax_by_code).reduce((a, b) => a + b, 0);
  return {
    subtotal,
    tax_amount,
    total_amount: subtotal + tax_amount,
    tax_by_code,
  };
}

/**
 * Deterministic checks that mirror the accounting API business rules
 * plus intake-specific warnings (line qty×price, printed totals).
 */
export function verifyDraft(
  draft: InvoiceDraft,
  options?: {
    printed_subtotal?: number | null;
    printed_tax_amount?: number | null;
    printed_total?: number | null;
    requirePartner?: boolean;
  },
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const requirePartner = options?.requirePartner ?? true;

  if (requirePartner && !draft.partner_code) {
    issues.push({
      code: "PARTNER_REQUIRED",
      severity: "blocker",
      message: "Partner code is required before registration",
      field: "partner_code",
    });
  }

  if (!draft.invoice_number?.trim()) {
    issues.push({
      code: "INVOICE_NUMBER_REQUIRED",
      severity: "blocker",
      message: "Invoice number is required",
      field: "invoice_number",
    });
  }

  if (!isRealDate(draft.issue_date)) {
    issues.push({
      code: "INVALID_ISSUE_DATE",
      severity: "blocker",
      message: "issue_date must be a real date in YYYY-MM-DD format",
      field: "issue_date",
      details: { received: draft.issue_date },
    });
  }

  if (!draft.due_date || !isRealDate(draft.due_date)) {
    issues.push({
      code: "INVALID_DUE_DATE",
      severity: "blocker",
      message: "due_date must be a real date in YYYY-MM-DD format",
      field: "due_date",
      details: { received: draft.due_date },
    });
  } else if (
    isRealDate(draft.issue_date) &&
    draft.due_date < draft.issue_date
  ) {
    issues.push({
      code: "DUE_DATE_BEFORE_ISSUE_DATE",
      severity: "blocker",
      message: "due_date is earlier than issue_date",
      field: "due_date",
      details: {
        issue_date: draft.issue_date,
        due_date: draft.due_date,
      },
    });
  }

  if (!draft.lines.length) {
    issues.push({
      code: "LINES_REQUIRED",
      severity: "blocker",
      message: "At least one line item is required",
      field: "lines",
    });
    return issues;
  }

  draft.lines.forEach((line, index) => {
    if (
      line.quantity !== null &&
      line.unit_price !== null &&
      line.quantity * line.unit_price !== line.amount
    ) {
      issues.push({
        code: "LINE_AMOUNT_MISMATCH",
        severity: "warning",
        message: `lines[${index}]: quantity × unit_price ≠ amount`,
        field: `lines.${index}.amount`,
        details: {
          quantity: line.quantity,
          unit_price: line.unit_price,
          amount: line.amount,
          expected: line.quantity * line.unit_price,
        },
      });
    }
  });

  const expected = recalculateFromLines(draft.lines);

  if (draft.subtotal !== expected.subtotal) {
    issues.push({
      code: "AMOUNT_MISMATCH",
      severity: "blocker",
      message: "subtotal does not match the sum of the line amounts",
      field: "subtotal",
      details: {
        expected_subtotal: expected.subtotal,
        received_subtotal: draft.subtotal,
      },
    });
  }

  if (draft.tax_amount !== expected.tax_amount) {
    issues.push({
      code: "AMOUNT_MISMATCH",
      severity: "blocker",
      message: "tax_amount does not match tax recalculated from the lines",
      field: "tax_amount",
      details: {
        expected_tax: expected.tax_amount,
        received_tax: draft.tax_amount,
        expected_tax_by_code: expected.tax_by_code,
      },
    });
  }

  if (draft.total_amount !== expected.total_amount) {
    issues.push({
      code: "AMOUNT_MISMATCH",
      severity: "blocker",
      message: "total_amount does not match amount recalculated from the lines",
      field: "total_amount",
      details: {
        expected_total: expected.total_amount,
        received_total: draft.total_amount,
      },
    });
  }

  if (
    options?.printed_total != null &&
    options.printed_total !== draft.total_amount
  ) {
    issues.push({
      code: "PRINTED_TOTAL_DIFFERS",
      severity: "warning",
      message:
        options.printed_total - draft.total_amount === 1 ||
        draft.total_amount - options.printed_total === 1
          ? "Draft total is ¥1 off the printed total (likely floor-rounding of consumption tax). The accounting API uses floor tax, so we keep the recalculated total."
          : "Draft total differs from the total printed on the invoice",
      field: "total_amount",
      details: {
        printed_total: options.printed_total,
        draft_total: draft.total_amount,
      },
    });
  }

  if (
    options?.printed_subtotal != null &&
    options.printed_subtotal !== draft.subtotal
  ) {
    issues.push({
      code: "PRINTED_SUBTOTAL_DIFFERS",
      severity: "warning",
      message:
        "Draft subtotal differs from the subtotal printed on the invoice",
      field: "subtotal",
      details: {
        printed_subtotal: options.printed_subtotal,
        draft_subtotal: draft.subtotal,
      },
    });
  }

  if (
    options?.printed_tax_amount != null &&
    options.printed_tax_amount !== draft.tax_amount
  ) {
    issues.push({
      code: "PRINTED_TAX_DIFFERS",
      severity: "warning",
      message: "Draft tax differs from the tax printed on the invoice",
      field: "tax_amount",
      details: {
        printed_tax_amount: options.printed_tax_amount,
        draft_tax: draft.tax_amount,
      },
    });
  }

  return issues;
}

export function hasBlockers(issues: ValidationIssue[]): boolean {
  return issues.some((i) => i.severity === "blocker");
}

export function deriveStatus(
  issues: ValidationIssue[],
  options?: { registered?: boolean; failed?: boolean },
): "needs_review" | "ready" | "registered" | "failed" {
  if (options?.failed) return "failed";
  if (options?.registered) return "registered";
  return hasBlockers(issues) ? "needs_review" : "ready";
}
