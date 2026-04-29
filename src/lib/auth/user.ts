import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { getPrisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getOptionalAppUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return upsertAppUser(user);
}

export async function getRequiredAppUser() {
  const appUser = await getOptionalAppUser();

  if (!appUser) {
    redirect("/login");
  }

  return appUser;
}

export async function upsertAppUser(user: Pick<User, "id" | "email">) {
  const prisma = getPrisma();
  const email = user.email ?? null;
  const emailNormalized = email?.toLowerCase().trim() || null;

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
