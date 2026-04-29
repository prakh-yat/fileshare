import { NextResponse, type NextRequest } from "next/server";

import { upsertAppUser } from "@/lib/auth/user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ResetBody = {
  password?: string;
};

export async function POST(request: NextRequest) {
  let body: ResetBody;
  try {
    body = (await request.json()) as ResetBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const password = body.password ?? "";
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters." },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "This password reset link is no longer valid. Request a new one." },
      { status: 401 },
    );
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await upsertAppUser(user);

  return NextResponse.json({ ok: true });
}
