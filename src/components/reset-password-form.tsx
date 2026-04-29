"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
} from "lucide-react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function ResetPasswordForm() {
  const [sessionStatus, setSessionStatus] = useState<"checking" | "ready" | "invalid">(
    "checking",
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function check() {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;
      setSessionStatus(session ? "ready" : "invalid");
    }

    void check();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        credentials: "include",
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error || "Could not update your password.");
        return;
      }

      setSuccess(true);
      window.setTimeout(() => {
        window.location.assign("/dashboard");
      }, 1500);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f6f8] px-4 py-8 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center justify-center">
        <section className="w-full overflow-hidden rounded-[12px] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-6 flex items-center justify-center">
            <Image
              src="/tda-main-logo-white-horizontal-400x140.png"
              alt="TDA logo"
              width={140}
              height={48}
              priority
              className="h-auto w-[140px]"
            />
          </div>

          {sessionStatus === "checking" ? (
            <div className="grid place-items-center py-10 text-sm text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
              <span className="mt-3">Checking your reset link…</span>
            </div>
          ) : sessionStatus === "invalid" ? (
            <div className="text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-600">
                <AlertCircle className="h-6 w-6" aria-hidden="true" />
              </div>
              <h1 className="mt-4 text-xl font-semibold text-slate-950">Reset link expired</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                This password reset link is no longer valid. Request a new one from the
                login page.
              </p>
              <a
                href="/login"
                className="mt-5 inline-flex h-10 items-center rounded-[10px] bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Back to login
              </a>
            </div>
          ) : success ? (
            <div className="text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
              </div>
              <h1 className="mt-4 text-xl font-semibold text-slate-950">Password updated</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Redirecting you to the dashboard…
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                Set a new password
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Choose a new password to finish recovering your account.
              </p>

              <div className="mt-6 space-y-4">
                <Field label="New password" htmlFor="password">
                  <LockKeyhole className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    placeholder="Enter a new password"
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-[6px] text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </Field>

                <Field label="Confirm new password" htmlFor="confirm-password">
                  <LockKeyhole className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  <input
                    id="confirm-password"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    placeholder="Re-enter your new password"
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
                  />
                </Field>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Updating
                  </>
                ) : (
                  "Update password"
                )}
              </button>

              {error ? (
                <div
                  role="alert"
                  className="mt-4 rounded-[10px] border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </div>
              ) : null}
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-700" htmlFor={htmlFor}>
        {label}
      </label>
      <div className="mt-1.5 flex h-12 items-center gap-3 rounded-[10px] border border-slate-300 bg-white px-3 transition focus-within:border-blue-600 focus-within:ring-4 focus-within:ring-blue-100">
        {children}
      </div>
    </div>
  );
}
