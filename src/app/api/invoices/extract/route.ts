import { NextResponse } from "next/server";
import { processInvoiceBytes } from "@/lib/intake/process";

export const runtime = "nodejs";

/**
 * POST multipart: file=<upload>
 */
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Expected multipart field `file`" },
      { status: 400 },
    );
  }

  try {
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
