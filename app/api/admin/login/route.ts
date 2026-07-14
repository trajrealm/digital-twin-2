import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { setAdminSession, generateSessionToken } from '../../../../lib/auth';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { error: 'Password required' },
        { status: 400 }
      );
    }

    const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
    if (!ADMIN_PASSWORD_HASH) {
      return NextResponse.json(
        { error: 'Admin password not configured' },
        { status: 500 }
      );
    }

    // Simple password check: hash input and compare with env hash
    const hashedPassword = crypto
      .createHash('sha256')
      .update(password)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(hashedPassword),
      Buffer.from(ADMIN_PASSWORD_HASH)
    );

    if (!isValid) {
      // Add small delay to discourage brute force
      await new Promise((resolve) => setTimeout(resolve, 500));
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    // Generate session token
    const sessionToken = generateSessionToken();

    // Create response and set session cookie
    const response = NextResponse.json({ status: 'authenticated' });
    return setAdminSession(response, sessionToken);
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
