import { NextResponse, type NextRequest } from "next/server";

import { sendAuthEmail } from "@/lib/auth/email";
import { getPublicAppUrl } from "@/lib/env";
import { getSupabaseAdminClient, hasSupabaseAdminCredentials } from "@/lib/supabase/admin";
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

  const origin = request.headers.get("origin");
  const appUrl = getPublicAppUrl(origin);

  if (hasSupabaseAdminCredentials()) {
    return forgotViaAdmin({ email, appUrl });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/confirm?next=/auth/reset-password`,
  });
  if (error && !error.message.toLowerCase().includes("not found")) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

async function forgotViaAdmin({ email, appUrl }: { email: string; appUrl: string }) {
  const admin = getSupabaseAdminClient();

  // Always respond 200 even if the email doesn't match an account, but skip
  // sending in that case (we don't want to leak account existence).
  let userExists = false;
  let page = 1;
  while (page <= 50) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) {
      console.error("[forgot-password] listUsers failed:", error.message);
      break;
    }
    if (data.users.some((u) => u.email && u.email.toLowerCase() === email)) {
      userExists = true;
      break;
    }
    if (data.users.length < 100) break;
    page += 1;
  }

  if (!userExists) {
    return NextResponse.json({ ok: true });
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${appUrl}/auth/confirm?next=/auth/reset-password` },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  if (linkError) {
    console.error("[forgot-password] generateLink failed:", linkError.message);
    // Still return 200 to avoid revealing internal errors; log server-side.
    return NextResponse.json({ ok: true });
  }

  const tokenHash =
    (linkData as { properties?: { hashed_token?: string }; hashed_token?: string }).properties
      ?.hashed_token ??
    (linkData as { hashed_token?: string }).hashed_token;

  if (!tokenHash) {
    console.error("[forgot-password] no token in generateLink response");
    return NextResponse.json({ ok: true });
  }

  const sendResult = await sendAuthEmail({
    kind: "recovery",
    to: email,
    appUrl,
    tokenHash,
    next: "/auth/reset-password",
  });

  if (!sendResult.delivered) {
    console.error("[forgot-password] SMTP send failed:", sendResult.error);
    return NextResponse.json({ ok: true });
  }

  console.log(
    `[forgot-password] recovery email delivered to ${email} in ${sendResult.smtp?.durationMs}ms`,
  );
  return NextResponse.json({ ok: true });
}
