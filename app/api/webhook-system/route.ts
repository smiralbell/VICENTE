import { NextResponse } from "next/server";
import { setSystemPublishedSetting } from "@/lib/db";

const WEBHOOK_URL = process.env.WEBHOOK_SYSTEM_URL;

export async function POST(request: Request) {
  if (!WEBHOOK_URL) {
    return NextResponse.json(
      { error: "WEBHOOK_SYSTEM_URL not configured" },
      { status: 500 }
    );
  }

  let body: { systemPublished?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.systemPublished !== "boolean") {
    return NextResponse.json(
      { error: "Body must include systemPublished: boolean" },
      { status: 400 }
    );
  }

  const action = body.systemPublished ? "publish" : "unpublish";

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "Webhook request failed" },
        { status: 502 }
      );
    }

    const settings = await setSystemPublishedSetting(body.systemPublished);
    return NextResponse.json({ ok: true, action, ...settings });
  } catch {
    return NextResponse.json(
      { error: "Webhook request failed" },
      { status: 502 }
    );
  }
}
