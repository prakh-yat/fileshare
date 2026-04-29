import { NextResponse, type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/auth/api";
import { mediaErrorResponse } from "@/lib/media/response";
import {
  listMediaObjects,
  parseMediaFilter,
  parseMediaScope,
  parseMediaSort,
} from "@/lib/media/store";

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

    const items = await listMediaObjects({
      appUser: auth.appUser,
      scope,
      parentId,
      filter,
      sort,
    });

    return NextResponse.json(
      { items },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    return mediaErrorResponse(error);
  }
}
