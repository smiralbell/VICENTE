import { NextResponse } from "next/server";
import { getDashboardSettings } from "@/lib/db";

export async function GET() {
  const settings = await getDashboardSettings();
  return NextResponse.json(settings);
}
