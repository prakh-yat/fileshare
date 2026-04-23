import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const PREFIX = "v1";

function encryptionKey() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;

  if (!raw) {
    throw new Error("TOKEN_ENCRYPTION_KEY is required to store GHL OAuth tokens.");
  }

  const candidates = [
    Buffer.from(raw, "base64"),
    Buffer.from(raw, "hex"),
    Buffer.from(raw, "utf8"),
  ];
  const key = candidates.find((candidate) => candidate.length === 32);

  if (!key) {
    throw new Error("TOKEN_ENCRYPTION_KEY must resolve to exactly 32 bytes.");
  }

  return key;
}

export function encryptSecret(value: string | null | undefined) {
  if (!value) return null;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptSecret(value: string | null | undefined) {
  if (!value) return null;

  const [version, ivRaw, tagRaw, encryptedRaw] = value.split(":");

  if (version !== PREFIX || !ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error("Unsupported encrypted secret format.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivRaw, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
