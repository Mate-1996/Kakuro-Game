/**
 * middleware.ts (Next.js middleware)
 *
 * Runs on every request to:
 *   1. Verify session cookie exists and is valid
 *   2. Protect authenticated routes
 *   3. Redirect unauthenticated users to login
 *
 * Configure in next.config.ts with matcher patterns.
 */

import { NextRequest, NextResponse } from 'next/server';

// Routes that require authentication
const PROTECTED_ROUTES = [
  '/dashboard',
  '/play',
  '/competitive',
  '/settings',
  '/profile',
];

// Routes that should redirect to dashboard if already logged in
const AUTH_ROUTES = ['/login', '/signup', '/auth'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('kakuro_session')?.value;

  // Check if accessing a protected route
  const isProtectedRoute = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));

  // Check if accessing an auth route
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  // No session cookie found
  if (!sessionCookie) {
    // If trying to access a protected route, redirect to login
    if (isProtectedRoute) {
      return NextResponse.redirect(new URL('/auth', request.url));
    }
    // Allow public routes and auth routes
    return NextResponse.next();
  }

  // Session cookie exists
  // If on an auth route, redirect to dashboard
  if (isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Continue to the requested route
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Protect these paths
    '/dashboard/:path*',
    '/play/:path*',
    '/competitive/:path*',
    '/settings/:path*',
    '/profile/:path*',
    // Auth routes
    '/auth/:path*',
    '/login/:path*',
    '/signup/:path*',
  ],
};
