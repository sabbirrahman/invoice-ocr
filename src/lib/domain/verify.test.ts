import type { InvoiceDraft } from "@/lib/domain/schema";

import { describe, expect, it } from "vitest";

import {
  recalculateFromLines,
  deriveStatus,
  verifyDraft,
} from "@/lib/domain/verify";

/** Example payload from the take-home API docs. */
const exampleDraft: InvoiceDraft = {
  partner_code: "P-1001",
  invoice_number: "YM-2026-0107",
  issue_date: "2026-01-07",
  due_date: "2026-02-28",
  currency: "JPY",
  lines: [
    {
      description: "Precision part A-100",
      quantity: 120,
      unit: "pcs",
      unit_price: 1250,
      amount: 150000,
      tax_code: "T10",
    },
    {
      description: "Packing and freight",
      quantity: null,
      unit: "lot",
      unit_price: null,
      amount: 18000,
      tax_code: "T10",
    },
  ],
  subtotal: 168000,
  tax_amount: 16800,
  total_amount: 184800,
};

describe("recalculateFromLines", () => {
  it("matches the accounting API example (floor tax on T10)", () => {
    const result = recalculateFromLines(exampleDraft.lines);
    expect(result.subtotal).toBe(168000);
    expect(result.tax_amount).toBe(16800);
    expect(result.total_amount).toBe(184800);
    expect(result.tax_by_code).toEqual({ T10: 16800 });
  });

  it("computes tax per code and floors each", () => {
    const result = recalculateFromLines([
      {
        description: "food",
        quantity: 1,
        unit: "pcs",
        unit_price: 1000,
        amount: 1000,
        tax_code: "T08",
      },
      {
        description: "goods",
        quantity: 1,
        unit: "pcs",
        unit_price: 1000,
        amount: 1000,
        tax_code: "T10",
      },
    ]);
    expect(result.subtotal).toBe(2000);
    expect(result.tax_by_code).toEqual({ T08: 80, T10: 100 });
    expect(result.tax_amount).toBe(180);
    expect(result.total_amount).toBe(2180);
  });
});

describe("verifyDraft", () => {
  it("accepts the API example payload with no blockers", () => {
    const issues = verifyDraft(exampleDraft);
    expect(issues.filter((i) => i.severity === "blocker")).toHaveLength(0);
    expect(deriveStatus(issues)).toBe("ready");
  });

  it("flags AMOUNT_MISMATCH when tax is wrong", () => {
    const issues = verifyDraft({
      ...exampleDraft,
      tax_amount: 0,
      total_amount: 168000,
    });
    expect(
      issues.filter((i) => i.code === "AMOUNT_MISMATCH").length,
    ).toBeGreaterThanOrEqual(1);
    expect(deriveStatus(issues)).toBe("needs_review");
  });

  it("flags missing partner as blocker", () => {
    const issues = verifyDraft({ ...exampleDraft, partner_code: null });
    expect(issues.some((i) => i.code === "PARTNER_REQUIRED")).toBe(true);
  });

  it("flags due date before issue date", () => {
    const issues = verifyDraft({
      ...exampleDraft,
      issue_date: "2026-03-01",
      due_date: "2026-02-01",
    });
    expect(issues.some((i) => i.code === "DUE_DATE_BEFORE_ISSUE_DATE")).toBe(
      true,
    );
  });

  it("warns when printed total differs", () => {
    const issues = verifyDraft(exampleDraft, { printed_total: 999 });
    expect(issues.some((i) => i.code === "PRINTED_TOTAL_DIFFERS")).toBe(true);
    expect(deriveStatus(issues)).toBe("ready");
  });

  it("warns when quantity × unit_price does not match amount", () => {
    const issues = verifyDraft({
      ...exampleDraft,
      lines: [
        {
          ...exampleDraft.lines[0],
          quantity: 10,
          unit_price: 100,
          amount: 150000,
        },
        exampleDraft.lines[1],
      ],
    });
    expect(issues.some((i) => i.code === "LINE_AMOUNT_MISMATCH")).toBe(true);
  });
});
