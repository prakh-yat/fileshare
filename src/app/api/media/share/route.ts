import { NextResponse, type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/auth/api";
import { mediaErrorResponse } from "@/lib/media/response";
import { sendFileShareWebhook, shareMediaObjects } from "@/lib/media/store";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  try {
    const body = (await request.json()) as {
      email?: string;
      mediaObjectIds?: string[];
    };

    const result = await shareMediaObjects({
      mediaObjectIds: Array.isArray(body.mediaObjectIds) ? body.mediaObjectIds : [],
      owner: auth.appUser,
      email: body.email ?? "",
    });
    const webhook = await sendFileShareWebhook({
      email: result.sharedWithEmail,
      owner: auth.appUser,
      items: result.webhookItems,
    });

    return NextResponse.json({
      sharedWithEmail: result.sharedWithEmail,
      shares: result.shares.map((share) => ({
        id: share.id,
        mediaObjectId: share.mediaObjectId,
        sharedWithEmail: share.sharedWithEmail,
        createdAt: share.createdAt.toISOString(),
      })),
      items: result.webhookItems,
      webhook,
    });
  } catch (error) {
    return mediaErrorResponse(error);
  }
}
