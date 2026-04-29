import { MediaDashboard } from "@/components/media-dashboard";
import { getRequiredAppUser } from "@/lib/auth/user";
import { getSafeGhlConnection } from "@/lib/ghl/client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const appUser = await getRequiredAppUser();
  const ghlConnection = await getSafeGhlConnection();
  const mediaStorageReady = Boolean(ghlConnection.connected && ghlConnection.locationId);

  return (
    <MediaDashboard
      initialStorageReady={mediaStorageReady}
      currentUser={{
        id: appUser.id,
        email: appUser.email ?? null,
        emailNormalized: appUser.emailNormalized ?? null,
      }}
    />
  );
}
