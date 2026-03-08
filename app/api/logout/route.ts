import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "dashboard_session";

export async function POST(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  const res = NextResponse.redirect(url);
  res.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
  return res;
}
