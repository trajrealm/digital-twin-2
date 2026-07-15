import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Only apply to /embed route
  if (request.nextUrl.pathname === '/embed') {
    const response = NextResponse.next();

    // Get allowed origins from env, default to allow all if not set
    const allowedOriginsStr = process.env.ALLOWED_EMBED_ORIGINS || '';
    const allowedOrigins = allowedOriginsStr
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o.length > 0);

    // Build frame-ancestors CSP directive
    let frameAncestors = "'self'"; // Always allow same-origin
    if (allowedOrigins.length > 0) {
      frameAncestors += ' ' + allowedOrigins.join(' ');
    } else if (!allowedOriginsStr) {
      // If ALLOWED_EMBED_ORIGINS is empty/unset, allow any origin (explicitly permissive)
      frameAncestors = '*';
    }

    // Set CSP header with frame-ancestors
    response.headers.set(
      'Content-Security-Policy',
      `frame-ancestors ${frameAncestors};`
    );

    // Also set X-Frame-Options for older browsers (legacy support)
    if (frameAncestors === '*') {
      response.headers.set('X-Frame-Options', 'ALLOWALL');
    } else if (allowedOrigins.length > 0) {
      // X-Frame-Options doesn't support multiple origins, so we only use frame-ancestors
      // For backward compatibility with older browsers, browsers that don't support CSP will simply not have framing restrictions
      response.headers.set('X-Frame-Options', 'SAMEORIGIN');
    }

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/embed'],
};
