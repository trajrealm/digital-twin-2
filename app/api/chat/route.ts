import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { QdrantClient } from '@qdrant/js-client-rest';
import { createClient } from '@supabase/supabase-js';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { readFileSync } from 'fs';
import { join } from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ChatRequest {
  sessionId: string;
  conversationId?: string;
  message: string;
  embedOrigin?: string;
}

interface ChatResponse {
  conversationId: string;
  answer: string;
  confident: boolean;
}

export async function POST(request: NextRequest): Promise<NextResponse<ChatResponse | { error: string }>> {
  try {
    const body: ChatRequest = await request.json();
    const { sessionId, conversationId, message, embedOrigin } = body;
    const visitorIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

    if (!sessionId || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check rate limit
    const rateLimitResult = await checkChatRateLimit(sessionId);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before sending another message.' },
        { status: 429 }
      );
    }

    // Validate message length
    if (message.length > 2000) {
      return NextResponse.json(
        { error: 'Message too long (max 2000 characters)' },
        { status: 400 }
      );
    }

    // Look up or create conversation for this session
    let conversation = null;
    if (conversationId) {
      const { data } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();
      conversation = data;
    }

    if (!conversation) {
      const { data } = await supabase
        .from('conversations')
        .insert({
          session_id: sessionId,
          embed_origin: embedOrigin,
          visitor_ip: visitorIp,
        })
        .select()
        .single();
      conversation = data;
    }

    if (!conversation) {
      throw new Error('Failed to create or retrieve conversation');
    }

    // Embed the user message
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: message,
    });

    const embedding = embeddingResponse.data[0].embedding;

    // Search Qdrant for relevant chunks - increased limit to capture more context
    const searchResults = await qdrant.search('knowledge_chunks', {
      vector: embedding,
      limit: 10,
      with_payload: true,
      with_vector: false,
    }) as any[];

    // Build context from retrieved chunks
    const context = searchResults
      .map((result) => {
        const payload = result.payload || result;
        const text = payload?.text || payload?.['text'] || '';
        return text;
      })
      .filter(Boolean)
      .join('\n\n');

    // Retrieve recent conversation history (this conversation only - NO prior context)
    const { data: recentMessages } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
      .limit(10);

    // Build message history for this conversation
    const conversationHistory = recentMessages?.map((msg) => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
    })) || [];

    // Load and process system prompt from markdown file
    let systemPromptTemplate: string;
    
    try {
      // Try to load from Supabase storage first
      const { data, error } = await supabase
        .storage
        .from('digital-twin')
        .download('instructions.md');
      
      if (error) throw error;
      
      systemPromptTemplate = await data.text();
    } catch {
      // Fall back to local file
      const promptPath = join(process.cwd(), 'content', 'instructions.md');
      systemPromptTemplate = readFileSync(promptPath, 'utf-8');
    }
    
    // Replace template variables with environment variables
    const systemPrompt = systemPromptTemplate
      .replace(/{{AUTHOR_FIRST_NAME}}/g, process.env.NEXT_PUBLIC_AUTHOR_FIRST_NAME || 'Author')
      .replace(/{{AUTHOR_LAST_NAME}}/g, process.env.NEXT_PUBLIC_AUTHOR_LAST_NAME || '');

    // Call OpenAI with structured output
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...conversationHistory,
        {
          role: 'user',
          content: `Context:\n${context}\n\nQuestion: ${message}`,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'ChatResponse',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              answer: {
                type: 'string',
                description: 'The answer to the question, or explanation of why you cannot answer',
              },
              confident: {
                type: 'boolean',
                description: 'true only if answer is directly from context; false if fabricating, generalizing, or answering outside authors domain',
              },
            },
            required: ['answer', 'confident'],
            additionalProperties: false,
          },
        },
      },
    });

    const responseText = response.choices[0].message.content;
    if (!responseText) {
      throw new Error('Empty response from OpenAI');
    }

    const parsedResponse = JSON.parse(responseText);

    // Store visitor message
    await supabase.from('messages').insert({
      conversation_id: conversation.id,
      role: 'visitor',
      content: message,
    });

    // Store assistant message
    await supabase.from('messages').insert({
      conversation_id: conversation.id,
      role: 'assistant',
      content: parsedResponse.answer,
    });

    return NextResponse.json({
      conversationId: conversation.id,
      answer: parsedResponse.answer,
      confident: parsedResponse.confident,
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
