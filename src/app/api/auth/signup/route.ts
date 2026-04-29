import { NextResponse, type NextRequest } from "next/server";

import { sendAuthEmail } from "@/lib/auth/email";
import { upsertAppUser } from "@/lib/auth/user";
import { getPublicAppUrl } from "@/lib/env";
import { getSupabaseAdminClient, hasSupabaseAdminCredentials } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type SignupBody = {
  email?: string;
  password?: string;
};

export async function POST(request: NextRequest) {
  let body: SignupBody;
  try {
    body = (await request.json()) as SignupBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters." },
      { status: 400 },
    );
  }

  const origin = request.headers.get("origin");
  const appUrl = getPublicAppUrl(origin);

  // Preferred path: use admin API to create the user without triggering
  // Supabase's built-in email, then send the confirmation through our own
  // SMTP. This guarantees delivery regardless of Supabase's mailer state.
  if (hasSupabaseAdminCredentials()) {
    return signupWithAdminFlow({ email, password, appUrl });
  }

  // Fallback: standard signUp (relies on Supabase's mailer).
  return signupWithStandardFlow({ email, password, appUrl, request });
}

async function signupWithAdminFlow({
  email,
  password,
  appUrl,
}: {
  email: string;
  password: string;
  appUrl: string;
}) {
  const admin = getSupabaseAdminClient();

  // Check if a user with this email already exists.
  const existing = await findUserByEmail(email);
  if (existing) {
    if (existing.email_confirmed_at) {
      return NextResponse.json(
        {
          error:
            "An account with this email already exists. Sign in or reset your password instead.",
          accountExists: true,
        },
        { status: 409 },
      );
    }
    // Existing unconfirmed user — update password and re-send confirmation.
    const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
      password,
    });
    if (updateError) {
      console.error("[signup] Failed to update password for existing user:", updateError.message);
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    const linkResult = await generateAndSendEmail({
      kind: "confirmation",
      email,
      password,
      appUrl,
      next: "/dashboard",
    });
    if (!linkResult.ok) return linkResult.response;

    await upsertAppUser({ id: existing.id, email });

    return NextResponse.json({
      confirmationRequired: true,
      sessionEstablished: false,
      email,
      delivery: linkResult.delivery,
    });
  }

  // New user — create via admin (no auto-email), then send our own.
  const { data, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
  });

  if (createError) {
    console.error("[signup] admin.createUser failed:", createError.message);
    return NextResponse.json({ error: createError.message }, { status: 400 });
  }
  if (!data.user) {
    return NextResponse.json({ error: "Sign up failed unexpectedly." }, { status: 500 });
  }

  await upsertAppUser({ id: data.user.id, email: data.user.email ?? email });

  const linkResult = await generateAndSendEmail({
    kind: "confirmation",
    email,
    password,
    appUrl,
    next: "/dashboard",
  });
  if (!linkResult.ok) return linkResult.response;

  return NextResponse.json({
    confirmationRequired: true,
    sessionEstablished: false,
    email,
    delivery: linkResult.delivery,
  });
}

async function generateAndSendEmail({
  kind,
  email,
  password,
  appUrl,
  next,
}: {
  kind: "confirmation" | "recovery";
  email: string;
  password?: string;
  appUrl: string;
  next: string;
}) {
  const admin = getSupabaseAdminClient();

  const generateOptions: {
    type: "signup" | "recovery";
    email: string;
    password?: string;
    options: { redirectTo: string };
  } = {
    type: kind === "recovery" ? "recovery" : "signup",
    email,
    options: { redirectTo: `${appUrl}/auth/confirm?next=${encodeURIComponent(next)}` },
  };
  if (kind === "confirmation" && password) {
    generateOptions.password = password;
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    generateOptions as any,
  );

  if (linkError) {
    console.error("[signup] admin.generateLink failed:", linkError.message);
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: `Could not generate verification link: ${linkError.message}` },
        { status: 500 },
      ),
    };
  }

  const tokenHash =
    (linkData as { properties?: { hashed_token?: string }; hashed_token?: string }).properties
      ?.hashed_token ??
    (linkData as { hashed_token?: string }).hashed_token;

  if (!tokenHash) {
    console.error("[signup] generateLink response had no hashed_token", linkData);
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Verification link was generated without a token." },
        { status: 500 },
      ),
    };
  }

  const sendResult = await sendAuthEmail({
    kind,
    to: email,
    appUrl,
    tokenHash,
    next,
  });

  if (!sendResult.delivered) {
    console.error("[signup] SMTP send failed:", sendResult.error, sendResult.smtp);
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: `Could not deliver the confirmation email: ${sendResult.error || "SMTP error."}`,
          smtp: sendResult.smtp?.steps,
        },
        { status: 502 },
      ),
    };
  }

  console.log(
    `[signup] ${kind} email delivered to ${email} via SMTP in ${sendResult.smtp?.durationMs}ms`,
  );

  return {
    ok: true as const,
    delivery: {
      via: "smtp" as const,
      durationMs: sendResult.smtp?.durationMs,
    },
  };
}

async function findUserByEmail(email: string) {
  const admin = getSupabaseAdminClient();
  let page = 1;
  const perPage = 100;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error("[signup] listUsers failed:", error.message);
      return null;
    }
    const match = data.users.find(
      (user) => user.email && user.email.toLowerCase() === email,
    );
    if (match) return match;
    if (data.users.length < perPage) return null;
    page += 1;
    if (page > 50) return null; // safety bound
  }
}

async function signupWithStandardFlow({
  email,
  password,
  appUrl,
}: {
  email: string;
  password: string;
  appUrl: string;
  request: NextRequest;
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${appUrl}/auth/confirm?next=/dashboard`,
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data.user) {
    return NextResponse.json({ error: "Sign up failed unexpectedly." }, { status: 500 });
  }

  const identities = (data.user.identities ?? []) as unknown[];
  if (identities.length === 0 && data.user.email_confirmed_at) {
    return NextResponse.json(
      {
        error:
          "An account with this email already exists. Sign in or reset your password instead.",
        accountExists: true,
      },
      { status: 409 },
    );
  }

  await upsertAppUser({ id: data.user.id, email: data.user.email ?? email });

  return NextResponse.json({
    confirmationRequired: !data.session,
    sessionEstablished: Boolean(data.session),
    email,
  });
}
