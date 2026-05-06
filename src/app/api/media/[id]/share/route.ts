import { NextResponse, type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/auth/api";
import { getPublicAppUrl } from "@/lib/env";
import { MediaError } from "@/lib/media/errors";
import { mediaErrorResponse } from "@/lib/media/response";
import { sendFileShareEmailNotification } from "@/lib/media/share-email";
import {
  normalizeShareRecipientEmails,
  sendFileShareWebhook,
  shareMediaObjects,
} from "@/lib/media/store";

export const runtime = "nodejs";

type ShareRecipientResult = {
  result: Awaited<ReturnType<typeof shareMediaObjects>>;
  webhook: Awaited<ReturnType<typeof sendFileShareWebhook>>;
  emailNotification: Awaited<ReturnType<typeof sendFileShareEmailNotification>>;
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    const body = (await request.json()) as { email?: string; emails?: string[] };
    const recipients = normalizeShareRecipientEmails(
      Array.isArray(body.emails) ? body.emails : body.email ?? "",
    );
    if (auth.appUser.emailNormalized && recipients.includes(auth.appUser.emailNormalized)) {
      throw new MediaError("You already own this item.", 400);
    }
    const appUrl = getPublicAppUrl(request.headers.get("origin") ?? request.nextUrl.origin);

    const recipientResults: ShareRecipientResult[] = [];
    for (const email of recipients) {
      const result = await shareMediaObjects({
        mediaObjectIds: [id],
        owner: auth.appUser,
        email,
      });
      const webhook = await sendFileShareWebhook({
        email: result.sharedWithEmail,
        owner: auth.appUser,
        items: result.webhookItems,
      });
      const emailNotification = await sendFileShareEmailNotification({
        to: result.sharedWithEmail,
        owner: auth.appUser,
        items: result.webhookItems,
        appUrl,
      });
      recipientResults.push({ result, webhook, emailNotification });
    }

    const first = recipientResults[0];
    const share = first?.result.shares[0];
    if (!share) {
      throw new MediaError("Unable to create share.", 500);
    }

    return NextResponse.json({
      sharedWithEmails: recipientResults.map(({ result }) => result.sharedWithEmail),
      share: {
        id: share.id,
        sharedWithEmail: share.sharedWithEmail,
        createdAt: share.createdAt.toISOString(),
      },
      webhook: first?.webhook,
      emailNotification: {
        delivered: first.emailNotification.delivered,
        error: first.emailNotification.error,
      },
      recipients: recipientResults.map(({ result, webhook, emailNotification }) => ({
        sharedWithEmail: result.sharedWithEmail,
        shares: result.shares.map((entry) => ({
          id: entry.id,
          mediaObjectId: entry.mediaObjectId,
          sharedWithEmail: entry.sharedWithEmail,
          createdAt: entry.createdAt.toISOString(),
        })),
        webhook,
        emailNotification: {
          delivered: emailNotification.delivered,
          error: emailNotification.error,
        },
      })),
    });
  } catch (error) {
    return mediaErrorResponse(error);
  }
}
