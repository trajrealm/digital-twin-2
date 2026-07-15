import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

interface EscalateRequest {
  conversationId: string;
  visitorEmail: string;
  honeypot?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: EscalateRequest = await request.json();
    const { conversationId, visitorEmail, honeypot } = body;

    // Honeypot: silently fail if populated
    if (honeypot && honeypot.trim().length > 0) {
      return NextResponse.json(
        { status: 'pending', escalationId: 'hidden' },
        { status: 200 }
      );
    }

    if (!conversationId || !visitorEmail) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if conversation exists and get recent messages
    const { data: conversation } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Check for duplicate pending escalation on this conversation
    const { data: existingEscalation } = await supabase
      .from('escalations')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('status', 'pending')
      .single();

    if (existingEscalation) {
      return NextResponse.json(
        { error: 'Escalation already pending on this conversation' },
        { status: 400 }
      );
    }

    // Get recent messages for context
    const { data: messages } = await supabase
      .from('messages')
      .select('role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(10);

    // Update conversation with visitor email
    await supabase
      .from('conversations')
      .update({
        visitor_email: visitorEmail,
        status: 'escalated',
      })
      .eq('id', conversationId);

    // Create escalation record
    const { data: escalation, error: escalationError } = await supabase
      .from('escalations')
      .insert({
        conversation_id: conversationId,
        status: 'pending',
        notified_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (escalationError) {
      console.error('Escalation insert error:', escalationError);
      throw escalationError;
    }

    // Build email context
    const messageContext = messages
      ?.map((m) => `${m.role === 'visitor' ? 'Visitor' : 'Assistant'}: ${m.content}`)
      .join('\n\n') || 'No messages';

    const adminLink = `${process.env.SITE_URL}/admin/conversations/${conversationId}`;

    // Send email to author
    const emailResult = await resend.emails.send({
      from: process.env.NOTIFY_EMAIL!,
      to: process.env.NOTIFY_EMAIL!,
      subject: `New Escalation: Unanswered Question`,
      html: `
        <h2>New Escalated Question</h2>
        <p><strong>Visitor Email:</strong> ${escapeHtml(visitorEmail)}</p>
        <p><strong>From:</strong> ${escapeHtml(conversation.embed_origin || 'Unknown origin')}</p>
        <hr />
        <h3>Conversation History:</h3>
        <pre>${escapeHtml(messageContext)}</pre>
        <hr />
        <p><a href="${adminLink}">View & Reply in Admin Panel</a></p>
      `,
    });

    console.log('Escalation email result:', { emailResult, notifyEmail: process.env.NOTIFY_EMAIL });

    return NextResponse.json(
      {
        status: 'pending',
        escalationId: escalation?.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Escalate error:', error);
    return NextResponse.json(
      { error: 'Failed to escalate question' },
      { status: 500 }
    );
  }
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
