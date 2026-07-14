'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';

interface Message {
  id: number;
  role: 'visitor' | 'assistant' | 'author_live';
  content: string;
  created_at: string;
}

interface ConversationDetail {
  id: number;
  visitor_email: string;
  embed_origin: string;
  status: string;
  messages: Message[];
  escalation_id: number;
  escalation_status: string;
}

export default function AdminConversationDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [replySending, setReplySending] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    const fetchConversation = async () => {
      try {
        const response = await fetch(`/api/admin/conversations/${id}`);
        if (response.status === 401) {
          router.push('/admin/login');
          return;
        }
        if (!response.ok) throw new Error('Failed to fetch conversation');

        const data = await response.json();
        console.log('Received conversation data:', data);
        setConversation(data.conversation);
      } catch (err) {
        setError('Failed to load conversation');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchConversation();
  }, [id, router]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim() || !conversation) return;

    setReplySending(true);
    try {
      const response = await fetch('/api/admin/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversation.id,
          reply: reply.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to send reply');
        return;
      }

      // Refresh conversation to show new reply
      const refreshResponse = await fetch(`/api/admin/conversations/${id}`);
      const refreshData = await refreshResponse.json();
      setConversation(refreshData.conversation);
      setReply('');
      setError('');
    } catch (err) {
      setError('Something went wrong');
      console.error(err);
    } finally {
      setReplySending(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-gray-600">Loading conversation...</div>;
  }

  if (!conversation) {
    return (
      <div className="p-8 text-gray-600">
        Conversation not found.{' '}
        <button onClick={() => router.back()} className="text-blue-600 hover:underline">
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => router.back()}
          className="text-blue-600 hover:underline mb-6"
        >
          ← Back to escalations
        </button>

        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h1 className="text-2xl font-bold mb-4 text-gray-900">
            Conversation Details
          </h1>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Visitor Email</p>
              <p className="font-medium text-gray-900">{conversation.visitor_email || 'Not provided'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">From</p>
              <p className="font-medium text-gray-900">{conversation.embed_origin || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <p className="font-medium text-gray-900">{conversation.status}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Escalation Status</p>
              <span
                className={`inline-block px-2 py-1 rounded text-sm font-medium ${
                  conversation.escalation_status === 'pending'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-green-100 text-green-800'
                }`}
              >
                {conversation.escalation_status}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 text-gray-900">Messages</h2>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {conversation.messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-4 rounded-lg ${
                  msg.role === 'visitor'
                    ? 'bg-blue-50 border border-blue-200'
                    : msg.role === 'assistant'
                    ? 'bg-gray-50 border border-gray-200'
                    : 'bg-green-50 border border-green-200'
                }`}
              >
                <p className="text-sm font-semibold text-gray-700 mb-2 capitalize">
                  {msg.role === 'author_live' ? 'Author' : msg.role}
                </p>
                <p className="text-gray-900">{msg.content}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {new Date(msg.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>

        {conversation.escalation_status === 'pending' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Send Reply</h2>
            <form onSubmit={handleReply} className="space-y-4">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                disabled={replySending}
                placeholder="Type your reply here..."
                maxLength={2000}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={replySending || !reply.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {replySending ? 'Sending...' : 'Send Reply'}
              </button>
            </form>
          </div>
        )}

        {conversation.escalation_status === 'answered' && (
          <div className="p-4 bg-green-50 border border-green-200 rounded text-green-700">
            This escalation has been answered.
          </div>
        )}
      </div>
    </div>
  );
}
