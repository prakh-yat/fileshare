import { NextResponse, type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/auth/api";
import { getAuthorizedGhlContext, ghlFetch } from "@/lib/ghl/client";
import { mediaErrorResponse } from "@/lib/media/response";
import { deleteTrackedMediaObjects, getOwnedMediaObject } from "@/lib/media/store";

export const runtime = "nodejs";

export async function PUT(request: NextRequest) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  try {
    const body = (await request.json()) as {
      status?: string;
      filesToBeDeleted?: Array<{ id?: string }>;
    };
    const status = body.status === "deleted" ? "deleted" : "trashed";
    const targets = Array.isArray(body.filesToBeDeleted) ? body.filesToBeDeleted : [];
    const ownedObjects = await Promise.all(
      targets.map(async (target) => {
        if (!target.id) throw new Error("File or folder id is required.");
        return getOwnedMediaObject(target.id, auth.appUser.id);
      }),
    );

    let data: unknown = null;
    let remoteError: string | null = null;

    try {
      const context = await getAuthorizedGhlContext();
      data = await ghlFetch(
        "/medias/delete-files",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status,
            filesToBeDeleted: ownedObjects.map((object) => ({
              _id: object.ghlId,
            })),
            altId: context.locationId,
            altType: "location",
          }),
        },
        context,
      );
    } catch (error) {
      remoteError = error instanceof Error ? error.message : "Media storage delete failed.";
    }

    await deleteTrackedMediaObjects(
      ownedObjects.map((object) => object.id),
      auth.appUser.id,
    );

    return NextResponse.json({
      data,
      remoteDeleted: !remoteError,
      remoteError,
      status,
    });
  } catch (error) {
    return mediaErrorResponse(error);
  }
}
