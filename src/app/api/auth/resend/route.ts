import { NextResponse, type NextRequest } from "next/server";

import { getPublicAppUrl } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ResendBody = {
  email?: string;
};

export async function POST(request: NextRequest) {
  let body: ResendBody;
  try {
    body = (await request.json()) as ResendBody;
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

  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${appUrl}/auth/confirm?next=/dashboard`,
    },
  });

  if (error) {
    const message = error.message.toLowerCase();

    // Treat "already confirmed" as success-with-info so the UI can route
    // the user to sign in or password reset rather than spamming the inbox.
    if (
      message.includes("already") &&
      (message.includes("confirmed") || message.includes("registered"))
    ) {
      return NextResponse.json(
        {
          alreadyConfirmed: true,
          message: "This email is already confirmed. Try signing in or resetting your password.",
        },
        { status: 200 },
      );
    }

    if (message.includes("rate")) {
      return NextResponse.json(
        { error: "Too many requests. Wait a moment before trying again." },
        { status: 429 },
      );
    }

    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
