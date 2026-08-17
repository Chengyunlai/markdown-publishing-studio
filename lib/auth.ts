import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

export const ADMIN_COOKIE = "blog_admin_session";

function password() {
  return process.env.ADMIN_PASSWORD || "";
}

function token(secret: string) {
  return createHmac("sha256", secret).update("markdown-publishing-studio-session-v1").digest("hex");
}

export function isConfigured() {
  return Boolean(password());
}

export function verifyPassword(candidate: string) {
  const expected = password();
  if (!candidate || !expected) return false;
  return timingSafeEqual(Buffer.from(token(candidate)), Buffer.from(token(expected)));
}

export function sessionToken() {
  return password() ? token(password()) : "";
}

export function isAuthenticated(request: NextRequest) {
  const session = request.cookies.get(ADMIN_COOKIE)?.value;
  const expected = sessionToken();
  if (!session || !expected || session.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(session), Buffer.from(expected));
}
