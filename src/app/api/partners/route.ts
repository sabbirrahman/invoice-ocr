import { NextResponse } from "next/server";
import { listPartners } from "@/lib/accounting/client";

export const runtime = "nodejs";

export async function GET() {
  try {
    const partners = await listPartners();
    return NextResponse.json({ partners });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load partners";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
