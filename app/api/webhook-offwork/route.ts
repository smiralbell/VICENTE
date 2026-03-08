import { NextResponse } from "next/server";

const WEBHOOK_URL = process.env.WEBHOOK_OFFWORK_URL;

export async function POST(request: Request) {
  if (!WEBHOOK_URL) {
    return NextResponse.json(
      { error: "WEBHOOK_OFFWORK_URL not configured" },
      { status: 500 }
    );
  }

  let body: { state?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const state = body.state === "on" || body.state === "off" ? body.state : undefined;
  if (!state) {
    return NextResponse.json(
      { error: "Body must include state: 'on' or 'off'" },
      { status: 400 }
    );
  }

  try {
    const url = new URL(WEBHOOK_URL);
    url.searchParams.set("state", state);
    url.searchParams.set("label", state);

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        state,
        label: state,
      }),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "Webhook request failed" },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, state });
  } catch (err) {
    return NextResponse.json(
      { error: "Webhook request failed" },
      { status: 502 }
    );
  }
}
