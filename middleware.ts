import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Middleware is now deprecated - CSP headers are handled by next.config.js
  // This can be removed entirely in a future update
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
