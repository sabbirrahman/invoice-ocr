import { generateText, Output } from "ai";
import { getModel } from "@/lib/ai/model";
import {
  EXTRACTION_SYSTEM_PROMPT,
  EXTRACTION_USER_PROMPT,
} from "@/lib/ai/prompt";
import {
  type ExtractedInvoice,
  ExtractedInvoiceSchema,
} from "@/lib/domain/schema";

export type ExtractInput = {
  bytes: Uint8Array;
  mediaType: string;
  filename?: string;
};

/**
 * Structured invoice extraction via the Vercel AI SDK.
 * Model/provider come from getModel() (env-swappable).
 *
 * Uses generateText + Output.object (AI SDK 7). Mapping to partner_code /
 * tax_code happens after this, in our code — not in the prompt.
 */
export async function extractInvoice(
  input: ExtractInput,
): Promise<ExtractedInvoice> {
  const isPdf =
    input.mediaType === "application/pdf" ||
    input.filename?.toLowerCase().endsWith(".pdf");

  const filePart = isPdf
    ? {
        type: "file" as const,
        data: input.bytes,
        mediaType: "application/pdf" as const,
      }
    : {
        type: "image" as const,
        image: input.bytes,
        mediaType: input.mediaType || "image/jpeg",
      };

  const { output } = await generateText({
    model: getModel(),
    output: Output.object({ schema: ExtractedInvoiceSchema }),
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: EXTRACTION_USER_PROMPT,
          },
          filePart,
        ],
      },
    ],
  });

  if (!output) {
    throw new Error("Model did not return structured invoice data");
  }

  return output;
}
