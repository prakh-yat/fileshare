import { getSmtpConfig, hasSmtpCredentials, smtpSend, type SmtpResult } from "@/lib/smtp";

export type AuthEmailKind = "confirmation" | "recovery";

export type SendAuthEmailInput = {
  kind: AuthEmailKind;
  to: string;
  appUrl: string;
  tokenHash: string;
  next: string;
};

export type SendAuthEmailResult = {
  delivered: boolean;
  smtp?: SmtpResult;
  error?: string;
};

export { hasSmtpCredentials };

export async function sendAuthEmail(input: SendAuthEmailInput): Promise<SendAuthEmailResult> {
  const config = getSmtpConfig();
  if (!config) {
    return {
      delivered: false,
      error:
        "SMTP credentials are not configured. Set SUPABASE_SMTP_HOST/USER/PASS in the environment.",
    };
  }

  const { subject, intro, buttonLabel, footer } = templateContent(input.kind);
  const verifyUrl = buildVerifyUrl(input);
  const html = renderHtml({
    senderName: config.fromName ?? "TDA FileShare",
    intro,
    buttonLabel,
    footer,
    verifyUrl,
    title: subject,
  });
  const text = renderText({ intro, footer, verifyUrl });

  const result = await smtpSend({
    config,
    to: input.to,
    subject,
    text,
    html,
  });

  return {
    delivered: result.success,
    smtp: result,
    error: result.success ? undefined : result.error,
  };
}

function buildVerifyUrl({ appUrl, tokenHash, next, kind }: SendAuthEmailInput) {
  const type = kind === "recovery" ? "recovery" : "signup";
  const params = new URLSearchParams({
    token_hash: tokenHash,
    type,
    next,
  });
  return `${appUrl.replace(/\/$/, "")}/auth/confirm?${params.toString()}`;
}

function templateContent(kind: AuthEmailKind) {
  if (kind === "recovery") {
    return {
      subject: "Reset your TDA FileShare password",
      intro:
        "We received a request to reset the password for your TDA FileShare account. Click the button below to choose a new password. The link expires in one hour.",
      buttonLabel: "Reset your password",
      footer: "If you didn't request a password reset, you can safely ignore this email.",
    };
  }
  return {
    subject: "Confirm your TDA FileShare account",
    intro:
      "Welcome to TDA FileShare! Click the button below to confirm your email address and finish setting up your account. The link expires in one hour.",
    buttonLabel: "Confirm your email",
    footer: "If you didn't create this account, you can safely ignore this email.",
  };
}

function renderHtml({
  senderName,
  intro,
  buttonLabel,
  footer,
  verifyUrl,
  title,
}: {
  senderName: string;
  intro: string;
  buttonLabel: string;
  footer: string;
  verifyUrl: string;
  title: string;
}) {
  return `<!DOCTYPE html>
<html>
  <body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#f4f6f8">
      <tr>
        <td align="center" style="padding: 32px 16px;">
          <table cellpadding="0" cellspacing="0" border="0" width="520" style="max-width: 520px; background: #ffffff; border-radius: 16px; box-shadow: 0 1px 4px rgba(15,23,42,0.05); border: 1px solid #e2e8f0; overflow: hidden;">
            <tr>
              <td style="background: #263244; padding: 28px 32px; color: #ffffff; font-size: 18px; font-weight: 600;">
                ${escapeHtml(senderName)}
              </td>
            </tr>
            <tr>
              <td style="padding: 32px;">
                <h1 style="margin: 0 0 12px; font-size: 22px; line-height: 28px; color: #0f172a;">${escapeHtml(title)}</h1>
                <p style="margin: 0 0 12px; font-size: 14px; line-height: 22px; color: #475569;">${escapeHtml(intro)}</p>
                <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 24px auto;">
                  <tr>
                    <td bgcolor="#2563eb" style="border-radius: 10px;">
                      <a href="${escapeAttribute(verifyUrl)}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 10px; background-color: #2563eb;">${escapeHtml(buttonLabel)}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin: 24px 0 0; font-size: 13px; line-height: 20px; color: #64748b;">
                  Or copy and paste this URL into your browser:
                </p>
                <p style="margin: 4px 0 0; word-break: break-all; font-size: 12px; line-height: 18px; color: #2563eb;">
                  <a href="${escapeAttribute(verifyUrl)}" style="color: #2563eb; text-decoration: none;">${escapeHtml(verifyUrl)}</a>
                </p>
                <p style="margin: 24px 0 0; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; line-height: 18px; color: #94a3b8;">
                  ${escapeHtml(footer)}
                </p>
              </td>
            </tr>
          </table>
          <p style="margin: 16px 0 0; font-size: 12px; color: #94a3b8;">
            Sent by ${escapeHtml(senderName)}
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderText({
  intro,
  footer,
  verifyUrl,
}: {
  intro: string;
  footer: string;
  verifyUrl: string;
}) {
  return `${intro}

${verifyUrl}

${footer}
`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}
