'use client';

import React, { useState, useEffect } from 'react';
import { Monitor, Trash2 } from 'lucide-react';

export function SessionManagement() {
  const [sessions, setSessions] = useState<{ id: string; userAgent: string; ipAddress: string; expiresAt: string; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/v1/user/sessions', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions);
      } else {
        throw new Error('Failed to fetch sessions');
      }
    } catch (err) {
      setError('Error loading sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Are you sure you want to sign out of this session?')) return;
    
    try {
      const res = await fetch(`/api/v1/user/sessions/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        setSessions(sessions.filter(s => s.id !== id));
        setMessage('Session revoked successfully');
      } else {
        throw new Error('Failed to revoke session');
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (loading) return <div className="text-sm text-muted">Loading sessions...</div>;

  return (
    <div className="rounded-xl bg-card p-6 shadow-sm border border-border/50">
      <h2 className="text-xl font-bold text-foreground mb-1">Active Sessions</h2>
      <p className="text-sm text-muted mb-6">Manage devices currently logged into your account.</p>

      {message && <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-600 dark:bg-green-900/30 dark:text-green-400">{message}</div>}
      {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">{error}</div>}

      <div className="space-y-4">
        {sessions.length === 0 ? (
          <p className="text-sm text-muted italic">No active sessions found.</p>
        ) : (
          sessions.map(session => (
            <div key={session.id} className="rounded-lg border border-border bg-background p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Monitor className="h-8 w-8 text-primary" />
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {session.userAgent || 'Unknown Device'}
                  </div>
                  <div className="text-xs text-muted mt-1">
                    IP: {session.ipAddress || 'Unknown'} • Expires: {new Date(session.expiresAt).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-muted">
                    Started: {new Date(session.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => handleRevoke(session.id)}
                className="p-2 text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                title="Sign out device"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
