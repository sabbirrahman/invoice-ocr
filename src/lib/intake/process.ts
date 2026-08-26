import type { IntakeJob } from "@/lib/domain/schema";

import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { deriveStatus, verifyDraft } from "@/lib/domain/verify";
import { draftFromExtraction } from "@/lib/domain/draft-from-extraction";
import { newJobId, saveJob } from "@/lib/store";
import { extractInvoice } from "@/lib/ai/extract";
import { listPartners } from "@/lib/accounting/client";
import { matchPartner } from "@/lib/domain/match-partner";

const UPLOAD_DIR = join(process.cwd(), "uploads");

async function ensureUploadDir(): Promise<void> {
  await mkdir(UPLOAD_DIR, { recursive: true });
}

function mediaTypeForFilename(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

/**
 * Extract → match partner → verify → persist an intake job.
 */
export async function processInvoiceBytes(input: {
  bytes: Uint8Array;
  filename: string;
  mediaType?: string;
}): Promise<IntakeJob> {
  const mediaType = input.mediaType || mediaTypeForFilename(input.filename);
  await ensureUploadDir();

  const id = newJobId();
  const storedName = `${id}_${basename(input.filename)}`;
  const diskPath = join(UPLOAD_DIR, storedName);
  await writeFile(diskPath, input.bytes);

  const now = new Date().toISOString();
  let job: IntakeJob = {
    id,
    source_filename: input.filename,
    media_type: mediaType,
    document_url: `/api/files/${storedName}`,
    status: "extracted",
    extracted: null,
    draft: null,
    partner_match: null,
    issues: [],
    accounting_id: null,
    register_error: null,
    created_at: now,
    updated_at: now,
  };

  try {
    const extracted = await extractInvoice({
      bytes: input.bytes,
      mediaType,
      filename: input.filename,
    });
    const partners = await listPartners();
    const partnerMatch = matchPartner(partners, {
      supplier_name: extracted.supplier_name,
      supplier_registration_no: extracted.supplier_registration_no,
    });
    const draft = draftFromExtraction(extracted, partnerMatch.partner_code);

    const lowConfidence =
      extracted.overall_confidence === "low" ||
      Object.values(extracted.field_confidence).includes("low");

    const issues = verifyDraft(draft, {
      printed_subtotal: extracted.printed_subtotal,
      printed_tax_amount: extracted.printed_tax_amount,
      printed_total: extracted.printed_total,
    });

    if (lowConfidence) {
      issues.push({
        code: "LOW_CONFIDENCE",
        severity: "warning",
        message:
          "Model reported low confidence on one or more fields — please review carefully",
      });
    }

    if (extracted.handwritten_notes.length) {
      issues.push({
        code: "HANDWRITTEN_NOTES",
        severity: "warning",
        message: `Handwriting detected: ${extracted.handwritten_notes.join("; ")}`,
      });
    }

    job = {
      ...job,
      extracted,
      draft,
      partner_match: partnerMatch,
      issues,
      status: deriveStatus(issues),
      updated_at: new Date().toISOString(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed";
    job = {
      ...job,
      status: "failed",
      issues: [
        {
          code: "EXTRACTION_FAILED",
          severity: "blocker",
          message,
        },
      ],
      register_error: message,
      updated_at: new Date().toISOString(),
    };
  }

  return saveJob(job);
}
