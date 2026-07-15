import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminSession } from '@/lib/auth';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

interface ReplyRequest {
  conversationId: number;
  reply: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    if (!verifyAdminSession(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: ReplyRequest = await request.json();
    const { conversationId, reply } = body;

    if (!conversationId || !reply) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (reply.length > 2000) {
      return NextResponse.json(
        { error: 'Reply too long (max 2000 characters)' },
        { status: 400 }
      );
    }

    // Get conversation for visitor email
    const { data: conversation } = await supabase
      .from('conversations')
      .select('visitor_email, embed_origin')
      .eq('id', conversationId)
      .single();

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Store author's reply in messages table
    const { data: insertedMessage, error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role: 'author_live',
        content: reply,
      })
      .select()
      .single();

    console.log('Message insert result:', { insertedMessage, messageError });

    if (messageError) {
      console.error('Message insert error:', messageError);
      throw messageError;
    }

    // Mark escalation as answered
    const { error: escalationError } = await supabase
      .from('escalations')
      .update({
        status: 'answered',
        answered_at: new Date().toISOString(),
      })
      .eq('conversation_id', conversationId);

    if (escalationError) throw escalationError;

// Check Presence: are any visitors currently viewing this conversation?
    const hasVisitors = await checkVisitorPresent(conversationId);
    let deliveryMethod = 'realtime'; // default if visitor present

    // If no visitors present and visitor email exists, send email
    if (!hasVisitors && conversation.visitor_email) {
      deliveryMethod = 'email';

      // Build conversation context for email
      const { data: messages } = await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(10);

      const messageContext = messages
        ?.map((m) => `${m.role === 'visitor' ? 'Visitor' : m.role === 'assistant' ? 'Assistant' : 'Author'}: ${m.content}`)
        .join('\n\n') || 'No messages';

      const widgetUrl = conversation.embed_origin || `${process.env.SITE_URL}/embed`;

      // Send email to visitor
      await resend.emails.send({
        from: process.env.NOTIFY_EMAIL!,
        to: conversation.visitor_email,
        subject: `Reply to Your Question`,
        html: `
          <h2>Reply to Your Question</h2>
          <p>The author has replied to your escalated question:</p>
          <hr />
          <h3>Recent Conversation:</h3>
          <pre>${escapeHtml(messageContext)}</pre>
          <hr />
          <p><a href="${escapeHtml(widgetUrl)}">View the widget again</a> to continue the conversation.</p>
        `,
      });
    }

    return NextResponse.json(
      { status: 'reply_saved', deliveredVia: deliveryMethod },
      { status: 201 }
    );
  } catch (error) {
    console.error('Reply error:', error);
    return NextResponse.json(
      { error: 'Failed to save reply' },
      { status: 500 }
    );
  }
}

async function checkVisitorPresent(conversationId: number): Promise<boolean> {
  return new Promise((resolve) => {
    const channel = supabase.channel(`conversation:${conversationId}`);
    let resolved = false;

    const finish = (present: boolean) => {
      if (resolved) return;
      resolved = true;
      supabase.removeChannel(channel);
      resolve(present);
    };

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        finish(Object.keys(state).length > 0);
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          setTimeout(() => {
            finish(Object.keys(channel.presenceState()).length > 0);
          }, 1500);
        }
      });
  });
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}
