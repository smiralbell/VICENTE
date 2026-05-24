import { NextResponse } from "next/server";

const WEBHOOK_URL = process.env.WEBHOOK_SYSTEM_URL;

export async function POST(request: Request) {
  if (!WEBHOOK_URL) {
    return NextResponse.json(
      { error: "WEBHOOK_SYSTEM_URL not configured" },
      { status: 500 }
    );
  }

  let body: { action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action =
    body.action === "publish" || body.action === "unpublish"
      ? body.action
      : undefined;
  if (!action) {
    return NextResponse.json(
      { error: "Body must include action: 'publish' or 'unpublish'" },
      { status: 400 }
    );
  }

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
    return NextResponse.json({ ok: true, action });
  } catch {
    return NextResponse.json(
      { error: "Webhook request failed" },
      { status: 502 }
    );
  }
}
