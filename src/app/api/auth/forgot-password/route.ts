import { NextResponse, type NextRequest } from "next/server";

import { getPublicAppUrl } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ForgotBody = {
  email?: string;
};

export async function POST(request: NextRequest) {
  let body: ForgotBody;
  try {
    body = (await request.json()) as ForgotBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const origin = request.headers.get("origin");
  const appUrl = getPublicAppUrl(origin);

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/confirm?next=/auth/reset-password`,
  });

  // Always return success to avoid leaking whether the email exists.
  if (error && !error.message.toLowerCase().includes("not found")) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
