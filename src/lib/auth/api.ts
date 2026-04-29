import type { AppUser } from "@prisma/client";
import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { upsertAppUser } from "@/lib/auth/user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ApiAuthResult =
  | {
      appUser: AppUser;
      supabaseUser: User;
      response?: never;
    }
  | {
      appUser?: never;
      supabaseUser?: never;
      response: NextResponse;
    };

export async function requireApiUser(): Promise<ApiAuthResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      response: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
    };
  }

  return {
    appUser: await upsertAppUser(user),
    supabaseUser: user,
  };
}
