import { NextResponse } from "next/server";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

export async function GET() {
  const dir = join(process.cwd(), "invoices");
  try {
    const names = (await readdir(dir))
      .filter((n) => /\.(pdf|jpg|jpeg|png)$/i.test(n))
      .sort();
    return NextResponse.json({ samples: names });
  } catch {
    return NextResponse.json(
      { error: "Sample invoices folder not found", samples: [] },
      { status: 404 },
    );
  }
}
