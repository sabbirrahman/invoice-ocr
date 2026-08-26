import { z } from "zod";

/** Tax codes accepted by the accounting API. */
export const TAX_CODES = ["T10", "T08"] as const;
export type TaxCode = (typeof TAX_CODES)[number];

export const TAX_RATES: Record<TaxCode, number> = {
  T10: 0.1,
  T08: 0.08,
};

export const ConfidenceLevelSchema = z.enum(["high", "medium", "low"]);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

export const JobStatusSchema = z.enum([
  "extracted",
  "needs_review",
  "ready",
  "registered",
  "failed",
]);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const IssueSeveritySchema = z.enum(["blocker", "warning"]);
export type IssueSeverity = z.infer<typeof IssueSeveritySchema>;

/** One line in API-ready / editable-draft shape. */
export const InvoiceLineSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().int().nullable(),
  unit: z.string().min(1),
  unit_price: z.number().int().nullable(),
  amount: z.number().int(),
  tax_code: z.enum(TAX_CODES),
});
export type InvoiceLine = z.infer<typeof InvoiceLineSchema>;

/**
 * Structured extraction from the LLM.
 * Printed supplier identity stays as text; partner_code is resolved later.
 */
export const ExtractedInvoiceSchema = z.object({
  supplier_name: z
    .string()
    .describe("Supplier / issuer name as printed on the invoice"),
  supplier_registration_no: z
    .string()
    .nullable()
    .describe("Tax registration number (登録番号), if present"),
  invoice_number: z.string(),
  issue_date: z.string().describe("YYYY-MM-DD"),
  due_date: z.string().nullable().describe("YYYY-MM-DD or null if missing"),
  currency: z.literal("JPY").default("JPY"),
  lines: z.array(
    z.object({
      description: z.string(),
      quantity: z.number().nullable(),
      unit: z.string().nullable(),
      unit_price: z.number().nullable(),
      amount: z.number(),
      tax_rate_hint: z
        .number()
        .nullable()
        .describe("Printed tax rate as percent, e.g. 10 or 8"),
    }),
  ),
  printed_subtotal: z.number().nullable(),
  printed_tax_amount: z.number().nullable(),
  printed_total: z.number().nullable(),
  handwritten_notes: z
    .array(z.string())
    .default([])
    .describe("Handwritten annotations visible on the document"),
  overall_confidence: ConfidenceLevelSchema,
  field_confidence: z
    .record(z.string(), ConfidenceLevelSchema)
    .default({})
    .describe("Per-field confidence keys, e.g. invoice_number, issue_date"),
  extraction_notes: z
    .string()
    .nullable()
    .describe("Brief note about ambiguities or OCR difficulties"),
});
export type ExtractedInvoice = z.infer<typeof ExtractedInvoiceSchema>;

/** Editable draft ready for verification and API registration. */
export const InvoiceDraftSchema = z.object({
  partner_code: z.string().nullable(),
  invoice_number: z.string(),
  issue_date: z.string(),
  due_date: z.string().nullable(),
  currency: z.literal("JPY"),
  lines: z.array(InvoiceLineSchema),
  subtotal: z.number().int(),
  tax_amount: z.number().int(),
  total_amount: z.number().int(),
});
export type InvoiceDraft = z.infer<typeof InvoiceDraftSchema>;

export const ValidationIssueSchema = z.object({
  code: z.string(),
  severity: IssueSeveritySchema,
  message: z.string(),
  field: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

export const PartnerMatchSchema = z.object({
  partner_code: z.string().nullable(),
  confidence: ConfidenceLevelSchema,
  reason: z.string(),
  candidates: z.array(
    z.object({
      partner_code: z.string(),
      name: z.string(),
    }),
  ),
});
export type PartnerMatch = z.infer<typeof PartnerMatchSchema>;

export const IntakeJobSchema = z.object({
  id: z.string(),
  source_filename: z.string(),
  media_type: z.string(),
  document_url: z.string(),
  status: JobStatusSchema,
  extracted: ExtractedInvoiceSchema.nullable(),
  draft: InvoiceDraftSchema.nullable(),
  partner_match: PartnerMatchSchema.nullable(),
  issues: z.array(ValidationIssueSchema),
  accounting_id: z.string().nullable(),
  register_error: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type IntakeJob = z.infer<typeof IntakeJobSchema>;

/** Payload shape accepted by POST /invoices on the accounting API. */
export const AccountingInvoicePayloadSchema = z.object({
  partner_code: z.string(),
  invoice_number: z.string(),
  issue_date: z.string(),
  due_date: z.string(),
  currency: z.literal("JPY").default("JPY"),
  lines: z.array(InvoiceLineSchema),
  subtotal: z.number().int(),
  tax_amount: z.number().int(),
  total_amount: z.number().int(),
});
export type AccountingInvoicePayload = z.infer<
  typeof AccountingInvoicePayloadSchema
>;
