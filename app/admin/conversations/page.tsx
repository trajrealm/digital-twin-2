'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface EscalatedConversation {
  id: number;
  conversation_id: number;
  status: string;
  conversation: {
    visitor_email: string;
    embed_origin: string;
    started_at: string;
  };
}

export default function AdminConversations() {
  const [escalations, setEscalations] = useState<EscalatedConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    const fetchEscalations = async () => {
      try {
        const response = await fetch('/api/admin/escalations');
        if (response.status === 401) {
          router.push('/admin/login');
          return;
        }
        if (!response.ok) throw new Error('Failed to fetch escalations');

        const data = await response.json();
        setEscalations(data.escalations || []);
      } catch (err) {
        setError('Failed to load escalations');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchEscalations();
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Escalations</h1>
          <button
            onClick={() => router.push('/api/admin/logout')}
            className="px-4 py-2 text-gray-600 hover:text-gray-900"
          >
            Logout
          </button>
        </div>

        {loading && <p className="text-gray-600">Loading escalations...</p>}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">
            {error}
          </div>
        )}

        {!loading && escalations.length === 0 && (
          <div className="p-8 bg-white rounded-lg border border-gray-200 text-center text-gray-600">
            No escalations at this time.
          </div>
        )}

        {!loading && escalations.length > 0 && (
          <div className="space-y-4">
            {escalations.map((esc) => (
              <Link key={esc.id} href={`/admin/conversations/${esc.conversation_id}`}>
                <div className="p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow transition">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">
                        {esc.conversation?.visitor_email || 'Anonymous'}
                      </p>
                      <p className="text-sm text-gray-600">
                        {esc.conversation?.embed_origin || 'Unknown origin'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {esc.conversation?.started_at
                          ? new Date(esc.conversation.started_at).toLocaleString()
                          : 'Unknown date'}
                      </p>
                    </div>
                    <div className="ml-4 text-right">
                      <span
                        className={`inline-block px-3 py-1 rounded text-sm font-medium ${esc.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                          }`}
                      >
                        {esc.status}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
