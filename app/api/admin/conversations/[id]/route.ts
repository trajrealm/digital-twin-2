import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminSession } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    if (!verifyAdminSession(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const conversationId = parseInt(id, 10);

    // Fetch conversation with messages and escalation
    const { data: conversation } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    const { data: escalation } = await supabase
      .from('escalations')
      .select('*')
      .eq('conversation_id', conversationId)
      .single();

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    console.log('Conversation:', conversation);
    console.log('Escalation:', escalation);
    console.log('Messages:', messages);

    return NextResponse.json({
      conversation: {
        ...conversation,
        messages: messages || [],
        escalation_id: escalation?.id || null,
        escalation_status: escalation?.status || 'none',
      },
    });
  } catch (error) {
    console.error('Fetch conversation error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversation' },
      { status: 500 }
    );
  }
}
