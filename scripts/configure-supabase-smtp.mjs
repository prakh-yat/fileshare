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

function buildAuthConfigPatch() {
  const smtpPort = readOptionalInt("SUPABASE_SMTP_PORT") ?? 587;
  const emailRateLimit = readOptionalInt("SUPABASE_AUTH_EMAIL_RATE_LIMIT_PER_HOUR");
  const siteUrl = readEnv("SUPABASE_AUTH_SITE_URL", readEnv("NEXT_PUBLIC_APP_URL")).replace(/\/$/, "");

  const patch = {
    external_email_enabled: true,
    mailer_secure_email_change_enabled: true,
    mailer_autoconfirm: false,
    site_url: siteUrl,
    smtp_admin_email: readEnv("SUPABASE_SMTP_ADMIN_EMAIL"),
    smtp_host: readEnv("SUPABASE_SMTP_HOST", "smtp.mailgun.org"),
    smtp_port: String(smtpPort),
    smtp_user: readEnv("SUPABASE_SMTP_USER"),
    smtp_pass: readEnv("SUPABASE_SMTP_PASS"),
    smtp_sender_name: readEnv("SUPABASE_SMTP_SENDER_NAME", "TDA FileShare"),
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
    smtp_admin_email: patch.smtp_admin_email,
    smtp_host: patch.smtp_host,
    smtp_port: patch.smtp_port,
    smtp_user: patch.smtp_user,
    smtp_sender_name: patch.smtp_sender_name,
    site_url: patch.site_url,
    rate_limit_email_sent: patch.rate_limit_email_sent ?? "(Supabase default after custom SMTP)",
  };

  console.log(JSON.stringify(summary, null, 2));
}

async function main() {
  const projectRef = getProjectRef();
  const patch = buildAuthConfigPatch();

  if (isDryRun) {
    console.log("Dry run: Supabase Auth SMTP patch would use:");
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
      `Supabase SMTP configuration failed with ${response.status} ${response.statusText}${
        body ? `: ${redact(body)}` : ""
      }`,
    );
  }

  console.log("Supabase Auth SMTP configured successfully:");
  printSafeSummary(projectRef, patch);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
