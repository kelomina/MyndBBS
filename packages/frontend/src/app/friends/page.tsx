'use client';
import React, { useEffect, useState } from 'react';
import { UserPlus, Check, X, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from '../../components/TranslationProvider';
import { useToast } from '../../components/ui/Toast';
import type { Friendship } from '../../types';

export default function FriendsPage() {
  const dict = useTranslation();
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [targetUsername, setTargetUsername] = useState('');
  const [myId, setMyId] = useState('');
  const { toast } = useToast();

      const loadFriends = async () => {
    try {
      const res = await fetch('/api/v1/friends', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setFriendships(data.friendships);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetch('/api/v1/user/profile', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setMyId(d.user.id))
      .catch(e => console.error(e));
    const id = setTimeout(() => {
      void loadFriends();
    }, 0);
    return () => clearTimeout(id);
  }, []);

      const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUsername.trim()) return;
    try {
      const uRes = await fetch(`/api/v1/messages/keys/${targetUsername}`, { credentials: 'include' });
      if (!uRes.ok) return toast(dict.messages?.userNotFound || 'User not found or has not initialized messaging.', 'error');
      const uData = await uRes.json();
      
      const reqRes = await fetch('/api/v1/friends/request', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'include',
        body: JSON.stringify({ addresseeId: uData.userId })
      });
      if (reqRes.ok) {
        setTargetUsername('');
        loadFriends();
        toast(dict.messages?.requestSent || 'Friend request sent!', 'success');
      } else {
        const err = await reqRes.json();
        toast(err.error || dict.messages?.failedToSendRequest || 'Failed to send request', 'error');
      }
    } catch { 
      toast(dict.messages?.errorSendingRequest || 'Error sending request', 'error'); 
    }
  };

      const handleRespond = async (id: string, accept: boolean) => {
    try {
      await fetch('/api/v1/friends/respond', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'include',
        body: JSON.stringify({ friendshipId: id, accept })
      });
      loadFriends();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/messages" className="p-2 rounded-full hover:bg-accent/50 text-muted transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <UserPlus className="h-6 w-6" /> {dict.messages?.manageFriends || "Manage Friends"}
        </h1>
      </div>
      
      <div className="bg-card border border-border rounded-xl p-6 mb-8 shadow-sm">
        <h2 className="font-semibold mb-4">{dict.messages?.addFriend || "Add a Friend"}</h2>
        <form onSubmit={handleAddFriend} className="flex gap-2">
          <input 
            type="text" 
            value={targetUsername} 
            onChange={e => setTargetUsername(e.target.value)} 
            placeholder={dict.messages?.enterUsernameToAdd || "Enter username to add"}
            className="border border-border bg-background rounded-lg px-4 py-2 flex-1 focus:ring-1 focus:ring-primary outline-none"
          />
          <button type="submit" disabled={!targetUsername.trim()} className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50">
            {dict.messages?.sendRequest || "Send Request"}
          </button>
        </form>
      </div>

      <div className="space-y-4">
        <h2 className="font-semibold text-lg">{dict.messages?.yourFriends || "Your Friends & Requests"}</h2>
        {friendships.length === 0 ? (
          <p className="text-muted-foreground text-sm">{dict.messages?.noFriendsYet || "No friends or pending requests yet."}</p>
        ) : (
          friendships.map(f => {
            const isRequester = f.requesterId === myId;
            const otherUser = isRequester ? f.addressee : f.requester;
            return (
              <div key={f.id} className="p-4 border border-border bg-card rounded-xl flex items-center justify-between shadow-sm">
                <div>
                  <span className="font-bold">{otherUser.username}</span>
                  <span className={`text-xs ml-2 px-2 py-0.5 rounded-full ${
                    f.status === 'ACCEPTED' ? 'bg-green-100 text-green-700' :
                    f.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {f.status === 'PENDING' ? (dict.messages?.pending || 'Pending') : f.status === 'ACCEPTED' ? (dict.messages?.accepted || 'Accepted') : (dict.messages?.rejected || 'Rejected')}
                  </span>
                </div>
                <div className="flex gap-2 items-center">
                  {!isRequester && f.status === 'PENDING' && (
                    <div className="flex gap-1 mr-4">
                      <button onClick={() => handleRespond(f.id, true)} className="flex items-center gap-1 px-3 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded-md text-sm font-medium transition-colors">
                        <Check className="w-4 h-4"/> {dict.messages?.accept || "Accept"}
                      </button>
                      <button onClick={() => handleRespond(f.id, false)} className="flex items-center gap-1 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-md text-sm font-medium transition-colors">
                        <X className="w-4 h-4"/> {dict.messages?.reject || "Reject"}
                      </button>
                    </div>
                  )}
                  {f.status === 'ACCEPTED' && (
                    <Link href={`/messages/${otherUser.username}`} className="text-sm font-medium text-primary hover:underline px-3 py-1 bg-primary/10 rounded-md">
                      {dict.messages?.chat || "Chat"}
                    </Link>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
