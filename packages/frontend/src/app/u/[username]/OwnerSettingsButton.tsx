'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Settings, LogOut, UserPlus, UserCheck, Clock } from 'lucide-react';

import { useTranslation } from '../../../components/TranslationProvider';
import { SliderCaptcha } from '../../../components/SliderCaptcha';
import { useToast } from '../../../components/ui/Toast';

import { Mail } from 'lucide-react';
export function OwnerSettingsButton({ username, userId }: { username: string; userId: string }) {
  const [currentUser, setCurrentUser] = useState<{ username: string; level?: number; id: string } | null>(null);
  const [friendStatus, setFriendStatus] = useState<'none' | 'pending' | 'accepted' | 'self'>('none');
  const [friendLoading, setFriendLoading] = useState(false);
  const [showCaptcha, setShowCaptcha] = useState(false);

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const dict = useTranslation();
  const { toast } = useToast();

  useEffect(() => {
    const checkOwner = async () => {
      try {
        const res = await fetch(`/api/v1/user/profile`, {
          credentials: 'include',
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        if (res.ok) {
          const data = await res.json();
          setCurrentUser(data.user);
          if (data.user.id === userId) {
            setFriendStatus('self');
          } else {
            const friendsRes = await fetch(`/api/v1/friends/`, {
              credentials: 'include',
              headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });
            if (friendsRes.ok) {
              const friendsData = await friendsRes.json();
              const friendship = friendsData.friendships?.find(
                (f: { requesterId: string; addresseeId: string; status: string }) =>
                  (f.requesterId === userId || f.addresseeId === userId)
              );
              if (friendship) {
                const status = friendship.status?.toUpperCase();
                if (status === 'ACCEPTED') {
                  setFriendStatus('accepted');
                } else if (status === 'PENDING') {
                  setFriendStatus('pending');
                } else {
                  setFriendStatus('none');
                }
              } else {
                setFriendStatus('none');
              }
            }
          }
        }
      } catch {
      }
    };
    checkOwner();
  }, [username, userId]);

  useEffect(() => {
    const handleFriendshipChanged = () => {
      const checkFriendStatus = async () => {
        try {
          const friendsRes = await fetch(`/api/v1/friends/`, {
            credentials: 'include',
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
          });
          if (friendsRes.ok) {
            const friendsData = await friendsRes.json();
            const friendship = friendsData.friendships?.find(
              (f: { requesterId: string; addresseeId: string; status: string }) =>
                (f.requesterId === userId || f.addresseeId === userId)
            );
            if (friendship) {
              const status = friendship.status?.toUpperCase();
              if (status === 'ACCEPTED') {
                setFriendStatus('accepted');
              } else if (status === 'PENDING') {
                setFriendStatus('pending');
              } else {
                setFriendStatus('none');
              }
            } else {
              setFriendStatus('none');
            }
          }
        } catch {}
      };
      checkFriendStatus();
    };
    window.addEventListener('friendship-changed', handleFriendshipChanged);
    return () => window.removeEventListener('friendship-changed', handleFriendshipChanged);
  }, [userId]);

  const handleAddFriend = () => {
    setShowCaptcha(true);
  };

  const handleCaptchaSuccess = async (captchaId: string) => {
    setShowCaptcha(false);
    setFriendLoading(true);
    try {
      const res = await fetch(`/api/v1/friends/request`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ addresseeId: userId, captchaId })
      });
      if (res.ok) {
        setFriendStatus('pending');
        window.dispatchEvent(new CustomEvent('friendship-changed', { detail: { userId, status: 'pending' } }));
        toast(dict.messages?.requestSent || 'Friend request sent!', 'success');
      } else {
        const data = await res.json();
        const apiErrors = dict.apiErrors as unknown as Record<string, string | undefined>;
        toast(apiErrors?.[data.error] || data.error || dict.messages?.failedToSendRequest || 'Failed to send request', 'error');
      }
    } catch {
      toast(dict.messages?.errorSendingRequest || 'Error sending friend request', 'error');
    } finally {
      setFriendLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch(`/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'include'
      });
      window.location.href = '/';
    } catch (err) {
      console.error('Logout failed', err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (!currentUser) return null;
  const isOwner = currentUser.username === username;

  return (
    <div className="flex gap-2">
      {showCaptcha && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card p-6 rounded-2xl shadow-xl relative">
            <button
              onClick={() => setShowCaptcha(false)}
              className="absolute top-2 right-2 text-muted hover:text-foreground"
            >
              &times;
            </button>
            <h3 className="text-lg font-bold mb-4 text-center">{dict.messages?.verifyToAddFriend || 'Verify to Add Friend'}</h3>
            <SliderCaptcha
              onSuccess={handleCaptchaSuccess}
              apiUrl={`/api/v1/auth`}
            />
          </div>
        </div>
      )}
      {!isOwner && (currentUser.level ?? 0) >= 2 && (
        <>
          {friendStatus === 'none' && (
            <button
              onClick={handleAddFriend}
              disabled={friendLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50"
            >
              <UserPlus className="h-4 w-4" />
              {friendLoading ? '...' : (dict.messages?.addFriend || 'Add Friend')}
            </button>
          )}
          {friendStatus === 'pending' && (
            <span className="inline-flex items-center gap-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 px-4 py-2 text-sm font-medium text-yellow-800 dark:text-yellow-200">
              <Clock className="h-4 w-4" />
              {dict.messages?.pending || 'Pending'}
            </span>
          )}
          {friendStatus === 'accepted' && (
            <span className="inline-flex items-center gap-2 rounded-lg bg-green-100 dark:bg-green-900/30 px-4 py-2 text-sm font-medium text-green-800 dark:text-green-200">
              <UserCheck className="h-4 w-4" />
              {dict.messages?.addFriend || 'Friend'}
            </span>
          )}
          <Link
            href={`/messages/${username}`}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Mail className="h-4 w-4" />
            {dict.messages?.title || 'Send Message'}
          </Link>
        </>
      )}
      {isOwner && (<>
      <Link
        href="/u/settings"
        className="inline-flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
      >
        <Settings className="h-4 w-4" />
        {dict.common?.settings || 'Settings'}
      </Link>
      <button
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/80 transition-colors"
      >
        <LogOut className="h-4 w-4" />
        {isLoggingOut ? '...' : dict.common?.logout || 'Logout'}
      </button>
      </>)}
    </div>
  );
}
