"use client";

import type { EmailOtpType } from "@supabase/supabase-js";
import { AlertCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function AuthConfirm() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function confirmSession() {
      const supabase = createSupabaseBrowserClient();
      const url = new URL(window.location.href);
      const params = url.searchParams;
      const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
      const next = safeNextPath(params.get("next") || hashParams.get("next"));
      const authError =
        params.get("error_description") ||
        params.get("error") ||
        hashParams.get("error_description") ||
        hashParams.get("error");

      if (authError) {
        if (mounted) setError(authError);
        return;
      }

      const code = params.get("code");
      const tokenHash = params.get("token_hash") || hashParams.get("token_hash");
      const type = (params.get("type") || hashParams.get("type")) as EmailOtpType | null;
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      const result = code
        ? await supabase.auth.exchangeCodeForSession(code)
        : tokenHash && type
          ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
          : accessToken && refreshToken
            ? await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              })
            : await supabase.auth.getSession();

      if (result.error) {
        if (mounted) setError(result.error.message);
        return;
      }
      if (!result.data.session) {
        if (mounted) {
          setError(
            "This confirmation link is missing a valid auth session. Try creating your account again.",
          );
        }
        return;
      }

      try {
        await fetch("/api/auth/sync", {
          method: "POST",
          credentials: "include",
        });
      } catch {
        // Sync is best-effort; the dashboard load will retry.
      }

      window.history.replaceState(null, "", next);
      window.location.replace(next);
    }

    void confirmSession();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f6f8] px-4 text-slate-950">
      <section className="w-full max-w-md rounded-[12px] border border-slate-200 bg-white p-6 text-center shadow-sm">
        {error ? (
          <>
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-[10px] bg-red-50 text-red-600">
              <AlertCircle className="h-6 w-6" aria-hidden="true" />
            </div>
            <h1 className="mt-4 text-xl font-semibold">Email confirmation failed</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">{error}</p>
            <a
              href="/login"
              className="mt-5 inline-flex h-10 items-center rounded-[10px] bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Back to login
            </a>
          </>
        ) : (
          <>
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-[10px] bg-blue-50 text-blue-600">
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
            </div>
            <h1 className="mt-4 text-xl font-semibold">Confirming your account</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Verifying your email and opening the dashboard.
            </p>
          </>
        )}
      </section>
    </main>
  );
}

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}
