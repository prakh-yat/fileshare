import { NextResponse, type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/auth/api";
import { getAuthorizedGhlContext, ghlFetch } from "@/lib/ghl/client";
import { mediaErrorResponse } from "@/lib/media/response";
import { requireOwnedFolder, trackMediaObjectFromGhl } from "@/lib/media/store";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  try {
    const context = await getAuthorizedGhlContext();
    const body = (await request.json()) as { name?: string; parentId?: string | null };
    const name = body.name?.trim();
    const parent = body.parentId ? await requireOwnedFolder(body.parentId, auth.appUser.id) : null;

    if (!name) {
      return NextResponse.json({ error: "Folder name is required." }, { status: 400 });
    }

    const data = await ghlFetch(
      "/medias/folder",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          altId: context.locationId,
          altType: "location",
          name,
          ...(parent ? { parentId: parent.ghlId } : {}),
        }),
      },
      context,
    );

    const item = await trackMediaObjectFromGhl({
      ownerId: auth.appUser.id,
      parentId: parent?.id ?? null,
      parentGhlId: parent?.ghlId ?? null,
      fallbackName: name,
      fallbackType: "FOLDER",
      payload: data,
    });

    return NextResponse.json({ item });
  } catch (error) {
    return mediaErrorResponse(error);
  }
}
