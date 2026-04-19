'use client';
import React, { useEffect, useState } from 'react';
import { UserPlus, Check, X, ArrowLeft, ChevronDown, ChevronRight, UserMinus, Ban } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from '../../components/TranslationProvider';
import { useToast } from '../../components/ui/Toast';
import type { Friendship } from '../../types';

export default function FriendsPage() {
  const dict = useTranslation();
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [targetUsername, setTargetUsername] = useState('');
  const [myId, setMyId] = useState('');
  const [showRequests, setShowRequests] = useState(false);
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

      /**
   * Callers: [onSubmit in Add Friend form]
   * Callees: [fetch, toast, loadFriends]
   * Description: Handles adding a new friend by looking up the user's messaging keys and sending a friend request.
   * Keywords: friend, request, add, messaging
   */
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

      /**
   * Callers: [onClick of Accept/Reject buttons]
   * Callees: [fetch, loadFriends, window.dispatchEvent]
   * Description: Handles responding (accept or reject) to an incoming friend request.
   * Keywords: friend, respond, accept, reject
   */
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
      window.dispatchEvent(new Event('messages-read')); // Update unread count
      loadFriends();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveFriend = async (targetUserId: string) => {
    if (!confirm(dict.messages?.confirmRemove || "Are you sure you want to remove this friend?")) return;
    try {
      await fetch('/api/v1/friends/remove', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'include',
        body: JSON.stringify({ targetUserId })
      });
      loadFriends();
    } catch (e) {
      console.error(e);
    }
  };

  const handleBlockUser = async (targetUserId: string) => {
    if (!confirm(dict.messages?.confirmBlock || "Are you sure you want to block this user?")) return;
    try {
      await fetch('/api/v1/friends/block', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'include',
        body: JSON.stringify({ targetUserId })
      });
      loadFriends();
    } catch (e) {
      console.error(e);
    }
  };

  const pendingRequests = friendships.filter(f => f.status === 'PENDING' && f.requesterId !== myId);
  const friendsList = friendships.filter(f => f.status === 'ACCEPTED' || (f.status === 'PENDING' && f.requesterId === myId));
  const blockedList = friendships.filter(f => f.status === 'BLOCKED' && f.requesterId === myId);

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

      {pendingRequests.length > 0 && (
        <div className="mb-8">
          <button
            onClick={() => setShowRequests(!showRequests)}
            className="flex items-center justify-between w-full bg-card border border-border rounded-xl p-4 shadow-sm hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-lg">{dict.messages?.friendRequests || "Friend Requests"}</h2>
              <span className="bg-destructive text-destructive-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingRequests.length}
              </span>
            </div>
            {showRequests ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
          </button>

          {showRequests && (
            <div className="mt-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
              {pendingRequests.map(f => {
                const otherUser = f.requester;
                const otherUsername = otherUser?.username || 'Unknown User';
                return (
                  <div key={f.id} className="p-4 border border-border bg-card rounded-xl flex items-center justify-between shadow-sm">
                    <div>
                      <span className="font-bold">{otherUsername}</span>
                      <span className="text-xs ml-2 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                        {dict.messages?.pending || 'Pending'}
                      </span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <button onClick={() => handleRespond(f.id, true)} className="flex items-center gap-1 px-3 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded-md text-sm font-medium transition-colors">
                        <Check className="w-4 h-4"/> {dict.messages?.accept || "Accept"}
                      </button>
                      <button onClick={() => handleRespond(f.id, false)} className="flex items-center gap-1 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-md text-sm font-medium transition-colors">
                        <X className="w-4 h-4"/> {dict.messages?.reject || "Reject"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        <h2 className="font-semibold text-lg">{dict.messages?.friendList || "Friend List"}</h2>
        {friendsList.length === 0 ? (
          <p className="text-muted-foreground text-sm">{dict.messages?.noFriendsYet || "No friends yet."}</p>
        ) : (
          friendsList.map(f => {
            const isRequester = f.requesterId === myId;
            const otherUser = isRequester ? f.addressee : f.requester;
            const otherUsername = otherUser?.username || 'Unknown User';
            return (
              <div key={f.id} className="p-4 border border-border bg-card rounded-xl flex items-center justify-between shadow-sm">
                <div>
                  <span className="font-bold">{otherUsername}</span>
                  <span className={`text-xs ml-2 px-2 py-0.5 rounded-full ${
                    f.status === 'ACCEPTED' ? 'bg-green-100 text-green-700' :
                    f.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {f.status === 'PENDING' ? (dict.messages?.pending || 'Pending') : f.status === 'ACCEPTED' ? (dict.messages?.accepted || 'Accepted') : (dict.messages?.rejected || 'Rejected')}
                  </span>
                </div>
                <div className="flex gap-2 items-center">
                  {f.status === 'ACCEPTED' && (
                    <Link href={`/messages/${otherUsername}`} className="text-sm font-medium text-primary hover:underline px-3 py-1 bg-primary/10 rounded-md">
                      {dict.messages?.chat || "Chat"}
                    </Link>
                  )}
                  {f.status === 'ACCEPTED' && (
                    <>
                      <button onClick={() => handleRemoveFriend(otherUser.id)} className="text-sm font-medium text-red-600 hover:bg-red-50 px-2 py-1 rounded flex items-center gap-1">
                        <UserMinus className="h-4 w-4" /> {dict.messages?.remove || "Remove"}
                      </button>
                      <button onClick={() => handleBlockUser(otherUser.id)} className="text-sm font-medium text-gray-600 hover:bg-gray-100 px-2 py-1 rounded flex items-center gap-1 dark:text-gray-400 dark:hover:bg-zinc-800">
                        <Ban className="h-4 w-4" /> {dict.messages?.block || "Block"}
                      </button>
                    </>
                  )}
                  {f.status === 'PENDING' && isRequester && (
                    <button onClick={() => handleRemoveFriend(otherUser.id)} className="text-sm font-medium text-red-600 hover:bg-red-50 px-2 py-1 rounded flex items-center gap-1">
                       <X className="h-4 w-4" /> {dict.common?.cancel || "Cancel"}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {blockedList.length > 0 && (
        <div className="mt-8 space-y-4">
          <h2 className="font-semibold text-lg text-red-600 flex items-center gap-2"><Ban className="h-5 w-5" /> {dict.messages?.blacklist || "Blacklist"}</h2>
          {blockedList.map(f => {
            const otherUser = f.addressee;
            const otherUsername = otherUser?.username || 'Unknown User';
            return (
              <div key={f.id} className="p-4 border border-border bg-card rounded-xl flex items-center justify-between shadow-sm opacity-70">
                <div>
                  <span className="font-bold line-through">{otherUsername}</span>
                </div>
                <div className="flex gap-2 items-center">
                  <button onClick={() => handleRemoveFriend(otherUser.id)} className="text-sm font-medium text-primary hover:underline px-3 py-1 bg-primary/10 rounded-md">
                    {dict.messages?.unblock || "Unblock"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
