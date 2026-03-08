import { cookies } from "next/headers";
import { createHash } from "crypto";

const SESSION_COOKIE = "dashboard_session";
const SESSION_MAX_AGE = 60 * 60 * 24; // 24 hours

function getSessionToken(): string | undefined {
  const secret = process.env.SESSION_SECRET;
  const password = process.env.DASHBOARD_PASSWORD;
  if (!secret || !password) return undefined;
  return createHash("sha256").update(secret + password).digest("hex");
}

export async function createSession(): Promise<void> {
  const token = getSessionToken();
  if (!token) return;
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export async function validateSession(): Promise<boolean> {
  const token = getSessionToken();
  if (!token) return false;
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(SESSION_COOKIE)?.value;
  return cookieValue === token;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
