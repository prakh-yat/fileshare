import { MediaDashboard } from "@/components/media-dashboard";
import { getRequiredAppUser } from "@/lib/auth/user";
import { getSafeGhlConnection } from "@/lib/ghl/client";

export default async function DashboardPage() {
  await getRequiredAppUser();
  const ghlConnection = await getSafeGhlConnection();
  const mediaStorageReady = Boolean(ghlConnection.connected && ghlConnection.locationId);

  return (
    <MediaDashboard
      initialStorageReady={mediaStorageReady}
    />
  );
}
