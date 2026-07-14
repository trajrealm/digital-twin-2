import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminSession } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    if (!verifyAdminSession(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch all escalations with related conversation info
    const { data: escalations, error } = await supabase
      .from('escalations')
      .select(`
        id,
        conversation_id,
        status,
        notified_at,
        answered_at,
        conversation:conversations (
          id,
          visitor_email,
          embed_origin,
          started_at
        )
      `)
      .order('notified_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      escalations: escalations || [],
    });
  } catch (error) {
    console.error('Fetch escalations error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch escalations' },
      { status: 500 }
    );
  }
}
