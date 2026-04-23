import { randomUUID } from "crypto";
import { NextResponse, type NextRequest } from "next/server";

import { requireGhlAdmin } from "@/lib/auth/admin";
import { requireApiUser } from "@/lib/auth/api";
import { getGhlConfig } from "@/lib/ghl/config";
import { getGhlRedirectUri } from "@/lib/ghl/client";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const adminResponse = requireGhlAdmin(auth);
  if (adminResponse) return adminResponse;

  const config = getGhlConfig();
  const state = randomUUID();
  const redirectUri = getGhlRedirectUri(request.nextUrl.origin);
  const authUrl = new URL(config.authUrl);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", config.scopes);
  authUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("ghl_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60,
    path: "/",
  });

  return response;
}
