import { NextRequest, NextResponse } from "next/server";
import { getConversationSessionsWithLeadAndPreview } from "@/lib/db";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? undefined;
  const sessions = await getConversationSessionsWithLeadAndPreview(q || undefined);
  return NextResponse.json(sessions);
}
