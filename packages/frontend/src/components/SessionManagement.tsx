'use client';

import React, { useState, useEffect } from 'react';
import { Monitor, Trash2 } from 'lucide-react';
import { useTranslation } from './TranslationProvider';

/**
 * Callers: []
 * Callees: [useTranslation, useState, useEffect, fetchSessions, fetch, json, setSessions, setError, setLoading, confirm, filter, setMessage, map, toLocaleDateString, toLocaleString, handleRevoke]
 * Description: Handles the session management logic for the application.
 * Keywords: sessionmanagement, session, management, auto-annotated
 */
export function SessionManagement() {
  const dict = useTranslation();
  const [sessions, setSessions] = useState<{ id: string; userAgent: string; ipAddress: string; expiresAt: string; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchSessions();
  }, []);

  /**
     * Callers: []
     * Callees: [fetch, json, setSessions, setError, setLoading]
     * Description: Handles the fetch sessions logic for the application.
     * Keywords: fetchsessions, fetch, sessions, auto-annotated
     */
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
      setError(dict.settings.failedFetchSessions);
    } finally {
      setLoading(false);
    }
  };

  /**
     * Callers: []
     * Callees: [confirm, fetch, setSessions, filter, setMessage, setError]
     * Description: Handles the handle revoke logic for the application.
     * Keywords: handlerevoke, handle, revoke, auto-annotated
     */
    const handleRevoke = async (id: string) => {
    if (!confirm(dict.settings.confirmRevokeSession)) return;
    
    try {
      const res = await fetch(`/api/v1/user/sessions/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        setSessions(sessions.filter(s => s.id !== id));
        setMessage(dict.settings.sessionRevoked);
      } else {
        throw new Error(dict.settings.failedRevokeSession);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (loading) return <div className="text-sm text-muted">{dict.settings.loadingSessions}</div>;

  return (
    <div className="rounded-xl bg-card p-6 shadow-sm border border-border/50">
      <h2 className="text-xl font-bold text-foreground mb-1">{dict.profile.activeSessions}</h2>
      <p className="text-sm text-muted mb-6">{dict.settings.manageSessions}</p>

      {message && <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-600 dark:bg-green-900/30 dark:text-green-400">{message}</div>}
      {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">{error}</div>}

      <div className="space-y-4">
        {sessions.length === 0 ? (
          <p className="text-sm text-muted italic">{dict.settings.noActiveSessions}</p>
        ) : (
          sessions.map(session => (
            <div key={session.id} className="rounded-lg border border-border bg-background p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Monitor className="h-8 w-8 text-primary" />
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {session.userAgent || dict.settings.unknownDevice}
                  </div>
                  <div className="text-xs text-muted mt-1">
                    IP: {session.ipAddress || dict.settings.unknownIp} • {dict.settings.expires}: {new Date(session.expiresAt).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-muted">
                    {dict.settings.started}: {new Date(session.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => handleRevoke(session.id)}
                className="p-2 text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                title={dict.settings.signOutDevice}
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
