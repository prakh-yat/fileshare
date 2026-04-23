"use client";

import Image from "next/image";
import { useState } from "react";
import { CheckCircle2, Loader2, Mail } from "lucide-react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError ?? null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const origin = window.location.origin;
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${origin}/auth/confirm?next=/dashboard`,
        },
      });

      if (signInError) {
        setError(signInError.message);
      } else {
        setMessage("Magic link sent. Check your inbox to continue.");
      }
    } catch (signInError) {
      setError(
        signInError instanceof Error
          ? signInError.message
          : "Unable to reach Supabase auth.",
      );
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-[#f4f6f8] px-4 py-8 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-sm lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex min-h-[560px] flex-col justify-between bg-[#263244] p-8 text-white md:p-12">
            <div>
              <Image
                src="/tda-main-logo-white-horizontal-400x140.png"
                alt="TDA logo"
                width={172}
                height={60}
                priority
                className="h-auto w-[172px]"
              />
            </div>
            <div />
          </div>

          <div className="flex items-center justify-center p-6 md:p-12">
            <form onSubmit={handleSubmit} className="w-full max-w-sm">
              <div className="mb-8">
                <h2 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
                  Login in to your account
                </h2>
              </div>

              <label className="text-sm font-medium text-slate-700" htmlFor="email">
                Email address
              </label>
              <div className="mt-2 flex h-12 items-center gap-3 rounded-[8px] border border-slate-300 bg-white px-3 focus-within:border-blue-600 focus-within:ring-4 focus-within:ring-blue-100">
                <Mail className="h-4 w-4 text-slate-400" aria-hidden="true" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : null}
                Send magic link
              </button>

              {message ? (
                <div className="mt-4 flex gap-3 rounded-[8px] border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{message}</span>
                </div>
              ) : null}

              {error ? (
                <div className="mt-4 rounded-[8px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
