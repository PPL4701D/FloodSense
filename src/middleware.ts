import { updateSession } from '@/lib/supabase/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import type { UserRole } from '@/types/database';

// Route protection matrix
const PROTECTED_ROUTES: Record<string, UserRole[]> = {
  '/staff': ['staf', 'tlm', 'admin'],
  '/dashboard': ['staf', 'tlm', 'admin'],
  '/admin': ['admin'],
  '/broadcast': ['tlm', 'admin'],
};

const AUTH_REQUIRED_ROUTES = ['/my-reports', '/settings', '/profile'];

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user, supabase } = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  // Auth pages — redirect to home if already logged in
  if (pathname.startsWith('/login') || pathname.startsWith('/register')) {
    if (user) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return supabaseResponse;
  }

  // Check if route requires authentication
  const needsAuth = AUTH_REQUIRED_ROUTES.some((r) => pathname.startsWith(r));
  if (needsAuth && !user) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Check role-based access
  for (const [route, allowedRoles] of Object.entries(PROTECTED_ROUTES)) {
    if (pathname.startsWith(route)) {
      if (!user) {
        const redirectUrl = new URL('/login', request.url);
        redirectUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(redirectUrl);
      }

      // Get user role from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!profile || !allowedRoles.includes(profile.role as UserRole)) {
        return NextResponse.redirect(new URL('/', request.url));
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
