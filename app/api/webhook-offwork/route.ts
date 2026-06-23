import { NextResponse } from "next/server";
import { setOffWorkOnlySetting } from "@/lib/db";

const WEBHOOK_URL = process.env.WEBHOOK_OFFWORK_URL;

export async function POST(request: Request) {
  if (!WEBHOOK_URL) {
    return NextResponse.json(
      { error: "WEBHOOK_OFFWORK_URL not configured" },
      { status: 500 }
    );
  }

  let body: { offWorkOnly?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.offWorkOnly !== "boolean") {
    return NextResponse.json(
      { error: "Body must include offWorkOnly: boolean" },
      { status: 400 }
    );
  }

  const state = body.offWorkOnly ? "off" : "on";

  try {
    const url = new URL(WEBHOOK_URL);
    url.searchParams.set("state", state);
    url.searchParams.set("label", state);

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state, label: state }),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "Webhook request failed" },
        { status: 502 }
      );
    }

    const settings = await setOffWorkOnlySetting(body.offWorkOnly);
    return NextResponse.json({ ok: true, state, ...settings });
  } catch {
    return NextResponse.json(
      { error: "Webhook request failed" },
      { status: 502 }
    );
  }
}
