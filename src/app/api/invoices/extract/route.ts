import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { processInvoiceBytes } from "@/lib/intake/process";

export const runtime = "nodejs";

/**
 * POST multipart: file=<upload>
 * or JSON: { sample: "invoice_01.pdf" }
 */
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "Expected multipart field `file`" },
          { status: 400 },
        );
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      const job = await processInvoiceBytes({
        bytes,
        filename: file.name,
        mediaType: file.type || undefined,
      });
      return NextResponse.json({ job }, { status: 201 });
    }

    const body = (await request.json()) as { sample?: string };
    if (!body.sample) {
      return NextResponse.json(
        { error: "Provide multipart `file` or JSON `{ sample }`" },
        { status: 400 },
      );
    }

    const safe = path.basename(body.sample);
    const samplePath = path.join(process.cwd(), "invoices", safe);
    const bytes = new Uint8Array(await readFile(samplePath));
    const job = await processInvoiceBytes({
      bytes,
      filename: safe,
    });
    return NextResponse.json({ job }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
