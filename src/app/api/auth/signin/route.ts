import { NextResponse, type NextRequest } from "next/server";

import { upsertAppUser } from "@/lib/auth/user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type SignInBody = {
  email?: string;
  password?: string;
};

export async function POST(request: NextRequest) {
  let body: SignInBody;
  try {
    body = (await request.json()) as SignInBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!password) {
    return NextResponse.json({ error: "Password is required." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (!data.user || !data.session) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  await upsertAppUser({ id: data.user.id, email: data.user.email ?? email });

  return NextResponse.json({ ok: true });
}
