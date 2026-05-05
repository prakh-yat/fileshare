import { getEnv } from "@/lib/env";

export const DEFAULT_GHL_SCOPES =
  "medias.readonly medias.write locations.readonly oauth.readonly oauth.write";

export function getGhlConfig() {
  return {
    clientId: process.env.GHL_CLIENT_ID ?? "",
    clientSecret: process.env.GHL_CLIENT_SECRET ?? "",
    authUrl: getEnv(
      "GHL_AUTH_URL",
      "https://marketplace.leadconnectorhq.com/oauth/chooselocation",
    ),
    tokenUrl: getEnv("GHL_TOKEN_URL", "https://services.leadconnectorhq.com/oauth/token"),
    apiBaseUrl: getEnv("GHL_API_BASE_URL", "https://services.leadconnectorhq.com"),
    apiVersion: getEnv("GHL_API_VERSION", "2021-07-28"),
    userType: getEnv("GHL_USER_TYPE", "Location"),
    scopes: getEnv("GHL_SCOPES", DEFAULT_GHL_SCOPES),
    defaultLocationId: process.env.GHL_DEFAULT_LOCATION_ID || null,
  };
}
