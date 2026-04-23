import { MediaObjectType, Prisma, type AppUser } from "@prisma/client";

import { MediaError } from "@/lib/media/errors";
import { getPrisma } from "@/lib/prisma";
import { normalizeMediaPayload, normalizeSingleMedia, type NormalizedMedia } from "./normalize";

export type MediaScope = "mine" | "shared";
export type MediaFilter = "all" | "file" | "folder";
export type MediaSort = "updated-desc" | "updated-asc" | "name-asc" | "name-desc";

export type SerializedMediaObject = {
  id: string;
  ghlId: string;
  name: string;
  type: "file" | "folder";
  url?: string;
  thumbnailUrl?: string;
  mimeType?: string;
  size?: number;
  createdAt?: string;
  updatedAt?: string;
  parentId?: string | null;
  ownerName: string;
  ownerEmail?: string | null;
  isOwner: boolean;
  sharedWithMe: boolean;
  canRename: boolean;
  canMove: boolean;
  canDelete: boolean;
  canShare: boolean;
  raw: Record<string, unknown>;
};

export type SharedMediaSummary = {
  id: string;
  ghlId: string;
  name: string;
  type: "file" | "folder";
  url?: string | null;
  parentId?: string | null;
  ownerName: string;
  ownerEmail?: string | null;
};

const mediaObjectInclude = {
  owner: {
    select: {
      id: true,
      email: true,
      emailNormalized: true,
    },
  },
  shares: true,
} satisfies Prisma.MediaObjectInclude;

type MediaObjectWithAccess = Prisma.MediaObjectGetPayload<{
  include: typeof mediaObjectInclude;
}>;

type TrackMediaInput = {
  ownerId: string;
  parentId?: string | null;
  parentGhlId?: string | null;
  fallbackName?: string;
  fallbackType: MediaObjectType;
  payload: unknown;
};

type MediaObjectScalarData = {
  name: string;
  type: MediaObjectType;
  url?: string | null;
  thumbnailUrl?: string | null;
  mimeType?: string | null;
  size?: number | null;
  raw?: Prisma.InputJsonValue;
  ghlCreatedAt?: Date | null;
  ghlUpdatedAt?: Date | null;
};

export function parseMediaScope(value: string | null): MediaScope {
  return value === "shared" ? "shared" : "mine";
}

export function parseMediaFilter(value: string | null): MediaFilter {
  return value === "file" || value === "folder" ? value : "all";
}

export function parseMediaSort(value: string | null): MediaSort {
  if (
    value === "updated-asc" ||
    value === "name-asc" ||
    value === "name-desc" ||
    value === "updated-desc"
  ) {
    return value;
  }

  return "updated-desc";
}

export async function listMediaObjects({
  appUser,
  scope,
  parentId,
  filter,
  sort,
}: {
  appUser: AppUser;
  scope: MediaScope;
  parentId?: string | null;
  filter: MediaFilter;
  sort: MediaSort;
}) {
  const prisma = getPrisma();
  const typeWhere = mediaTypeWhere(filter);
  let where: Prisma.MediaObjectWhereInput;

  if (scope === "mine") {
    if (parentId) {
      await requireOwnedFolder(parentId, appUser.id);
    }

    where = {
      ownerId: appUser.id,
      parentId: parentId || null,
      isDeleted: false,
      ...typeWhere,
    };
  } else if (parentId) {
    const parent = await requireReadableFolder(parentId, appUser);
    where = {
      ownerId: parent.ownerId,
      parentId: parent.id,
      isDeleted: false,
      ...typeWhere,
    };
  } else {
    where = {
      isDeleted: false,
      shares: {
        some: shareRecipientWhere(appUser),
      },
      ...typeWhere,
    };
  }

  const objects = await prisma.mediaObject.findMany({
    where,
    include: mediaObjectInclude,
  });

  return sortMediaObjects(objects, sort).map((object) => serializeMediaObject(object, appUser));
}

export async function syncTrackedMediaObjectsFromGhl(
  objects: SerializedMediaObject[],
  ghlPayload: unknown,
) {
  const normalized = normalizeMediaPayload(ghlPayload);
  if (!normalized.length || !objects.length) return;

  const byGhlId = new Map(normalized.map((item) => [item.ghlId, item]));
  const prisma = getPrisma();

  await Promise.all(
    objects.map((object) => {
      const match = byGhlId.get(object.ghlId);
      if (!match) return null;

      return prisma.mediaObject.update({
        where: { id: object.id },
        data: mediaUpdateData(match),
      });
    }),
  );
}

export async function getOwnedMediaObject(id: string, ownerId: string) {
  const object = await getPrisma().mediaObject.findFirst({
    where: {
      id,
      ownerId,
      isDeleted: false,
    },
    include: mediaObjectInclude,
  });

  if (!object) {
    throw new MediaError("You can only change files or folders you own.", 403);
  }

  return object;
}

export async function requireOwnedFolder(id: string, ownerId: string) {
  const object = await getOwnedMediaObject(id, ownerId);
  if (object.type !== "FOLDER") {
    throw new MediaError("Destination folder was not found.", 404);
  }

  return object;
}

export async function trackMediaObjectFromGhl(input: TrackMediaInput) {
  const normalized = normalizeSingleMedia(input.payload, {
    name: input.fallbackName,
    type: input.fallbackType,
    parentGhlId: input.parentGhlId,
  });

  if (!normalized) {
    throw new MediaError("Media storage did not return a usable file or folder id.", 502);
  }

  const prisma = getPrisma();
  const existing = await prisma.mediaObject.findUnique({
    where: { ghlId: normalized.ghlId },
  });

  if (existing && existing.ownerId !== input.ownerId) {
    throw new MediaError("Media storage returned an object owned by another user.", 409);
  }

  const data: MediaObjectScalarData & {
    parentId: string | null;
    isDeleted: false;
  } = {
    ...mediaUpdateData(normalized),
    type: normalized.type,
    name: normalized.name,
    parentId: input.parentId || null,
    isDeleted: false,
  };

  const object = existing
    ? await prisma.mediaObject.update({
        where: { id: existing.id },
        data: data satisfies Prisma.MediaObjectUncheckedUpdateInput,
        include: mediaObjectInclude,
      })
    : await prisma.mediaObject.create({
        data: {
          ghlId: normalized.ghlId,
          ownerId: input.ownerId,
          ...data,
        } satisfies Prisma.MediaObjectUncheckedCreateInput,
        include: mediaObjectInclude,
      });

  return serializeMediaObject(object, { id: input.ownerId } as AppUser);
}

export async function updateTrackedMediaObjectFromGhl({
  objectId,
  payload,
  fallbackName,
  parentId,
  parentGhlId,
  appUser,
}: {
  objectId: string;
  payload: unknown;
  fallbackName?: string;
  parentId?: string | null;
  parentGhlId?: string | null;
  appUser: AppUser;
}) {
  const existing = await getOwnedMediaObject(objectId, appUser.id);
  const normalized = normalizeSingleMedia(payload, {
    name: fallbackName ?? existing.name,
    type: existing.type,
    parentGhlId,
  });
  const data: Partial<MediaObjectScalarData> = normalized
    ? mediaUpdateData(normalized)
    : {
        ...(fallbackName ? { name: fallbackName } : {}),
      };

  const object = await getPrisma().mediaObject.update({
    where: { id: existing.id },
    data: {
      ...data,
      ...(parentId !== undefined ? { parentId } : {}),
      isDeleted: false,
    } satisfies Prisma.MediaObjectUncheckedUpdateInput,
    include: mediaObjectInclude,
  });

  return serializeMediaObject(object, appUser);
}

export async function deleteTrackedMediaObjects(ids: string[], ownerId: string) {
  const prisma = getPrisma();
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));

  if (!uniqueIds.length) return;

  const ownedRoots = await prisma.mediaObject.findMany({
    where: {
      id: { in: uniqueIds },
      ownerId,
    },
    select: {
      id: true,
    },
  });

  if (!ownedRoots.length) return;

  const descendantIds = new Set(ownedRoots.map((object) => object.id));
  let frontier = ownedRoots.map((object) => object.id);

  while (frontier.length) {
    const children = await prisma.mediaObject.findMany({
      where: {
        parentId: { in: frontier },
        ownerId,
      },
      select: {
        id: true,
      },
    });

    const nextFrontier = children
      .map((child) => child.id)
      .filter((id) => !descendantIds.has(id));

    nextFrontier.forEach((id) => descendantIds.add(id));
    frontier = nextFrontier;
  }

  await prisma.mediaObject.deleteMany({
    where: {
      id: { in: Array.from(descendantIds) },
      ownerId,
    },
  });
}

export async function shareMediaObject({
  mediaObjectId,
  owner,
  email,
}: {
  mediaObjectId: string;
  owner: AppUser;
  email: string;
}) {
  const result = await shareMediaObjects({
    mediaObjectIds: [mediaObjectId],
    owner,
    email,
  });

  const share = result.shares[0];
  if (!share) {
    throw new MediaError("Unable to create share.", 500);
  }

  return share;
}

export async function shareMediaObjects({
  mediaObjectIds,
  owner,
  email,
}: {
  mediaObjectIds: string[];
  owner: AppUser;
  email: string;
}) {
  const sharedWithEmail = email.trim().toLowerCase();
  if (!sharedWithEmail || !sharedWithEmail.includes("@")) {
    throw new MediaError("Enter a valid email address.", 400);
  }
  if (owner.emailNormalized && owner.emailNormalized === sharedWithEmail) {
    throw new MediaError("You already own this item.", 400);
  }

  const uniqueIds = Array.from(new Set(mediaObjectIds.filter(Boolean)));
  if (!uniqueIds.length) {
    throw new MediaError("Select at least one file or folder to share.", 400);
  }

  const prisma = getPrisma();
  const objects = await prisma.mediaObject.findMany({
    where: {
      id: { in: uniqueIds },
      ownerId: owner.id,
      isDeleted: false,
    },
    include: mediaObjectInclude,
  });

  if (objects.length !== uniqueIds.length) {
    throw new MediaError("You can only share files or folders you own.", 403);
  }

  const objectsById = new Map(objects.map((object) => [object.id, object]));
  const orderedObjects = uniqueIds
    .map((id) => objectsById.get(id))
    .filter((object): object is MediaObjectWithAccess => Boolean(object));

  const recipient = await prisma.appUser.findUnique({
    where: { emailNormalized: sharedWithEmail },
  });

  const shares = await prisma.$transaction(
    orderedObjects.map((object) =>
      prisma.mediaShare.upsert({
        where: {
          mediaObjectId_sharedWithEmail: {
            mediaObjectId: object.id,
            sharedWithEmail,
          },
        },
        update: {
          sharedById: owner.id,
          sharedWithId: recipient?.id ?? null,
        },
        create: {
          mediaObjectId: object.id,
          sharedById: owner.id,
          sharedWithId: recipient?.id ?? null,
          sharedWithEmail,
        },
      }),
    ),
  );

  return {
    sharedWithEmail,
    shares,
    objects: orderedObjects,
    webhookItems: orderedObjects.map((object) => toSharedMediaSummary(object)),
  };
}

export async function sendFileShareWebhook({
  email,
  owner,
  items,
}: {
  email: string;
  owner: AppUser;
  items: SharedMediaSummary[];
}) {
  const webhookUrl =
    process.env.FILE_SHARE_WEBHOOK_URL ||
    "https://primary-production-4e174.up.railway.app/webhook/fileshare";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        name: owner.email ?? owner.emailNormalized ?? "Unknown owner",
        owner: {
          id: owner.id,
          email: owner.email,
        },
        files: items.filter((item) => item.type === "file"),
        folders: items.filter((item) => item.type === "folder"),
        shared: items,
        sharedAt: new Date().toISOString(),
      }),
      signal: controller.signal,
    });

    return {
      delivered: response.ok,
      status: response.status,
    };
  } catch (error) {
    return {
      delivered: false,
      error: error instanceof Error ? error.message : "Webhook request failed.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function serializeMediaObject(
  object: MediaObjectWithAccess,
  appUser: Pick<AppUser, "id">,
): SerializedMediaObject {
  const isOwner = object.ownerId === appUser.id;

  return {
    id: object.id,
    ghlId: object.ghlId,
    name: object.name,
    type: object.type === "FOLDER" ? "folder" : "file",
    url: object.url ?? undefined,
    thumbnailUrl: object.thumbnailUrl ?? undefined,
    mimeType: object.mimeType ?? undefined,
    size: object.size ?? undefined,
    createdAt: (object.ghlCreatedAt ?? object.createdAt).toISOString(),
    updatedAt: (object.ghlUpdatedAt ?? object.updatedAt).toISOString(),
    parentId: object.parentId,
    ownerName: object.owner.email ?? "Unknown owner",
    ownerEmail: object.owner.email,
    isOwner,
    sharedWithMe: !isOwner,
    canRename: isOwner,
    canMove: isOwner,
    canDelete: isOwner,
    canShare: isOwner,
    raw: asRecord(object.raw),
  };
}

async function requireReadableFolder(id: string, appUser: AppUser) {
  const object = await getPrisma().mediaObject.findFirst({
    where: {
      id,
      isDeleted: false,
    },
    include: mediaObjectInclude,
  });

  if (!object || object.type !== "FOLDER" || !(await canReadMediaObject(object, appUser))) {
    throw new MediaError("Folder was not found.", 404);
  }

  return object;
}

async function canReadMediaObject(object: MediaObjectWithAccess, appUser: AppUser) {
  if (object.ownerId === appUser.id || isDirectShare(object, appUser)) return true;

  let parentId = object.parentId;
  let depth = 0;

  while (parentId && depth < 50) {
    const parent = await getPrisma().mediaObject.findUnique({
      where: { id: parentId },
      include: mediaObjectInclude,
    });
    if (!parent || parent.isDeleted) return false;
    if (parent.ownerId === appUser.id || isDirectShare(parent, appUser)) return true;
    parentId = parent.parentId;
    depth += 1;
  }

  return false;
}

function isDirectShare(object: MediaObjectWithAccess, appUser: AppUser) {
  const email = appUser.emailNormalized;
  return object.shares.some(
    (share) => share.sharedWithId === appUser.id || Boolean(email && share.sharedWithEmail === email),
  );
}

function shareRecipientWhere(appUser: AppUser): Prisma.MediaShareWhereInput {
  return {
    OR: [
      { sharedWithId: appUser.id },
      ...(appUser.emailNormalized ? [{ sharedWithEmail: appUser.emailNormalized }] : []),
    ],
  };
}

function mediaTypeWhere(filter: MediaFilter): Prisma.MediaObjectWhereInput {
  if (filter === "file") return { type: "FILE" };
  if (filter === "folder") return { type: "FOLDER" };
  return {};
}

function sortMediaObjects(objects: MediaObjectWithAccess[], sort: MediaSort) {
  return [...objects].sort((a, b) => {
    if (sort === "name-asc" || sort === "name-desc") {
      const value = a.name.localeCompare(b.name);
      return sort === "name-asc" ? value : -value;
    }

    const aTime = (a.ghlUpdatedAt ?? a.updatedAt).getTime();
    const bTime = (b.ghlUpdatedAt ?? b.updatedAt).getTime();
    return sort === "updated-asc" ? aTime - bTime : bTime - aTime;
  });
}

function mediaUpdateData(normalized: NormalizedMedia): MediaObjectScalarData {
  return {
    name: normalized.name,
    type: normalized.type,
    url: normalized.url ?? null,
    thumbnailUrl: normalized.thumbnailUrl ?? null,
    mimeType: normalized.mimeType ?? null,
    size: normalized.size ?? null,
    raw: toJsonInput(normalized.raw),
    ghlCreatedAt: normalized.createdAt ?? null,
    ghlUpdatedAt: normalized.updatedAt ?? null,
  };
}

function toSharedMediaSummary(object: MediaObjectWithAccess): SharedMediaSummary {
  return {
    id: object.id,
    ghlId: object.ghlId,
    name: object.name,
    type: object.type === "FOLDER" ? "folder" : "file",
    url: object.url,
    parentId: object.parentId,
    ownerName: object.owner.email ?? "Unknown owner",
    ownerEmail: object.owner.email,
  };
}

function toJsonInput(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function asRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
