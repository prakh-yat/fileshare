import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { upsertAppUser } from "@/lib/auth/user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const next = requestUrl.searchParams.get("next") || "/dashboard";
  const supabase = await createSupabaseServerClient();
  const redirectToLogin = (message: string) => {
    const loginUrl = new URL("/login", requestUrl.origin);
    loginUrl.searchParams.set("error", message);
    return NextResponse.redirect(loginUrl);
  };

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return redirectToLogin(error.message);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (error) return redirectToLogin(error.message);
  } else {
    return NextResponse.redirect(new URL(`/auth/confirm${requestUrl.search}`, requestUrl.origin));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await upsertAppUser(user);
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
