"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  MailCheck,
  RotateCcw,
} from "lucide-react";

type Stage =
  | { kind: "form"; mode: "sign-in" | "sign-up" }
  | { kind: "verify"; email: string; reason?: "signup" | "unconfirmed" }
  | { kind: "forgot" }
  | { kind: "forgot-sent"; email: string };

export function LoginForm({ initialError }: { initialError?: string }) {
  const [stage, setStage] = useState<Stage>({ kind: "form", mode: "sign-in" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError ?? null);

  const mode = stage.kind === "form" ? stage.mode : "sign-in";

  function setMode(next: "sign-in" | "sign-up") {
    setStage({ kind: "form", mode: next });
    setMessage(null);
    setError(initialError ?? null);
    if (next === "sign-up") {
      setPassword("");
      setConfirmPassword("");
    } else {
      setConfirmPassword("");
    }
  }

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

        setStage({ kind: "verify", email: trimmedEmail, reason: "signup" });
        setPassword("");
        setConfirmPassword("");
      } else {
        const result = await postJson("/api/auth/signin", {
          email: trimmedEmail,
          password,
        });

        if (!result.ok) {
          if (
            result.error.toLowerCase().includes("not confirmed") ||
            result.error.toLowerCase().includes("email not confirmed")
          ) {
            setStage({ kind: "verify", email: trimmedEmail, reason: "unconfirmed" });
            return;
          }
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
            {stage.kind === "verify" ? (
              <VerifyPanel
                email={stage.email}
                reason={stage.reason ?? "signup"}
                onBack={() => setMode("sign-in")}
                onSwitchToReset={(emailValue) => {
                  setEmail(emailValue);
                  setStage({ kind: "forgot" });
                }}
              />
            ) : stage.kind === "forgot" ? (
              <ForgotPanel
                initialEmail={email}
                onSent={(emailValue) => setStage({ kind: "forgot-sent", email: emailValue })}
                onBack={() => setMode("sign-in")}
              />
            ) : stage.kind === "forgot-sent" ? (
              <ForgotSentPanel
                email={stage.email}
                onBack={() => setMode("sign-in")}
              />
            ) : (
              <form onSubmit={handleSubmit} className="w-full max-w-sm" noValidate>
                <div className="mb-8 flex items-center justify-center lg:hidden">
                  <Image
                    src="/tda-main-logo-white-horizontal-400x140.png"
                    alt="TDA logo"
                    width={140}
                    height={48}
                    priority
                    className="h-auto w-[140px]"
                  />
                </div>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
                  {mode === "sign-in" ? "Login to your account" : "Create your account"}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  {mode === "sign-in"
                    ? "Welcome back. Sign in to continue."
                    : "Start sharing files in seconds. We'll email you a confirmation link."}
                </p>

                <div className="mt-5 grid grid-cols-2 gap-2 rounded-[10px] bg-slate-100 p-1">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => setMode("sign-in")}
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
                    onClick={() => setMode("sign-up")}
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

                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-700" htmlFor="password">
                        Password
                      </label>
                      {mode === "sign-in" ? (
                        <button
                          type="button"
                          onClick={() => setStage({ kind: "forgot" })}
                          className="text-xs font-semibold text-blue-600 transition hover:text-blue-700"
                        >
                          Forgot password?
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-1.5 flex h-12 items-center gap-3 rounded-[10px] border border-slate-300 bg-white px-3 transition focus-within:border-blue-600 focus-within:ring-4 focus-within:ring-blue-100">
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
                    </div>
                  </div>

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
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function VerifyPanel({
  email,
  reason,
  onBack,
  onSwitchToReset,
}: {
  email: string;
  reason: "signup" | "unconfirmed";
  onBack: () => void;
  onSwitchToReset: (email: string) => void;
}) {
  const [resendStatus, setResendStatus] = useState<
    "idle" | "loading" | "sent" | "error" | "already-confirmed"
  >("idle");
  const [resendError, setResendError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const cooldownTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownTimer.current) window.clearInterval(cooldownTimer.current);
    };
  }, []);

  function startCooldown(seconds: number) {
    setCooldown(seconds);
    if (cooldownTimer.current) window.clearInterval(cooldownTimer.current);
    cooldownTimer.current = window.setInterval(() => {
      setCooldown((current) => {
        if (current <= 1) {
          if (cooldownTimer.current) window.clearInterval(cooldownTimer.current);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  }

  async function resend() {
    if (cooldown > 0 || resendStatus === "loading") return;
    setResendStatus("loading");
    setResendError(null);

    const result = await postJson("/api/auth/resend", { email });
    if (!result.ok) {
      setResendStatus("error");
      setResendError(result.error || "Could not resend the email.");
      if (result.status === 429) startCooldown(60);
      return;
    }

    const data = (result.data ?? {}) as { alreadyConfirmed?: boolean };
    if (data.alreadyConfirmed) {
      setResendStatus("already-confirmed");
      return;
    }

    setResendStatus("sent");
    startCooldown(45);
  }

  const inboxDomain = email.split("@")[1] ?? "";
  const heading = reason === "unconfirmed" ? "One more step" : "Check your email";
  const description =
    reason === "unconfirmed"
      ? "Your email address hasn't been confirmed yet. Open the link we sent you to finish signing in."
      : "Click the link to verify your email and finish setting up your account.";

  return (
    <div className="w-full max-w-sm text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-blue-50 text-blue-600">
        <MailCheck className="h-7 w-7" aria-hidden="true" />
      </div>
      <h2 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">{heading}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        We sent a confirmation link to{" "}
        <span className="font-semibold text-slate-900">{email}</span>. {description}
      </p>

      <div className="mt-6 rounded-[10px] border border-slate-200 bg-slate-50 p-4 text-left text-sm text-slate-700">
        <p className="font-semibold text-slate-900">Next steps</p>
        <ol className="mt-2 space-y-1.5 text-slate-600">
          <li>
            1. Open your inbox and look for an email from{" "}
            <span className="font-medium text-slate-900">TDA FileShare</span>.
          </li>
          <li>
            2. Tap the{" "}
            <span className="font-medium text-slate-900">&ldquo;Confirm your email&rdquo;</span>{" "}
            button.
          </li>
          <li>3. You&apos;ll be redirected back here, signed in.</li>
        </ol>
        <p className="mt-3 text-xs text-slate-500">
          The email might take up to a minute. Check your spam or promotions folder if you don&apos;t see it.
        </p>
      </div>

      {inboxDomain ? (
        <a
          href={`https://${inboxDomain}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          <Mail className="h-4 w-4" aria-hidden="true" />
          Open {inboxDomain}
        </a>
      ) : null}

      <button
        type="button"
        onClick={() => void resend()}
        disabled={cooldown > 0 || resendStatus === "loading"}
        className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {resendStatus === "loading" ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
        )}
        {cooldown > 0
          ? `Resend in ${cooldown}s`
          : resendStatus === "loading"
            ? "Resending"
            : resendStatus === "sent"
              ? "Email resent — check your inbox"
              : "Resend confirmation email"}
      </button>

      {resendStatus === "already-confirmed" ? (
        <div
          role="alert"
          className="mt-3 rounded-[10px] border border-amber-200 bg-amber-50 p-3 text-left text-sm text-amber-800"
        >
          This email is already confirmed. Try signing in or{" "}
          <button
            type="button"
            onClick={() => onSwitchToReset(email)}
            className="font-semibold underline underline-offset-2 hover:text-amber-900"
          >
            reset your password
          </button>
          .
        </div>
      ) : resendError ? (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {resendError}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onBack}
        className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-slate-600 transition hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to sign in
      </button>
    </div>
  );
}

function ForgotPanel({
  initialEmail,
  onSent,
  onBack,
}: {
  initialEmail: string;
  onSent: (email: string) => void;
  onBack: () => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }

    setLoading(true);
    const result = await postJson("/api/auth/forgot-password", { email: trimmed });
    setLoading(false);

    if (!result.ok) {
      setError(result.error || "Could not send the reset email.");
      return;
    }

    onSent(trimmed);
  }

  return (
    <div className="w-full max-w-sm">
      <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Reset your password</h2>
      <p className="mt-2 text-sm text-slate-500">
        Enter your email address and we&apos;ll send you a link to choose a new password.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        <Field label="Email address" htmlFor="forgot-email">
          <Mail className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <input
            id="forgot-email"
            type="email"
            required
            value={email}
            autoComplete="email"
            placeholder="you@example.com"
            onChange={(event) => setEmail(event.target.value)}
            className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
          />
        </Field>

        <button
          type="submit"
          disabled={loading}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {loading ? "Sending" : "Send reset link"}
        </button>

        {error ? (
          <div
            role="alert"
            className="rounded-[10px] border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </div>
        ) : null}
      </form>

      <button
        type="button"
        onClick={onBack}
        className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-slate-600 transition hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to sign in
      </button>
    </div>
  );
}

function ForgotSentPanel({ email, onBack }: { email: string; onBack: () => void }) {
  const inboxDomain = email.split("@")[1] ?? "";

  return (
    <div className="w-full max-w-sm text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-blue-50 text-blue-600">
        <MailCheck className="h-7 w-7" aria-hidden="true" />
      </div>
      <h2 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">
        Check your email
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        If an account exists for <span className="font-semibold text-slate-900">{email}</span>,
        you&apos;ll receive a password reset link in your inbox shortly.
      </p>

      <div className="mt-6 rounded-[10px] border border-slate-200 bg-slate-50 p-4 text-left text-sm text-slate-700">
        <p className="font-semibold text-slate-900">Didn&apos;t receive it?</p>
        <ul className="mt-2 space-y-1.5 text-slate-600">
          <li>• Check your spam or promotions folder.</li>
          <li>• Wait up to a minute — Mailgun delivery can be brief.</li>
          <li>• Make sure the email address is correct.</li>
        </ul>
      </div>

      {inboxDomain ? (
        <a
          href={`https://${inboxDomain}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          <Mail className="h-4 w-4" aria-hidden="true" />
          Open {inboxDomain}
        </a>
      ) : null}

      <button
        type="button"
        onClick={onBack}
        className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-slate-600 transition hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to sign in
      </button>
    </div>
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
): Promise<
  | { ok: true; data: unknown; status: number }
  | { ok: false; error: string; status: number }
> {
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
      return { ok: false, error: message, status: response.status };
    }

    return { ok: true, data, status: response.status };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Network error.",
      status: 0,
    };
  }
}
