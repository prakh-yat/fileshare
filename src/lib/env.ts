export function getEnv(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback;

  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getPublicAppUrl(origin?: string | null) {
  return process.env.NEXT_PUBLIC_APP_URL || origin || "http://localhost:3000";
}
