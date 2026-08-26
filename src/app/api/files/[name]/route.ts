import { basename, join } from "node:path";
import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";

export const runtime = "nodejs";

type Params = { params: Promise<{ name: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { name } = await params;
  const safe = basename(name);
  const filePath = join(process.cwd(), "uploads", safe);

  try {
    const bytes = await readFile(filePath);
    const lower = safe.toLowerCase();
    const contentType = lower.endsWith(".pdf")
      ? "application/pdf"
      : lower.endsWith(".png")
        ? "image/png"
        : "image/jpeg";

    return new NextResponse(bytes, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
