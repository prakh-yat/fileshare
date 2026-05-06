import { NextResponse, type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/auth/api";
import { getPublicAppUrl } from "@/lib/env";
import { MediaError } from "@/lib/media/errors";
import { sendFileShareEmailNotification } from "@/lib/media/share-email";
import { mediaErrorResponse } from "@/lib/media/response";
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

export async function POST(request: NextRequest) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  try {
    const body = (await request.json()) as {
      email?: string;
      emails?: string[];
      mediaObjectIds?: string[];
    };
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
        mediaObjectIds: Array.isArray(body.mediaObjectIds) ? body.mediaObjectIds : [],
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

    return NextResponse.json({
      sharedWithEmail: first?.result.sharedWithEmail ?? "",
      sharedWithEmails: recipientResults.map(({ result }) => result.sharedWithEmail),
      shares: recipientResults.flatMap(({ result }) => result.shares).map((share) => ({
        id: share.id,
        mediaObjectId: share.mediaObjectId,
        sharedWithEmail: share.sharedWithEmail,
        createdAt: share.createdAt.toISOString(),
      })),
      items: first?.result.webhookItems ?? [],
      webhook: first?.webhook,
      emailNotification: first
        ? {
            delivered: first.emailNotification.delivered,
            error: first.emailNotification.error,
          }
        : undefined,
      recipients: recipientResults.map(({ result, webhook, emailNotification }) => ({
        sharedWithEmail: result.sharedWithEmail,
        shares: result.shares.map((share) => ({
          id: share.id,
          mediaObjectId: share.mediaObjectId,
          sharedWithEmail: share.sharedWithEmail,
          createdAt: share.createdAt.toISOString(),
        })),
        items: result.webhookItems,
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
