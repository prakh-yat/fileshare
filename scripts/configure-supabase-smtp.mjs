#!/usr/bin/env node

import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const isDryRun = process.argv.includes("--dry-run");

function readEnv(name, fallback) {
  const value = process.env[name]?.trim() || fallback;

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readOptionalEnv(name) {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function readOptionalInt(name) {
  const rawValue = process.env[name]?.trim();

  if (!rawValue) return undefined;

  const value = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return value;
}

function getProjectRef() {
  const configuredRef = process.env.SUPABASE_PROJECT_REF?.trim();

  if (configuredRef) return configuredRef;

  const supabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const hostname = new URL(supabaseUrl).hostname;
  const [projectRef] = hostname.split(".");

  if (!projectRef || projectRef === "localhost") {
    throw new Error("Set SUPABASE_PROJECT_REF to your Supabase project reference.");
  }

  return projectRef;
}

function buildRedirectAllowList(siteUrl) {
  const additional = readOptionalEnv("SUPABASE_AUTH_ADDITIONAL_REDIRECT_URLS");
  const candidates = new Set();

  candidates.add(`${siteUrl}/auth/confirm`);
  candidates.add(`${siteUrl}/auth/callback`);
  candidates.add(`${siteUrl}/dashboard`);
  candidates.add(`${siteUrl}/**`);

  if (additional) {
    additional
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach((value) => candidates.add(value.replace(/\/$/, "")));
  }

  return Array.from(candidates).join(",");
}

function buildEmailTemplates(senderName) {
  const targetUrl = (next) =>
    `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .Type }}&next=${encodeURIComponent(
      next,
    )}`;

  const button = (label, next) => `
    <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 24px auto;">
      <tr>
        <td bgcolor="#2563eb" style="border-radius: 10px;">
          <a
            href="${targetUrl(next)}"
            target="_blank"
            style="
              display: inline-block;
              padding: 14px 32px;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
              font-size: 14px;
              font-weight: 600;
              color: #ffffff;
              text-decoration: none;
              border-radius: 10px;
              background-color: #2563eb;
            "
          >${label}</a>
        </td>
      </tr>
    </table>
  `;

  const wrapper = (title, intro, label, footer, next) => `
    <!DOCTYPE html>
    <html>
      <body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#f4f6f8">
          <tr>
            <td align="center" style="padding: 32px 16px;">
              <table cellpadding="0" cellspacing="0" border="0" width="520" style="max-width: 520px; background: #ffffff; border-radius: 16px; box-shadow: 0 1px 4px rgba(15,23,42,0.05); border: 1px solid #e2e8f0; overflow: hidden;">
                <tr>
                  <td style="background: #263244; padding: 28px 32px; color: #ffffff; font-size: 18px; font-weight: 600;">
                    ${senderName}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 32px;">
                    <h1 style="margin: 0 0 12px; font-size: 22px; line-height: 28px; color: #0f172a;">${title}</h1>
                    <p style="margin: 0 0 12px; font-size: 14px; line-height: 22px; color: #475569;">${intro}</p>
                    ${button(label, next)}
                    <p style="margin: 24px 0 0; font-size: 13px; line-height: 20px; color: #64748b;">
                      Or copy and paste this URL into your browser:
                    </p>
                    <p style="margin: 4px 0 0; word-break: break-all; font-size: 12px; line-height: 18px; color: #2563eb;">
                      ${targetUrl(next)}
                    </p>
                    <p style="margin: 24px 0 0; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; line-height: 18px; color: #94a3b8;">
                      ${footer}
                    </p>
                  </td>
                </tr>
              </table>
              <p style="margin: 16px 0 0; font-size: 12px; color: #94a3b8;">
                Sent by ${senderName}
              </p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  return {
    confirmation: wrapper(
      "Confirm your email",
      `Welcome to ${senderName}! Click the button below to confirm your email address and finish setting up your account.`,
      "Confirm your email",
      "If you didn't create this account, you can safely ignore this email — the link expires automatically.",
      "/dashboard",
    ),
    recovery: wrapper(
      "Reset your password",
      "We received a request to reset the password for your account. Click the button below to choose a new password.",
      "Reset your password",
      "If you didn't request a password reset, you can safely ignore this email.",
      "/auth/reset-password",
    ),
    invite: wrapper(
      "You've been invited",
      `You've been invited to join ${senderName}. Click the button below to accept the invite and create your account.`,
      "Accept the invite",
      "If you weren't expecting this invite, you can safely ignore this email.",
      "/dashboard",
    ),
    emailChange: wrapper(
      "Confirm your new email",
      "Click the button below to confirm the change to your account email address.",
      "Confirm new email",
      "If you didn't request this change, contact your administrator immediately.",
      "/dashboard",
    ),
    magicLink: wrapper(
      "Sign in to your account",
      "Click the button below to sign in. This magic link will expire shortly.",
      "Sign in",
      "If you didn't request this email, you can safely ignore it.",
      "/dashboard",
    ),
  };
}

function buildAuthConfigPatch() {
  const smtpPort = readOptionalInt("SUPABASE_SMTP_PORT") ?? 587;
  const emailRateLimit = readOptionalInt("SUPABASE_AUTH_EMAIL_RATE_LIMIT_PER_HOUR");
  const siteUrl = readEnv("SUPABASE_AUTH_SITE_URL", readEnv("NEXT_PUBLIC_APP_URL")).replace(
    /\/$/,
    "",
  );
  const uriAllowList = buildRedirectAllowList(siteUrl);
  const senderName = readEnv("SUPABASE_SMTP_SENDER_NAME", "TDA FileShare");
  const templates = buildEmailTemplates(senderName);

  const patch = {
    external_email_enabled: true,
    mailer_secure_email_change_enabled: true,
    mailer_autoconfirm: false,
    site_url: siteUrl,
    uri_allow_list: uriAllowList,
    smtp_admin_email: readEnv("SUPABASE_SMTP_ADMIN_EMAIL"),
    smtp_host: readEnv("SUPABASE_SMTP_HOST", "smtp.mailgun.org"),
    smtp_port: String(smtpPort),
    smtp_user: readEnv("SUPABASE_SMTP_USER"),
    smtp_pass: readEnv("SUPABASE_SMTP_PASS"),
    smtp_sender_name: senderName,

    mailer_subjects_confirmation: `Confirm your ${senderName} account`,
    mailer_subjects_recovery: `Reset your ${senderName} password`,
    mailer_subjects_invite: `You've been invited to ${senderName}`,
    mailer_subjects_email_change: `Confirm your new ${senderName} email`,
    mailer_subjects_magic_link: `Sign in to ${senderName}`,

    mailer_templates_confirmation_content: templates.confirmation,
    mailer_templates_recovery_content: templates.recovery,
    mailer_templates_invite_content: templates.invite,
    mailer_templates_email_change_content: templates.emailChange,
    mailer_templates_magic_link_content: templates.magicLink,
  };

  if (emailRateLimit !== undefined) {
    patch.rate_limit_email_sent = emailRateLimit;
  }

  return patch;
}

function redact(value) {
  return value.replaceAll(process.env.SUPABASE_SMTP_PASS ?? "", "[redacted]");
}

function printSafeSummary(projectRef, patch) {
  const summary = {
    projectRef,
    site_url: patch.site_url,
    uri_allow_list: patch.uri_allow_list.split(",").map((value) => value.trim()),
    smtp_admin_email: patch.smtp_admin_email,
    smtp_host: patch.smtp_host,
    smtp_port: patch.smtp_port,
    smtp_user: patch.smtp_user,
    smtp_sender_name: patch.smtp_sender_name,
    rate_limit_email_sent: patch.rate_limit_email_sent ?? "(Supabase default after custom SMTP)",
    custom_email_templates: [
      "confirmation",
      "recovery",
      "invite",
      "email_change",
      "magic_link",
    ],
  };

  console.log(JSON.stringify(summary, null, 2));
}

async function main() {
  const projectRef = getProjectRef();
  const patch = buildAuthConfigPatch();

  if (isDryRun) {
    console.log("Dry run: Supabase Auth + SMTP patch would use:");
    printSafeSummary(projectRef, patch);
    return;
  }

  const accessToken = readEnv("SUPABASE_ACCESS_TOKEN");
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patch),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Supabase Auth/SMTP configuration failed with ${response.status} ${response.statusText}${
        body ? `: ${redact(body)}` : ""
      }`,
    );
  }

  console.log("Supabase Auth + SMTP configured successfully:");
  printSafeSummary(projectRef, patch);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
