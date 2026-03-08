import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "dashboard_session";

async function getExpectedToken(): Promise<string | null> {
  const secret = process.env.SESSION_SECRET;
  const password = process.env.DASHBOARD_PASSWORD;
  if (!secret || !password) return null;
  const data = new TextEncoder().encode(secret + password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/login") {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const expected = await getExpectedToken();
    if (token && expected && token === expected) {
      return NextResponse.redirect(new URL("/leads", request.url));
    }
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const expected = await getExpectedToken();
  if (!expected || token !== expected) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/leads",
    "/leads/:path*",
    "/conversations",
    "/conversations/:path*",
    "/api/conversations",
    "/login",
  ],
};
