import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { supabaseCookieOptions } from "@/lib/supabase/cookies";

const PUBLIC_PATHS = new Set(["/login", "/auth/confirm"]);
const PUBLIC_PREFIXES = ["/auth/", "/api/auth/", "/api/oauth/", "/_next/", "/favicon"];

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  const cookiesToCopy: Array<{
    name: string;
    value: string;
    options?: Record<string, unknown>;
  }> = [];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  let user: { id: string } | null = null;

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookieOptions: supabaseCookieOptions,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
            cookiesToCopy.push({ name, value, options });
          });
        },
      },
    });

    const { data } = await supabase.auth.getUser();
    user = data.user ? { id: data.user.id } : null;
  } catch {
    user = null;
  }

  const { pathname } = request.nextUrl;

  const transferCookies = (target: NextResponse) => {
    cookiesToCopy.forEach(({ name, value, options }) => {
      target.cookies.set(name, value, options);
    });
    return target;
  };

  if (pathname === "/") {
    return transferCookies(
      NextResponse.redirect(new URL(user ? "/dashboard" : "/login", request.url)),
    );
  }

  if (pathname === "/login" && user) {
    return transferCookies(NextResponse.redirect(new URL("/dashboard", request.url)));
  }

  if (!user && requiresAuth(pathname)) {
    return transferCookies(NextResponse.redirect(new URL("/login", request.url)));
  }

  return response;
}

function requiresAuth(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return false;
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return false;
  if (pathname.startsWith("/dashboard")) return true;
  return false;
}

export const config = {
  matcher: ["/", "/login", "/dashboard/:path*"],
};
