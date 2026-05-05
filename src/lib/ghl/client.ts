import type { GhlAppConnection } from "@prisma/client";

import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { getPublicAppUrl } from "@/lib/env";
import { getGhlConfig } from "@/lib/ghl/config";
import { getPrisma } from "@/lib/prisma";

type GhlTokenResponse = {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  refreshTokenId?: string;
  userType?: string;
  companyId?: string;
  locationId?: string;
  userId?: string;
  isBulkInstallation?: boolean;
};

export type SafeGhlConnection = {
  connected: boolean;
  userType?: string | null;
  companyId?: string | null;
  locationId?: string | null;
  externalUserId?: string | null;
  expiresAt?: string | null;
  scope?: string | null;
};

type AuthorizedGhlContext = {
  accessToken: string;
  locationId: string;
  apiBaseUrl: string;
  apiVersion: string;
};

const APP_CONNECTION_ID = "primary";

export function getGhlRedirectUri(origin?: string | null) {
  return `${getPublicAppUrl(origin)}/api/oauth/callback`;
}

export async function exchangeAuthorizationCode(code: string, redirectUri: string) {
  const config = getGhlConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "authorization_code",
    code,
    user_type: config.userType,
    redirect_uri: redirectUri,
  });

  return requestToken(params);
}

export async function saveGhlAppConnection(token: GhlTokenResponse) {
  const prisma = getPrisma();
  const expiresAt = token.expires_in
    ? new Date(Date.now() + token.expires_in * 1000)
    : null;

  return prisma.ghlAppConnection.upsert({
    where: { id: APP_CONNECTION_ID },
    update: {
      accessTokenEncrypted: encryptSecret(token.access_token)!,
      refreshTokenEncrypted: encryptSecret(token.refresh_token),
      tokenType: token.token_type ?? "Bearer",
      scope: token.scope,
      refreshTokenId: token.refreshTokenId,
      userType: token.userType,
      companyId: token.companyId,
      locationId: token.locationId,
      externalUserId: token.userId,
      isBulkInstallation: token.isBulkInstallation,
      expiresAt,
    },
    create: {
      id: APP_CONNECTION_ID,
      accessTokenEncrypted: encryptSecret(token.access_token)!,
      refreshTokenEncrypted: encryptSecret(token.refresh_token),
      tokenType: token.token_type ?? "Bearer",
      scope: token.scope,
      refreshTokenId: token.refreshTokenId,
      userType: token.userType,
      companyId: token.companyId,
      locationId: token.locationId,
      externalUserId: token.userId,
      isBulkInstallation: token.isBulkInstallation,
      expiresAt,
    },
  });
}

export async function getSafeGhlConnection(): Promise<SafeGhlConnection> {
  const prisma = getPrisma();
  const defaultLocationId = process.env.GHL_DEFAULT_LOCATION_ID || null;
  const connection = await prisma.ghlAppConnection.findUnique({
    where: { id: APP_CONNECTION_ID },
  });

  if (!connection) return { connected: false };

  return {
    connected: true,
    userType: connection.userType,
    companyId: connection.companyId,
    locationId: connection.locationId ?? defaultLocationId,
    externalUserId: connection.externalUserId,
    expiresAt: connection.expiresAt?.toISOString() ?? null,
    scope: connection.scope,
  };
}

export async function updateGhlLocation(locationId: string) {
  const prisma = getPrisma();

  return prisma.ghlAppConnection.update({
    where: { id: APP_CONNECTION_ID },
    data: { locationId },
  });
}

export async function deleteGhlConnection() {
  const prisma = getPrisma();

  await prisma.ghlAppConnection.deleteMany({
    where: { id: APP_CONNECTION_ID },
  });
}

export async function getAuthorizedGhlContext(): Promise<AuthorizedGhlContext> {
  const config = getGhlConfig();
  const prisma = getPrisma();
  const connection = await prisma.ghlAppConnection.findUnique({
    where: { id: APP_CONNECTION_ID },
  });

  if (!connection) {
    throw new GhlError("Media storage is not configured.", 409);
  }

  const refreshed = await refreshIfNeeded(connection);
  const locationId = refreshed.locationId || config.defaultLocationId;

  if (!locationId) {
    throw new GhlError("Media storage location is not configured.", 409);
  }

  return {
    accessToken: decryptSecret(refreshed.accessTokenEncrypted)!,
    locationId,
    apiBaseUrl: config.apiBaseUrl,
    apiVersion: config.apiVersion,
  };
}

export async function ghlFetch(
  path: string,
  init: RequestInit = {},
  authorizedContext?: AuthorizedGhlContext,
) {
  const context = authorizedContext ?? (await getAuthorizedGhlContext());
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${context.accessToken}`);
  headers.set("Version", context.apiVersion);
  headers.set("Accept", "application/json");

  const response = await fetch(`${context.apiBaseUrl}${path}`, {
    ...init,
    headers,
  });

  return parseGhlResponse(response);
}

export class GhlError extends Error {
  constructor(
    message: string,
    public status = 500,
  ) {
    super(message);
  }
}

async function refreshIfNeeded(connection: GhlAppConnection) {
  const expiresAt = connection.expiresAt?.getTime() ?? 0;
  const shouldRefresh = expiresAt > 0 && expiresAt - Date.now() < 5 * 60 * 1000;

  if (!shouldRefresh) return connection;

  const refreshToken = decryptSecret(connection.refreshTokenEncrypted);
  if (!refreshToken) return connection;

  const config = getGhlConfig();
  if (!config.clientId || !config.clientSecret) return connection;

  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    user_type: connection.userType || config.userType,
  });

  const token = await requestToken(params);
  const prisma = getPrisma();

  return prisma.ghlAppConnection.update({
    where: { id: connection.id },
    data: {
      accessTokenEncrypted: encryptSecret(token.access_token)!,
      refreshTokenEncrypted: encryptSecret(token.refresh_token ?? refreshToken),
      tokenType: token.token_type ?? connection.tokenType,
      scope: token.scope ?? connection.scope,
      refreshTokenId: token.refreshTokenId ?? connection.refreshTokenId,
      userType: token.userType ?? connection.userType,
      companyId: token.companyId ?? connection.companyId,
      locationId: token.locationId ?? connection.locationId,
      externalUserId: token.userId ?? connection.externalUserId,
      isBulkInstallation: token.isBulkInstallation ?? connection.isBulkInstallation,
      expiresAt: token.expires_in
        ? new Date(Date.now() + token.expires_in * 1000)
        : connection.expiresAt,
    },
  });
}

async function requestToken(params: URLSearchParams): Promise<GhlTokenResponse> {
  const config = getGhlConfig();
  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  const payload = await parseGhlResponse(response);

  if (!isTokenResponse(payload)) {
    throw new GhlError("GHL token response did not include an access token.", 502);
  }

  return payload;
}

async function parseGhlResponse(response: Response) {
  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "message" in payload
        ? String((payload as { message: unknown }).message)
        : `GHL request failed with status ${response.status}.`;

    throw new GhlError(message, response.status);
  }

  return payload;
}

function isTokenResponse(value: unknown): value is GhlTokenResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "access_token" in value &&
    typeof (value as { access_token: unknown }).access_token === "string"
  );
}
