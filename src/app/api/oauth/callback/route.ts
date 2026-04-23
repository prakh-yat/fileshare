import { NextResponse, type NextRequest } from "next/server";

import { requireGhlAdmin } from "@/lib/auth/admin";
import { requireApiUser } from "@/lib/auth/api";
import {
  exchangeAuthorizationCode,
  getGhlRedirectUri,
  saveGhlAppConnection,
} from "@/lib/ghl/client";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireApiUser();
  if (auth.response) return NextResponse.redirect(new URL("/login", request.url));
  const adminResponse = requireGhlAdmin(auth);
  if (adminResponse) return adminResponse;

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("ghl_oauth_state")?.value;
  const dashboardUrl = new URL("/dashboard", request.url);

  if (!code) {
    dashboardUrl.searchParams.set("ghl", "missing-code");
    return NextResponse.redirect(dashboardUrl);
  }

  if (expectedState && state !== expectedState) {
    dashboardUrl.searchParams.set("ghl", "state-mismatch");
    return NextResponse.redirect(dashboardUrl);
  }

  try {
    const token = await exchangeAuthorizationCode(code, getGhlRedirectUri(request.nextUrl.origin));
    await saveGhlAppConnection(token);
    dashboardUrl.searchParams.set("ghl", "connected");
  } catch (error) {
    dashboardUrl.searchParams.set("ghl", "token-error");
    dashboardUrl.searchParams.set(
      "message",
      error instanceof Error ? error.message : "Unable to exchange authorization code.",
    );
  }

  const response = NextResponse.redirect(dashboardUrl);
  response.cookies.delete("ghl_oauth_state");
  return response;
}
