import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/register',
  '/verify',
];

function isPublicPath(pathname: string): boolean {
  // Exact matches
  if (PUBLIC_PATHS.includes(pathname)) return true;
  // /book/:slug*
  if (pathname.startsWith('/book/')) return true;
  // /cita/:token (public appointment confirmation page)
  if (pathname.startsWith('/cita/')) return true;
  // /api/public/:path*
  if (pathname.startsWith('/api/public/')) return true;
  // Next.js assets
  if (pathname.startsWith('/_next/')) return true;
  if (pathname.startsWith('/favicon')) return true;
  return false;
}

function isProtectedApi(pathname: string): boolean {
  const protectedPrefixes = [
    '/api/services',
    '/api/business-hours',
    '/api/breaks',
    '/api/appointments',
  ];
  return protectedPrefixes.some((p) => pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let public paths through
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Check if it's a protected route (dashboard or protected API)
  const isDashboard = pathname.startsWith('/dashboard');
  const isProtected = isDashboard || isProtectedApi(pathname);

  if (!isProtected) {
    return NextResponse.next();
  }

  // Check for session
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: process.env.SUPABASE_DB_SCHEMA || 'public' },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options as Record<string, never>);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
