"use client";

import Image from "next/image";
import { useState } from "react";
import { CheckCircle2, Eye, EyeOff, Loader2, LockKeyhole, Mail } from "lucide-react";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError ?? null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    const trimmedEmail = email.trim().toLowerCase();

    try {
      if (mode === "sign-up") {
        if (password.length < 6) {
          setError("Password must be at least 6 characters.");
          return;
        }
        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          return;
        }

        const result = await postJson("/api/auth/signup", {
          email: trimmedEmail,
          password,
        });

        if (!result.ok) {
          setError(result.error || "Sign up failed.");
          return;
        }

        const data = result.data as {
          confirmationRequired?: boolean;
          sessionEstablished?: boolean;
        };

        if (data.sessionEstablished) {
          window.location.assign("/dashboard");
          return;
        }

        setMessage(
          "Account created. Check your inbox for a confirmation link to finish setup.",
        );
        setMode("sign-in");
        setPassword("");
        setConfirmPassword("");
      } else {
        const result = await postJson("/api/auth/signin", {
          email: trimmedEmail,
          password,
        });

        if (!result.ok) {
          setError(result.error || "Sign in failed.");
          return;
        }

        window.location.assign("/dashboard");
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to reach the auth service.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f6f8] px-4 py-8 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-[12px] border border-slate-200 bg-white shadow-sm lg:grid-cols-[1.05fr_0.95fr]">
          <div className="hidden min-h-[560px] flex-col justify-between bg-[#263244] p-8 text-white md:p-12 lg:flex">
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
            <div className="space-y-3">
              <p className="text-sm font-medium uppercase tracking-wider text-blue-200/80">
                Secure file sharing
              </p>
              <h1 className="text-3xl font-semibold leading-tight">
                Share files with confidence.
              </h1>
              <p className="max-w-md text-sm leading-6 text-white/70">
                Upload, organize, and share files with your team. Granular owner-only
                permissions keep your content safe.
              </p>
            </div>
            <div />
          </div>

          <div className="flex items-center justify-center p-6 md:p-12">
            <form onSubmit={handleSubmit} className="w-full max-w-sm" noValidate>
              <div className="mb-8 flex items-center justify-center lg:hidden">
                <Image
                  src="/tda-main-logo-white-horizontal-400x140.png"
                  alt="TDA logo"
                  width={140}
                  height={48}
                  priority
                  className="h-auto w-[140px] dark:invert-0"
                />
              </div>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
                {mode === "sign-in" ? "Login to your account" : "Create your account"}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {mode === "sign-in"
                  ? "Welcome back. Sign in to continue."
                  : "Start sharing files in seconds."}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-2 rounded-[10px] bg-slate-100 p-1">
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

              <div className="mt-6 space-y-4">
                <Field label="Email address" htmlFor="email">
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
                </Field>

                <Field label="Password" htmlFor="password">
                  <LockKeyhole className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    required
                    minLength={6}
                    autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                    placeholder="Enter your password"
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

                {mode === "sign-up" ? (
                  <Field label="Confirm password" htmlFor="confirm-password">
                    <LockKeyhole className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    <input
                      id="confirm-password"
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      placeholder="Re-enter your password"
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
                    />
                  </Field>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 active:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    {mode === "sign-in" ? "Signing in" : "Creating account"}
                  </>
                ) : (
                  <>{mode === "sign-in" ? "Sign in" : "Create account"}</>
                )}
              </button>

              {message ? (
                <div className="mt-4 flex gap-3 rounded-[10px] border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{message}</span>
                </div>
              ) : null}

              {error ? (
                <div
                  role="alert"
                  className="mt-4 rounded-[10px] border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
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

async function postJson(
  url: string,
  payload: unknown,
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });
    const contentType = response.headers.get("content-type") ?? "";
    const data = contentType.includes("application/json")
      ? ((await response.json()) as Record<string, unknown>)
      : null;

    if (!response.ok) {
      const message =
        (data && typeof data.error === "string" ? data.error : null) ||
        `Request failed with status ${response.status}`;
      return { ok: false, error: message };
    }

    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Network error.",
    };
  }
}
