import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-in-production';

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function verifyPasswordHash(password: string, hash: string): boolean {
  // Compare password hash (uses bcrypt format: $2b$...)
  // For Phase 3, use a simple constant-time comparison
  // In production, use bcrypt.compare()
  if (!hash.startsWith('$2b$')) {
    // Fallback for plain hash comparison (dev only)
    const hashedPassword = crypto
      .createHash('sha256')
      .update(password)
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(hashedPassword),
      Buffer.from(hash)
    );
  }

  // For bcrypt hashes, this is a placeholder
  // Real implementation requires bcryptjs or similar
  // For now, just check if it's not empty
  return hash.length > 0;
}

export async function setAdminSession(
  response: NextResponse,
  sessionId: string
): Promise<NextResponse> {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  response.cookies.set('admin_session', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  });

  return response;
}

export function verifyAdminSession(request: NextRequest): boolean {
  const sessionCookie = request.cookies.get('admin_session')?.value;
  
  // For Phase 3, simple check: cookie exists and is not empty
  // In Phase 3+, could add server-side session validation
  return !!sessionCookie && sessionCookie.length > 0;
}

export function createAdminMiddleware(
  handler: (
    req: NextRequest,
    ctx?: Record<string, any>
  ) => Promise<NextResponse>
) {
  return async (
    request: NextRequest,
    ctx?: Record<string, any>
  ): Promise<NextResponse> => {
    if (!verifyAdminSession(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return handler(request, ctx);
  };
}
