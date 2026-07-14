import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { conversationId } = body;

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Missing conversationId' },
        { status: 400 }
      );
    }

    // Close conversation (no summarization - per Phase 2 spec, only record-keeping)
    const { error } = await supabase
      .from('conversations')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      status: 'closed',
      conversationId,
    });
  } catch (error) {
    console.error('Close conversation error:', error);
    return NextResponse.json(
      { error: 'Failed to close conversation' },
      { status: 500 }
    );
  }
}
