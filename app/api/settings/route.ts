import { NextResponse } from "next/server";
import { getDashboardSettings } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const settings = await getDashboardSettings();
  return NextResponse.json(settings);
}
