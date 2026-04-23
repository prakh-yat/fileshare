export const supabaseCookieOptions = {
  name: "tda-fileshare-auth",
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};
