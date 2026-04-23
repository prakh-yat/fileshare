import { NextResponse } from "next/server";

import type { ApiAuthResult } from "@/lib/auth/api";

export function requireGhlAdmin(auth: ApiAuthResult) {
  if (auth.response) return auth.response;

  const allowedEmails = (process.env.GHL_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const userEmail = auth.supabaseUser.email?.toLowerCase();

  if (!allowedEmails.length || !userEmail || !allowedEmails.includes(userEmail)) {
    return NextResponse.json(
      { error: "This backend setup endpoint is restricted to GHL admins." },
      { status: 403 },
    );
  }

  return null;
}
