import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // 1. Fast-path: check if any Supabase session cookies exist in this request
  const hasAuthToken = request.cookies.getAll().some((c) => c.name.includes('-auth-token'));

  // If there are no auth cookies at all:
  // - If attempting to access a protected area, redirect to / immediately without making any remote network calls.
  // - If accessing a public route, bypass Supabase entirely and return immediately (0ms network cost).
  if (!hasAuthToken) {
    if (path.startsWith('/admin') || path.startsWith('/upload') || path.startsWith('/lab-admin')) {
      return NextResponse.redirect(new URL('/', request.url));
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
    return redirectTo('/');
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
    '/((?!_next/static|_next/image|favicon.ico|robots\\.txt$|sitemap\\.xml$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
