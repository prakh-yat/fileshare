import { NextResponse, type NextRequest } from "next/server";

import { sendAuthEmail } from "@/lib/auth/email";
import { getPublicAppUrl } from "@/lib/env";
import { getSupabaseAdminClient, hasSupabaseAdminCredentials } from "@/lib/supabase/admin";
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

  const origin = request.headers.get("origin");
  const appUrl = getPublicAppUrl(origin);

  if (hasSupabaseAdminCredentials()) {
    return resendViaAdmin({ email, appUrl });
  }

  // Fallback path
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${appUrl}/auth/confirm?next=/dashboard` },
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("already") && message.includes("confirmed")) {
      return NextResponse.json(
        {
          alreadyConfirmed: true,
          message:
            "This email is already confirmed. Try signing in or resetting your password.",
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

async function resendViaAdmin({ email, appUrl }: { email: string; appUrl: string }) {
  const admin = getSupabaseAdminClient();

  // Find user
  let user = null;
  let page = 1;
  while (page <= 50) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) {
      console.error("[resend] listUsers failed:", error.message);
      break;
    }
    user = data.users.find((u) => u.email && u.email.toLowerCase() === email);
    if (user) break;
    if (data.users.length < 100) break;
    page += 1;
  }

  if (!user) {
    // Don't leak account existence — return success silently.
    return NextResponse.json({ ok: true });
  }

  if (user.email_confirmed_at) {
    return NextResponse.json(
      {
        alreadyConfirmed: true,
        message:
          "This email is already confirmed. Try signing in or resetting your password.",
      },
      { status: 200 },
    );
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "signup",
    email,
    options: { redirectTo: `${appUrl}/auth/confirm?next=/dashboard` },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  if (linkError) {
    console.error("[resend] generateLink failed:", linkError.message);
    return NextResponse.json({ error: linkError.message }, { status: 500 });
  }

  const tokenHash =
    (linkData as { properties?: { hashed_token?: string }; hashed_token?: string }).properties
      ?.hashed_token ??
    (linkData as { hashed_token?: string }).hashed_token;

  if (!tokenHash) {
    return NextResponse.json(
      { error: "Verification link was generated without a token." },
      { status: 500 },
    );
  }

  const sendResult = await sendAuthEmail({
    kind: "confirmation",
    to: email,
    appUrl,
    tokenHash,
    next: "/dashboard",
  });

  if (!sendResult.delivered) {
    console.error("[resend] SMTP send failed:", sendResult.error);
    return NextResponse.json(
      { error: `Could not deliver the email: ${sendResult.error}` },
      { status: 502 },
    );
  }

  console.log(
    `[resend] confirmation email delivered to ${email} via SMTP in ${sendResult.smtp?.durationMs}ms`,
  );

  return NextResponse.json({
    ok: true,
    delivery: { via: "smtp", durationMs: sendResult.smtp?.durationMs },
  });
}
