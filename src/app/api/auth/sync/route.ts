import { NextResponse } from "next/server";

import { upsertAppUser } from "@/lib/auth/user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No active session." }, { status: 401 });
  }

  const appUser = await upsertAppUser(user);

  return NextResponse.json({
    appUser: {
      id: appUser.id,
      email: appUser.email,
      emailNormalized: appUser.emailNormalized,
    },
  });
}
