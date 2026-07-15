'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  role: 'visitor' | 'assistant' | 'author_live';
  content: string;
}

export default function EmbedWidget() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [conversationId, setConversationId] = useState<string>('');
  const [showEscalation, setShowEscalation] = useState(false);
  const [visitorEmail, setVisitorEmail] = useState('');
  const [escalating, setEscalating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabaseRef = useRef<any>(null);
  const presenceRef = useRef<any>(null);

  // Runs once on mount: generate session ID, notify parent, set up resize observer
  useEffect(() => {
    const newSessionId = Math.random().toString(36).substring(2, 15);
    setSessionId(newSessionId);

    if (window.parent !== window) {
      window.parent.postMessage({ type: 'widget-ready' }, '*');
    }

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current && window.parent !== window) {
        const height = containerRef.current.scrollHeight;
        window.parent.postMessage({ type: 'resize', height }, '*');
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Separate effect: re-attach beforeunload listener whenever conversationId/sessionId change
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (conversationId && sessionId) {
        // Unsubscribe from Presence
        if (presenceRef.current) {
          await presenceRef.current.unsubscribe();
        }

        await fetch('/api/conversations/close', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId }),
        }).catch(() => {
          // Ignore errors on page unload
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [conversationId, sessionId]);

  // Realtime subscription effect: subscribe when conversationId is set
  useEffect(() => {
    if (!conversationId) return;

    const setupRealtimeSubscription = async () => {
      try {
        // Initialize Supabase client
        if (!supabaseRef.current) {
          supabaseRef.current = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
          );
        }

        const supabase = supabaseRef.current;
        console.log('Setting up Realtime subscription for conversation:', conversationId);

        // Set up presence for this conversation
        const presence = supabase.channel(`conversation:${conversationId}`, {
          config: {
            presence: {
              key: sessionId,
            },
          },
        });

        // Track presence when user joins
        presence.on('presence', { event: 'sync' }, () => {
          // Presence sync - could log if needed
        });

        // Listen for real-time message inserts (author replies) on SAME channel
        presence.on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload: any) => {
            const newMessage = payload.new;
            console.log('New message received:', newMessage);
            // Only show author replies that weren't sent by this widget
            if (newMessage.role === 'author_live') {
              console.log('Author reply detected, adding to messages');
              setMessages((prev) => [
                ...prev,
                {
                  role: 'author_live',
                  content: newMessage.content,
                },
              ]);
            }
          }
        );

        // Subscribe to the channel (this enables both presence AND postgres_changes)
        presence.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Subscribed to conversation channel');
            // Notify presence (visitor is viewing)
            presence.track({
              visitor_id: sessionId,
              conversation_id: conversationId,
              timestamp: new Date().toISOString(),
            });
          }
        });

        presenceRef.current = presence;
      } catch (error) {
        console.error('Realtime subscription error:', error);
      }
    };

    setupRealtimeSubscription();

    return () => {
      // Unsubscribe on unmount or conversationId change
      if (presenceRef.current) {
        presenceRef.current.unsubscribe();
      }
    };
  }, [conversationId, sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    // Auto-focus input after messages are added (unless escalation is showing)
    if (!showEscalation && inputRef.current) {
      inputRef.current.focus();
    }
  }, [messages, showEscalation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !sessionId) return;

    const userMessage: Message = { role: 'visitor', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          conversationId: conversationId || undefined,
          message: input,
          embedOrigin: document.referrer || window.location.origin,
        }),
      });

      if (!response.ok) throw new Error('Failed to get response');

      const data = await response.json();
      setConversationId(data.conversationId);

      const assistantMessage: Message = { role: 'assistant', content: data.answer };
      setMessages((prev) => [...prev, assistantMessage]);

      if (!data.confident) {
        setShowEscalation(true);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleEscalate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitorEmail.trim() || !conversationId) return;

    setEscalating(true);
    try {
      const response = await fetch('/api/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          visitorEmail: visitorEmail.trim(),
          sessionId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || 'Failed to escalate');
        return;
      }

      setShowEscalation(false);
      setVisitorEmail('');
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Thank you! Your question has been escalated to the author. You will receive a reply at the email you provided.',
        },
      ]);
    } catch (error) {
      alert('Something went wrong. Please try again.');
    } finally {
      setEscalating(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-screen w-full bg-white text-gray-900"
    >
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-sm">Hello! Ask me anything about the author.</p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'visitor' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs px-3 py-2 rounded-lg ${
                msg.role === 'visitor'
                  ? 'bg-blue-500 text-white'
                  : msg.role === 'author_live'
                  ? 'bg-green-100 text-gray-900 border border-green-300'
                  : 'bg-gray-200 text-gray-900'
              }`}
            >
              <div className="text-sm prose prose-sm max-w-none dark:prose-invert
                prose-p:m-0 prose-p:leading-relaxed
                prose-strong:font-semibold
                prose-em:italic
                prose-ul:my-1 prose-ul:pl-4
                prose-li:my-0
                prose-code:bg-gray-300 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
                prose-pre:bg-gray-800 prose-pre:text-white prose-pre:p-2 prose-pre:rounded prose-pre:overflow-x-auto prose-pre:text-xs
                break-words
              ">
                {msg.role === 'visitor' ? (
                  // Visitor messages: plain text
                  msg.content
                ) : (
                  // Assistant and author_live: render markdown
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-200 px-3 py-2 rounded-lg">
              <p className="text-sm text-gray-600">Thinking...</p>
            </div>
          </div>
        )}
        {showEscalation && (
          <div className="flex justify-start">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 max-w-xs">
              <div className="flex justify-between items-start mb-2">
                <p className="text-sm font-semibold text-gray-900">Escalate to Author</p>
                <button
                  type="button"
                  onClick={() => {
                    setShowEscalation(false);
                    setVisitorEmail('');
                  }}
                  className="text-gray-500 hover:text-gray-700 text-lg leading-none"
                  title="Close escalation"
                >
                  ×
                </button>
              </div>
              <p className="text-sm text-gray-900 mb-3">
                I couldn't confidently answer this. Provide your email and I'll have the author reply.
              </p>
              <form onSubmit={handleEscalate} className="space-y-2">
                <input
                  type="email"
                  value={visitorEmail}
                  onChange={(e) => setVisitorEmail(e.target.value)}
                  placeholder="Your email"
                  required
                  disabled={escalating}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={escalating || !visitorEmail.trim()}
                    className="flex-1 px-2 py-1 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {escalating ? 'Sending...' : 'Escalate'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEscalation(false);
                      setVisitorEmail('');
                    }}
                    disabled={escalating}
                    className="flex-1 px-2 py-1 bg-gray-300 text-gray-900 rounded text-sm font-medium hover:bg-gray-400 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-gray-200 p-3 bg-white">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            disabled={loading || showEscalation}
            maxLength={500}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading || !input.trim() || showEscalation}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-600"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
