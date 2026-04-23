import { NextResponse, type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/auth/api";
import { getAuthorizedGhlContext, ghlFetch } from "@/lib/ghl/client";
import { mediaErrorResponse } from "@/lib/media/response";
import {
  getOwnedMediaObject,
  requireOwnedFolder,
  updateTrackedMediaObjectFromGhl,
} from "@/lib/media/store";

export const runtime = "nodejs";

export async function PUT(request: NextRequest) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  try {
    const context = await getAuthorizedGhlContext();
    const body = (await request.json()) as {
      filesToBeUpdated?: Array<{ id?: string; parentId?: string | null }>;
    };
    const updates = Array.isArray(body.filesToBeUpdated) ? body.filesToBeUpdated : [];
    const ownedObjects = await Promise.all(
      updates.map(async (update) => {
        if (!update.id) throw new Error("File or folder id is required.");
        const mediaObject = await getOwnedMediaObject(update.id, auth.appUser.id);
        const parent = update.parentId
          ? await requireOwnedFolder(update.parentId, auth.appUser.id)
          : null;

        return {
          mediaObject,
          parent,
        };
      }),
    );

    const data = await ghlFetch(
      "/medias/update-files",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filesToBeUpdated: ownedObjects.map(({ mediaObject, parent }) => ({
            id: mediaObject.ghlId,
            name: mediaObject.name,
            parentId: parent?.ghlId ?? null,
          })),
          altId: context.locationId,
          altType: "location",
        }),
      },
      context,
    );

    await Promise.all(
      ownedObjects.map(({ mediaObject, parent }) =>
        updateTrackedMediaObjectFromGhl({
          objectId: mediaObject.id,
          payload: mediaObject.raw ?? {},
          fallbackName: mediaObject.name,
          parentId: parent?.id ?? null,
          parentGhlId: parent?.ghlId ?? null,
          appUser: auth.appUser,
        }),
      ),
    );

    return NextResponse.json(data);
  } catch (error) {
    return mediaErrorResponse(error);
  }
}
