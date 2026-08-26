import type { IntakeJob } from "@/lib/domain/schema";

import { writeFile, mkdir } from "node:fs/promises";
import { basename, join } from "node:path";

import { statusFromIssues, buildJobIssues } from "@/lib/intake/issues";
import { draftFromExtraction } from "@/lib/domain/draft-from-extraction";
import { newJobId, saveJob } from "@/lib/store";
import { extractInvoice } from "@/lib/ai/extract";
import { matchPartner } from "@/lib/domain/match-partner";
import { listPartners } from "@/lib/accounting/client";

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

    job = {
      ...job,
      extracted,
      draft,
      partner_match: partnerMatch,
      updated_at: new Date().toISOString(),
    };
    saveJob(job);

    const issues = await buildJobIssues(job);
    job = {
      ...job,
      issues,
      status: statusFromIssues(issues),
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
