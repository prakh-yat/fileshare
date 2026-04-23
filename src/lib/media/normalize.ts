import type { MediaObjectType } from "@prisma/client";

export type NormalizedMedia = {
  ghlId: string;
  name: string;
  type: MediaObjectType;
  url?: string;
  thumbnailUrl?: string;
  mimeType?: string;
  size?: number;
  parentGhlId?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  raw: Record<string, unknown>;
};

type NormalizeFallback = {
  name?: string;
  type?: MediaObjectType;
  parentGhlId?: string | null;
};

const MEDIA_ID_KEYS = ["_id", "id", "fileId", "folderId", "mediaId"] as const;
const MEDIA_PARENT_KEYS = ["parentId", "parentFolderId", "folderParentId", "folderId"] as const;
const PREFERRED_NESTED_KEYS = [
  "data",
  "files",
  "folders",
  "items",
  "medias",
  "results",
  "file",
  "folder",
  "media",
  "object",
  "result",
  "uploadedFile",
] as const;

export function normalizeMediaPayload(payload: unknown): NormalizedMedia[] {
  return collectMediaRecords(payload)
    .map((value) => normalizeMediaRecord(value))
    .filter((value): value is NormalizedMedia => Boolean(value));
}

export function normalizeSingleMedia(
  payload: unknown,
  fallback: NormalizeFallback = {},
): NormalizedMedia | null {
  const direct = normalizeMediaRecord(payload, fallback);
  if (direct) return direct;

  for (const value of collectMediaRecords(payload)) {
    const normalized = normalizeMediaRecord(value, fallback);
    if (normalized) return normalized;
  }
  return null;
}

function normalizeMediaRecord(
  value: unknown,
  fallback: NormalizeFallback = {},
): NormalizedMedia | null {
  const record = asRecord(value);
  if (!record) return null;

  const ghlId = readString(record, [...MEDIA_ID_KEYS]);
  if (!ghlId) return null;

  const name =
    readString(record, ["name", "fileName", "title", "originalname", "originalName"]) ||
    fallback.name ||
    "Untitled";
  const url = readString(record, ["url", "fileUrl", "mediaUrl", "secureUrl", "publicUrl"]);
  const thumbnailUrl = readString(record, ["thumbnailUrl", "thumbnail", "previewUrl"]);
  const mimeType = readString(record, ["mimeType", "mimetype", "contentType"]);
  const explicitType = readString(record, [
    "mediaType",
    "objectType",
    "resourceType",
    "entityType",
    "type",
  ]);
  const parentGhlId =
    readString(record, [...MEDIA_PARENT_KEYS]) ??
    fallback.parentGhlId ??
    null;

  return {
    ghlId,
    name,
    type: inferType(record, explicitType, fallback.type),
    url,
    thumbnailUrl,
    mimeType: mimeType || explicitType,
    size: readNumber(record, ["size", "fileSize", "bytes"]),
    parentGhlId: parentGhlId === ghlId ? null : parentGhlId,
    createdAt: readDate(record, ["createdAt", "dateAdded"]),
    updatedAt: readDate(record, ["updatedAt", "modifiedAt"]),
    raw: record,
  };
}

function inferType(
  record: Record<string, unknown>,
  explicitType?: string,
  fallback?: MediaObjectType,
): MediaObjectType {
  const lowerType = explicitType?.toLowerCase() ?? "";
  if (lowerType.includes("folder")) return "FOLDER";
  if (lowerType.includes("file") || lowerType.includes("image") || lowerType.includes("video")) {
    return "FILE";
  }
  if (record.folder === true || record.isFolder === true) return "FOLDER";
  return fallback ?? "FILE";
}

function collectMediaRecords(
  value: unknown,
  depth = 0,
  seen: Set<unknown> = new Set(),
): Record<string, unknown>[] {
  if (depth > 8 || value === null || value === undefined) return [];
  if (typeof value !== "object") return [];
  if (seen.has(value)) return [];
  seen.add(value);

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectMediaRecords(item, depth + 1, seen));
  }

  const record = asRecord(value);
  if (!record) return [];
  if (readString(record, [...MEDIA_ID_KEYS])) return [record];

  const preferred = new Set<string>(PREFERRED_NESTED_KEYS);
  const records: Record<string, unknown>[] = [];

  for (const key of PREFERRED_NESTED_KEYS) {
    if (key in record) {
      records.push(...collectMediaRecords(record[key], depth + 1, seen));
    }
  }

  for (const [key, nested] of Object.entries(record)) {
    if (!preferred.has(key)) {
      records.push(...collectMediaRecords(nested, depth + 1, seen));
    }
  }

  return records;
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

export function readString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value) return value;
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

function readNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const number = Number(value);
      if (!Number.isNaN(number)) return number;
    }
  }
  return undefined;
}

function readDate(record: Record<string, unknown>, keys: string[]) {
  const value = readString(record, keys);
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
