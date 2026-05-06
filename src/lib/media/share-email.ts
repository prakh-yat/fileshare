import type { AppUser } from "@prisma/client";

import { getSmtpConfig, smtpSend, type SmtpResult } from "@/lib/smtp";
import type { SharedMediaSummary } from "@/lib/media/store";

export type FileShareEmailResult = {
  delivered: boolean;
  smtp?: SmtpResult;
  error?: string;
};

export async function sendFileShareEmailNotification({
  to,
  owner,
  items,
  appUrl,
}: {
  to: string;
  owner: AppUser;
  items: SharedMediaSummary[];
  appUrl: string;
}): Promise<FileShareEmailResult> {
  const config = getSmtpConfig();
  if (!config) {
    return {
      delivered: false,
      error:
        "SMTP credentials are not configured. Set SUPABASE_SMTP_HOST/USER/PASS in the environment.",
    };
  }

  const ownerName = owner.email ?? owner.emailNormalized ?? "A TDA FileShare user";
  const itemCount = items.length;
  const subject = `${ownerName} shared ${itemCount} item${itemCount === 1 ? "" : "s"} with you`;
  const dashboardUrl = `${appUrl.replace(/\/$/, "")}/dashboard`;
  const text = renderShareText({ ownerName, items, dashboardUrl });
  const html = renderShareHtml({
    senderName: config.fromName ?? "TDA FileShare",
    ownerName,
    items,
    dashboardUrl,
  });

  const result = await smtpSend({
    config,
    to,
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

function renderShareText({
  ownerName,
  items,
  dashboardUrl,
}: {
  ownerName: string;
  items: SharedMediaSummary[];
  dashboardUrl: string;
}) {
  const list = items
    .map((item) => `- ${item.name}${item.url ? `: ${item.url}` : ""}`)
    .join("\n");

  return `${ownerName} shared the following item${items.length === 1 ? "" : "s"} with you on TDA FileShare:

${list}

Open your dashboard to view shared files:
${dashboardUrl}
`;
}

function renderShareHtml({
  senderName,
  ownerName,
  items,
  dashboardUrl,
}: {
  senderName: string;
  ownerName: string;
  items: SharedMediaSummary[];
  dashboardUrl: string;
}) {
  const itemRows = items
    .map((item) => {
      const name = escapeHtml(item.name);
      const type = item.type === "folder" ? "Folder" : "File";
      const url = item.url
        ? `<a href="${escapeAttribute(item.url)}" target="_blank" style="color: #2563eb; text-decoration: none;">Open</a>`
        : "";
      return `<tr>
        <td style="padding: 10px 0; border-top: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 600;">${name}</td>
        <td style="padding: 10px 0; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 13px;">${type}</td>
        <td style="padding: 10px 0; border-top: 1px solid #e2e8f0; font-size: 13px; text-align: right;">${url}</td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
  <body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#f4f6f8">
      <tr>
        <td align="center" style="padding: 32px 16px;">
          <table cellpadding="0" cellspacing="0" border="0" width="560" style="max-width: 560px; background: #ffffff; border-radius: 16px; box-shadow: 0 1px 4px rgba(15,23,42,0.05); border: 1px solid #e2e8f0; overflow: hidden;">
            <tr>
              <td style="background: #263244; padding: 28px 32px; color: #ffffff; font-size: 18px; font-weight: 600;">
                ${escapeHtml(senderName)}
              </td>
            </tr>
            <tr>
              <td style="padding: 32px;">
                <h1 style="margin: 0 0 12px; font-size: 22px; line-height: 28px; color: #0f172a;">A file was shared with you</h1>
                <p style="margin: 0 0 20px; font-size: 14px; line-height: 22px; color: #475569;">
                  ${escapeHtml(ownerName)} shared the following item${items.length === 1 ? "" : "s"} with you on TDA FileShare.
                </p>
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse;">
                  ${itemRows}
                </table>
                <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 28px auto;">
                  <tr>
                    <td bgcolor="#2563eb" style="border-radius: 10px;">
                      <a href="${escapeAttribute(dashboardUrl)}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 10px; background-color: #2563eb;">Open dashboard</a>
                    </td>
                  </tr>
                </table>
                <p style="margin: 24px 0 0; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; line-height: 18px; color: #94a3b8;">
                  Sign in with this email address to view files shared with you.
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
