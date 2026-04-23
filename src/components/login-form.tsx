"use client";

import Image from "next/image";
import { useState } from "react";
import { CheckCircle2, Loader2, LockKeyhole, Mail } from "lucide-react";

import { getPublicAppUrl } from "@/lib/env";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
      const emailNormalized = email.trim();

      if (mode === "sign-up") {
        if (password.length < 6) {
          setError("Password must be at least 6 characters.");
          return;
        }

        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          return;
        }

        const appUrl = getPublicAppUrl(window.location.origin);
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: emailNormalized,
          password,
          options: {
            emailRedirectTo: `${appUrl}/auth/confirm?next=/dashboard`,
          },
        });

        if (signUpError) {
          setError(signUpError.message);
        } else if (data.session) {
          window.location.assign("/dashboard");
        } else {
          setMessage(
            "Account created. If email confirmation is enabled in Supabase, check your inbox to finish setup.",
          );
          setMode("sign-in");
          setPassword("");
          setConfirmPassword("");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: emailNormalized,
          password,
        });

        if (signInError) {
          setError(signInError.message);
        } else {
          window.location.assign("/dashboard");
        }
      }
    } catch (signInError) {
      setError(
        signInError instanceof Error
          ? signInError.message
          : "Unable to reach Supabase auth.",
      );
    } finally {
      setLoading(false);
    }
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
                  {mode === "sign-in" ? "Login to your account" : "Create your account"}
                </h2>
                <div className="mt-5 grid grid-cols-2 gap-2 rounded-[8px] bg-slate-100 p-1">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      setMode("sign-in");
                      setConfirmPassword("");
                      setMessage(null);
                      setError(initialError ?? null);
                    }}
                    className={`h-10 rounded-[8px] text-sm font-semibold transition ${
                      mode === "sign-in"
                        ? "bg-white text-slate-950 shadow-sm"
                        : "text-slate-600 hover:text-slate-950"
                    }`}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      setMode("sign-up");
                      setPassword("");
                      setConfirmPassword("");
                      setMessage(null);
                      setError(null);
                    }}
                    className={`h-10 rounded-[8px] text-sm font-semibold transition ${
                      mode === "sign-up"
                        ? "bg-white text-slate-950 shadow-sm"
                        : "text-slate-600 hover:text-slate-950"
                    }`}
                  >
                    Create account
                  </button>
                </div>
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

              <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="password">
                Password
              </label>
              <div className="mt-2 flex h-12 items-center gap-3 rounded-[8px] border border-slate-300 bg-white px-3 focus-within:border-blue-600 focus-within:ring-4 focus-within:ring-blue-100">
                <LockKeyhole className="h-4 w-4 text-slate-400" aria-hidden="true" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  required
                  minLength={6}
                  autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                  placeholder="Enter your password"
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
                />
              </div>

              {mode === "sign-up" ? (
                <>
                  <label
                    className="mt-4 block text-sm font-medium text-slate-700"
                    htmlFor="confirm-password"
                  >
                    Confirm password
                  </label>
                  <div className="mt-2 flex h-12 items-center gap-3 rounded-[8px] border border-slate-300 bg-white px-3 focus-within:border-blue-600 focus-within:ring-4 focus-within:ring-blue-100">
                    <LockKeyhole className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    <input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      placeholder="Re-enter your password"
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
                    />
                  </div>
                </>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : null}
                {mode === "sign-in" ? "Sign in" : "Create account"}
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
