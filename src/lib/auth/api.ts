import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getPrisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ApiAuthResult =
  | {
      appUser: Awaited<ReturnType<typeof upsertAppUser>>;
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

async function upsertAppUser(user: User) {
  const prisma = getPrisma();
  const email = user.email ?? null;
  const emailNormalized = email?.toLowerCase() ?? null;

  const appUser = await prisma.appUser.upsert({
    where: { supabaseUserId: user.id },
    update: {
      email,
      emailNormalized,
    },
    create: {
      supabaseUserId: user.id,
      email,
      emailNormalized,
    },
  });

  if (emailNormalized) {
    await prisma.mediaShare.updateMany({
      where: {
        sharedWithEmail: emailNormalized,
        sharedWithId: null,
      },
      data: {
        sharedWithId: appUser.id,
      },
    });
  }

  return appUser;
}
