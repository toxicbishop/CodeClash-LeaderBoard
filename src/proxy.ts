import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const BLOCKED_MEDIA_REGEX =
  /\.(png|jpg|jpeg|gif|webp|svg|avif|bmp|tiff|mp4|webm|mov|avi|mkv|m4v)$/i;

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (BLOCKED_MEDIA_REGEX.test(path)) {
    return NextResponse.rewrite(new URL('/forbidden', request.url), { status: 403 });
  }

  // 1. Fast-path: check if any Supabase session cookies exist in this request
  const hasAuthToken = request.cookies.getAll().some((c) => c.name.includes('-auth-token'));

  // If there are no auth cookies at all, rewrite protected routes to 401 immediately
  // without making any remote network calls.
  if (!hasAuthToken) {
    if (path.startsWith('/admin') || path.startsWith('/upload') || path.startsWith('/lab-admin')) {
      return NextResponse.rewrite(new URL('/unauthorized', request.url), { status: 401 });
    }
    return NextResponse.next({ request });
  }

  // 2. Auth cookie is present — refresh session cookies with Supabase
  let supabaseResponse = NextResponse.next({
    request,
  });

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
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  function redirectTo(pathname: string) {
    const response = NextResponse.redirect(new URL(pathname, request.url));
    for (const cookie of supabaseResponse.cookies.getAll()) {
      response.cookies.set(cookie);
    }
    return response;
  }

  if (!user && (path.startsWith('/admin') || path.startsWith('/upload') || path.startsWith('/lab-admin'))) {
    const response = NextResponse.rewrite(new URL('/unauthorized', request.url), { status: 401 });
    for (const cookie of supabaseResponse.cookies.getAll()) {
      response.cookies.set(cookie);
    }
    return response;
  }

  // Fast redirect for logged-in users visiting /
  if (path === '/' && user && (request.method === 'GET' || request.method === 'HEAD')) {
    const { data: profile } = await supabase.from('users')
      .select('role')
      .eq('user_id', user.id)
      .eq('account_status', 'ACTIVE')
      .maybeSingle();

    if (profile?.role === 'SUPER_ADMIN') {
      return redirectTo('/admin');
    }
    if (profile?.role === 'MASTER_LAB_ADMIN') {
      return redirectTo('/upload');
    }
    if (profile?.role === 'HOD' || profile?.role === 'PRINCIPAL') {
      return redirectTo('/leaderboard');
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - robots.txt and sitemap.xml (public crawler metadata)
     */
    '/((?!_next/static|_next/image|favicon.ico|robots\\.txt$|sitemap\\.xml$).*)',
  ],
};
