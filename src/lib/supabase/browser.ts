"use client";

import { createBrowserClient } from "@supabase/ssr";

import { supabaseCookieOptions } from "@/lib/supabase/cookies";

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        detectSessionInUrl: false,
      },
      cookieOptions: supabaseCookieOptions,
    },
  );
}
