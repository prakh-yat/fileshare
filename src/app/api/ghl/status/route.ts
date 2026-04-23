import { NextResponse, type NextRequest } from "next/server";

import { requireGhlAdmin } from "@/lib/auth/admin";
import { requireApiUser } from "@/lib/auth/api";
import {
  deleteGhlConnection,
  getSafeGhlConnection,
  updateGhlLocation,
} from "@/lib/ghl/client";
import { mediaErrorResponse } from "@/lib/media/response";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const adminResponse = requireGhlAdmin(auth);
  if (adminResponse) return adminResponse;

  return NextResponse.json(await getSafeGhlConnection());
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const adminResponse = requireGhlAdmin(auth);
  if (adminResponse) return adminResponse;

  try {
    const body = (await request.json()) as { locationId?: string };
    const locationId = body.locationId?.trim();

    if (!locationId) {
      return NextResponse.json({ error: "Location ID is required." }, { status: 400 });
    }

    await updateGhlLocation(locationId);
    return NextResponse.json(await getSafeGhlConnection());
  } catch (error) {
    return mediaErrorResponse(error);
  }
}

export async function DELETE() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const adminResponse = requireGhlAdmin(auth);
  if (adminResponse) return adminResponse;

  await deleteGhlConnection();
  return NextResponse.json({ connected: false });
}
