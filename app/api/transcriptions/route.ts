import { NextRequest, NextResponse } from "next/server";
import { getTranscriptions } from "@/lib/db";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? undefined;
  const items = await getTranscriptions(q || undefined);
  return NextResponse.json(items);
}

