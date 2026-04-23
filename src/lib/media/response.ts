import { NextResponse } from "next/server";

import { GhlError } from "@/lib/ghl/client";
import { MediaError } from "@/lib/media/errors";

export function mediaErrorResponse(error: unknown) {
  if (error instanceof GhlError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof MediaError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : "Unexpected server error.";
  return NextResponse.json({ error: message }, { status: 500 });
}
