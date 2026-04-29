import { NextResponse, type NextRequest } from "next/server";

import { getPublicAppUrl } from "@/lib/env";
import { smtpSend } from "@/lib/smtp";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type DiagnoseBody = {
  email?: string;
};

/**
 * Diagnostic endpoint that verifies email delivery end-to-end:
 * 1. Sends a direct SMTP message via Mailgun (bypasses Supabase entirely).
 * 2. Calls Supabase resetPasswordForEmail to verify Supabase->Mailgun pipeline.
 * Returns timing, SMTP response codes, and any errors.
 */
export async function POST(request: NextRequest) {
  let body: DiagnoseBody;
  try {
    body = (await request.json()) as DiagnoseBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Provide a valid email address." }, { status: 400 });
  }

  const smtpHost = process.env.SUPABASE_SMTP_HOST;
  const smtpUser = process.env.SUPABASE_SMTP_USER;
  const smtpPass = process.env.SUPABASE_SMTP_PASS;
  const smtpFromEmail = process.env.SUPABASE_SMTP_ADMIN_EMAIL || smtpUser;
  const smtpFromName = process.env.SUPABASE_SMTP_SENDER_NAME || "TDA FileShare";
  const smtpPort = Number.parseInt(process.env.SUPABASE_SMTP_PORT || "587", 10);

  const result: Record<string, unknown> = {
    target: email,
    env: {
      smtpHostConfigured: Boolean(smtpHost),
      smtpUserConfigured: Boolean(smtpUser),
      smtpPassConfigured: Boolean(smtpPass),
      fromEmail: smtpFromEmail,
      fromName: smtpFromName,
      port: smtpPort,
    },
  };

  // Test 1: Direct SMTP send (bypasses Supabase)
  if (smtpHost && smtpUser && smtpPass && smtpFromEmail) {
    const direct = await smtpSend({
      config: {
        host: smtpHost,
        port: smtpPort,
        user: smtpUser,
        pass: smtpPass,
        fromEmail: smtpFromEmail,
        fromName: smtpFromName,
      },
      to: email,
      subject: `${smtpFromName} - SMTP delivery diagnostic`,
      text: `This is a diagnostic email sent at ${new Date().toISOString()} directly via Mailgun SMTP.\n\nIf you got this, SMTP delivery is working end-to-end.\n\nIf the Supabase signup confirmation never arrives but this one does, the issue is with Supabase's SMTP integration or the email template — not the SMTP credentials.`,
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: -apple-system, sans-serif; padding: 32px; background: #f4f6f8;">
            <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 24px;">
              <h2 style="margin-top: 0;">${smtpFromName} - SMTP diagnostic</h2>
              <p>This message was sent <strong>directly through Mailgun SMTP</strong>, bypassing Supabase.</p>
              <p>If you got this, SMTP delivery is working end-to-end. If the Supabase signup confirmation never arrives but this one does, the issue is with Supabase's SMTP integration or the email template &mdash; not the SMTP credentials.</p>
              <p style="color: #64748b; font-size: 12px;">Sent at ${new Date().toISOString()}</p>
            </div>
          </body>
        </html>
      `,
    });
    result.directSmtp = {
      success: direct.success,
      durationMs: direct.durationMs,
      steps: direct.steps,
      error: direct.error,
    };
  } else {
    result.directSmtp = { skipped: true, reason: "Missing SUPABASE_SMTP_* env vars" };
  }

  // Test 2: Supabase password recovery (uses Supabase's SMTP integration)
  try {
    const supabase = await createSupabaseServerClient();
    const origin = request.headers.get("origin");
    const appUrl = getPublicAppUrl(origin);
    const start = Date.now();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/auth/confirm?next=/auth/reset-password`,
    });
    result.supabaseRecovery = {
      success: !error,
      durationMs: Date.now() - start,
      error: error?.message,
    };
  } catch (error) {
    result.supabaseRecovery = {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  return NextResponse.json(result);
}
