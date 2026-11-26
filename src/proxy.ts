import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const BLOCKED_MEDIA_REGEX =
  /\.(png|jpg|jpeg|gif|webp|svg|avif|bmp|tiff|mp4|webm|mov|avi|mkv|m4v)$/i;

/**
 * Peeks at the JWT `exp` claim inside Supabase auth cookies (without network I/O)
 * purely to skip redundant `getUser()` refreshes when the access token is still fresh.
 * Authoritative verification still runs in server-side guards (`requireSuperAdmin`, etc.).
 */
function hasFreshAccessToken(request: NextRequest): boolean {
  try {
    const authCookies = request.cookies
      .getAll()
      .filter((c) => c.name.includes('-auth-token'))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (authCookies.length === 0) return false;

    const rawCombined = authCookies.map((c) => c.value).join('');
    const decoded = rawCombined.startsWith('base64-')
      ? Buffer.from(rawCombined.slice(7), 'base64url').toString('utf8')
      : decodeURIComponent(rawCombined);

    const parsed = JSON.parse(decoded) as { access_token?: string } | [string, ...unknown[]];
    const accessToken = Array.isArray(parsed)
      ? (typeof parsed[0] === 'string' ? parsed[0] : undefined)
      : parsed?.access_token;

    if (!accessToken) return false;
    const parts = accessToken.split('.');
    if (parts.length !== 3) return false;

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
      exp?: number;
    };
    if (typeof payload.exp !== 'number') return false;

    const nowSec = Math.floor(Date.now() / 1000);
    return payload.exp - nowSec > 120;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (BLOCKED_MEDIA_REGEX.test(path)) {
    return NextResponse.rewrite(new URL('/forbidden', request.url), { status: 403 });
  }

  const isProtectedPath =
    path.startsWith('/admin') || path.startsWith('/upload') || path.startsWith('/lab-admin');
  const isHomePath = path === '/';

  // Public routes (/leaderboard, /competitions/*, /login, static info pages) never need Supabase auth in proxy
  if (!isProtectedPath && !isHomePath) {
    return NextResponse.next({ request });
  }

  const hasAuthToken = request.cookies.getAll().some((c) => c.name.includes('-auth-token'));

  if (!hasAuthToken) {
    if (isProtectedPath) {
      return NextResponse.rewrite(new URL('/unauthorized', request.url), { status: 401 });
    }
    return NextResponse.next({ request });
  }

  // Fast-path: when access token is still fresh, skip duplicate proxy getUser() round-trip;
  // Server Components (`guards.ts` and `app/page.tsx`) perform authoritative verification.
  if (hasFreshAccessToken(request)) {
    return NextResponse.next({ request });
  }

  // Token missing/expiring: refresh session cookies with Supabase
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtectedPath) {
    const response = NextResponse.rewrite(new URL('/unauthorized', request.url), { status: 401 });
    for (const cookie of supabaseResponse.cookies.getAll()) {
      response.cookies.set(cookie);
    }
    return response;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots\\.txt$|sitemap\\.xml$).*)',
  ],
};
