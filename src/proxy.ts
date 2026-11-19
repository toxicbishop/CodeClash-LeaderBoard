import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
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

  // IMPORTANT: Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  function redirectTo(pathname: string) {
    const response = NextResponse.redirect(new URL(pathname, request.url));
    for (const cookie of supabaseResponse.cookies.getAll()) {
      response.cookies.set(cookie);
    }
    return response;
  }

  if (!user && (path.startsWith('/admin') || path.startsWith('/lab-admin'))) {
    return redirectTo('/');
  }

  if (path === '/' && user && (request.method === 'GET' || request.method === 'HEAD')) {
    const { data: profile } = await supabase.from('users')
      .select('role')
      .eq('user_id', user.id)
      .eq('account_status', 'ACTIVE')
      .maybeSingle();
    if (profile?.role === 'COMPETITION_ADMIN') {
      return redirectTo('/admin');
    }
    if (profile?.role === 'LAB_ADMIN') {
      return redirectTo('/lab-admin');
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
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|robots\\.txt$|sitemap\\.xml$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
