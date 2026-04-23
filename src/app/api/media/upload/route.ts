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
    const incoming = await request.formData();
    const formData = new FormData();
    const requestedParentId = readFormString(incoming.get("parentId"));
    const parent = requestedParentId
      ? await requireOwnedFolder(requestedParentId, auth.appUser.id)
      : null;
    const file = incoming.get("file");
    const name =
      readFormString(incoming.get("name")) ||
      (file instanceof File ? file.name : undefined) ||
      "Untitled";

    incoming.forEach((value, key) => {
      if (key === "parentId") return;
      formData.append(key, value);
    });
    formData.set("altType", "location");
    formData.set("altId", context.locationId);
    if (parent) formData.set("parentId", parent.ghlId);

    const data = await ghlFetch(
      "/medias/upload-file",
      {
        method: "POST",
        body: formData,
      },
      context,
    );

    const item = await trackMediaObjectFromGhl({
      ownerId: auth.appUser.id,
      parentId: parent?.id ?? null,
      parentGhlId: parent?.ghlId ?? null,
      fallbackName: name,
      fallbackType: "FILE",
      payload: data,
    });

    return NextResponse.json({ item });
  } catch (error) {
    return mediaErrorResponse(error);
  }
}

function readFormString(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
