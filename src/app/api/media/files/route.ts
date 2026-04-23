import { NextResponse, type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/auth/api";
import { getAuthorizedGhlContext, ghlFetch } from "@/lib/ghl/client";
import { mediaErrorResponse } from "@/lib/media/response";
import {
  listMediaObjects,
  parseMediaFilter,
  parseMediaScope,
  parseMediaSort,
  syncTrackedMediaObjectsFromGhl,
} from "@/lib/media/store";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  try {
    const scope = parseMediaScope(request.nextUrl.searchParams.get("scope"));
    const filter = parseMediaFilter(request.nextUrl.searchParams.get("type"));
    const parentId = request.nextUrl.searchParams.get("parentId");
    const sortBy = request.nextUrl.searchParams.get("sortBy") ?? "updatedAt";
    const sortOrder = request.nextUrl.searchParams.get("sortOrder") ?? "desc";
    const sort = parseMediaSort(
      sortBy === "name" ? `name-${sortOrder}` : `updated-${sortOrder}`,
    );
    const listInput = {
      appUser: auth.appUser,
      scope,
      parentId,
      filter,
      sort,
    };
    let items = await listMediaObjects(listInput);

    const context = await getAuthorizedGhlContext();
    let parentGhlId: string | null = null;
    if (parentId) {
      const parent = await getPrisma().mediaObject.findUnique({
        where: { id: parentId },
        select: { ghlId: true },
      });
      parentGhlId = parent?.ghlId ?? null;
    }

    const mediaTypes = filter === "all" ? (["file", "folder"] as const) : ([filter] as const);
    const data = await Promise.all(
      mediaTypes.map((mediaType) =>
        ghlFetch(
          `/medias/files?${buildGhlListParams({
            request,
            locationId: context.locationId,
            parentGhlId,
            type: mediaType,
          }).toString()}`,
          {},
          context,
        ),
      ),
    );

    await syncTrackedMediaObjectsFromGhl(items, data);
    items = await listMediaObjects(listInput);

    return NextResponse.json({ items });
  } catch (error) {
    return mediaErrorResponse(error);
  }
}

function buildGhlListParams({
  request,
  locationId,
  parentGhlId,
  type,
}: {
  request: NextRequest;
  locationId: string;
  parentGhlId: string | null;
  type: "file" | "folder";
}) {
  const params = new URLSearchParams(request.nextUrl.searchParams);
  params.delete("scope");
  params.delete("parentId");
  params.set("altType", "location");
  params.set("altId", locationId);
  params.set("type", type);

  if (!params.get("sortBy")) params.set("sortBy", "updatedAt");
  if (!params.get("sortOrder")) params.set("sortOrder", "desc");
  if (!params.get("limit")) params.set("limit", "100");
  if (parentGhlId) params.set("parentId", parentGhlId);

  return params;
}
