import { NextResponse, type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/auth/api";
import { getAuthorizedGhlContext, ghlFetch } from "@/lib/ghl/client";
import { mediaErrorResponse } from "@/lib/media/response";
import {
  deleteTrackedMediaObjects,
  getOwnedMediaObject,
  requireOwnedFolder,
  updateTrackedMediaObjectFromGhl,
} from "@/lib/media/store";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    const mediaObject = await getOwnedMediaObject(id, auth.appUser.id);
    const ghlContext = await getAuthorizedGhlContext();
    const body = (await request.json()) as {
      name?: unknown;
      parentId?: unknown;
    };
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : undefined;
    const hasParentChange = Object.prototype.hasOwnProperty.call(body, "parentId");
    const requestedParentId =
      typeof body.parentId === "string" && body.parentId.trim() ? body.parentId.trim() : null;
    const parent =
      hasParentChange && requestedParentId && requestedParentId !== mediaObject.id
        ? await requireOwnedFolder(requestedParentId, auth.appUser.id)
        : null;

    const data = await ghlFetch(
      `/medias/${encodeURIComponent(mediaObject.ghlId)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name ?? mediaObject.name,
          ...(hasParentChange ? { parentId: parent?.ghlId ?? null } : {}),
          altId: ghlContext.locationId,
          altType: "location",
        }),
      },
      ghlContext,
    );

    const item = await updateTrackedMediaObjectFromGhl({
      objectId: mediaObject.id,
      payload: data,
      fallbackName: name,
      parentId: hasParentChange ? (parent?.id ?? null) : undefined,
      parentGhlId: parent?.ghlId ?? null,
      appUser: auth.appUser,
    });

    return NextResponse.json({ item });
  } catch (error) {
    return mediaErrorResponse(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    const mediaObject = await getOwnedMediaObject(id, auth.appUser.id);
    let data: unknown = null;
    let remoteError: string | null = null;

    try {
      const ghlContext = await getAuthorizedGhlContext();
      data = await ghlFetch(
        "/medias/delete-files",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "deleted",
            filesToBeDeleted: [{ _id: mediaObject.ghlId }],
            altType: "location",
            altId: ghlContext.locationId,
          }),
        },
        ghlContext,
      );
    } catch (error) {
      remoteError = error instanceof Error ? error.message : "Media storage delete failed.";
    }

    await deleteTrackedMediaObjects([mediaObject.id], auth.appUser.id);

    return NextResponse.json({
      data,
      remoteDeleted: !remoteError,
      remoteError,
      status: "deleted",
    });
  } catch (error) {
    return mediaErrorResponse(error);
  }
}
