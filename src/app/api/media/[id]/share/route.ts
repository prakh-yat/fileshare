import { NextResponse, type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/auth/api";
import { MediaError } from "@/lib/media/errors";
import { mediaErrorResponse } from "@/lib/media/response";
import { sendFileShareWebhook, shareMediaObjects } from "@/lib/media/store";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    const body = (await request.json()) as { email?: string };

    const result = await shareMediaObjects({
      mediaObjectIds: [id],
      owner: auth.appUser,
      email: body.email ?? "",
    });
    const webhook = await sendFileShareWebhook({
      email: result.sharedWithEmail,
      owner: auth.appUser,
      items: result.webhookItems,
    });
    const share = result.shares[0];
    if (!share) {
      throw new MediaError("Unable to create share.", 500);
    }

    return NextResponse.json({
      share: {
        id: share.id,
        sharedWithEmail: share.sharedWithEmail,
        createdAt: share.createdAt.toISOString(),
      },
      webhook,
    });
  } catch (error) {
    return mediaErrorResponse(error);
  }
}
