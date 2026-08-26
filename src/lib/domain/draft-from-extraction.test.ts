import type { ExtractedInvoice } from "@/lib/domain/schema";

import {
  draftFromExtraction,
  taxCodeFromHint,
} from "@/lib/domain/draft-from-extraction";
import { describe, expect, it } from "vitest";

const extracted: ExtractedInvoice = {
  supplier_name: "株式会社山田製作所",
  supplier_registration_no: "T1010001000101",
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
      tax_rate_hint: 10,
    },
    {
      description: "Packing and freight",
      quantity: null,
      unit: "lot",
      unit_price: null,
      amount: 18000,
      tax_rate_hint: 10,
    },
  ],
  printed_subtotal: 168000,
  printed_tax_amount: 16800,
  printed_total: 184800,
  handwritten_notes: [],
  overall_confidence: "high",
  field_confidence: {},
  extraction_notes: null,
};

describe("taxCodeFromHint", () => {
  it("maps 8% to T08 and everything else to T10", () => {
    expect(taxCodeFromHint(8)).toBe("T08");
    expect(taxCodeFromHint(10)).toBe("T10");
    expect(taxCodeFromHint(null)).toBe("T10");
  });
});

describe("draftFromExtraction", () => {
  it("recomputes totals from lines instead of trusting printed totals", () => {
    const draft = draftFromExtraction(
      { ...extracted, printed_total: 1 },
      "P-1001",
    );
    expect(draft.partner_code).toBe("P-1001");
    expect(draft.subtotal).toBe(168000);
    expect(draft.tax_amount).toBe(16800);
    expect(draft.total_amount).toBe(184800);
    expect(draft.lines.every((line) => line.tax_code === "T10")).toBe(true);
  });
});
