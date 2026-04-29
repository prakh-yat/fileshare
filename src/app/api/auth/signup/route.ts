import { NextResponse, type NextRequest } from "next/server";

import { upsertAppUser } from "@/lib/auth/user";
import { getPublicAppUrl } from "@/lib/env";
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

  const supabase = await createSupabaseServerClient();
  const origin = request.headers.get("origin");
  const appUrl = getPublicAppUrl(origin);

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

  // Supabase returns an empty `identities` array when an account with this email
  // already exists *and* is confirmed. Detect that so we can give the user a
  // useful message instead of letting them wait for an email that never arrives.
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
