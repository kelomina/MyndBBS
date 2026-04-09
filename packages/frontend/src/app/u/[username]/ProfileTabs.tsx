'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export function ProfileTabs({ 
  user, 
  dict, 
  locale 
}: { 
  user: any; 
  dict: any; 
  locale: string;
}) {
  const [activeTab, setActiveTab] = useState<'posts' | 'bookmarks'>('posts');
  const [bookmarks, setBookmarks] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    // Check if the logged-in user is the owner of this profile
    const checkOwner = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/user/profile`, {
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user?.username === user.username) {
            setIsOwner(true);
          }
        }
      } catch (err) {
        // ignore
      }
    };
    checkOwner();
  }, [user.username]);

  const handleTabChange = async (tab: 'posts' | 'bookmarks') => {
    setActiveTab(tab);
    if (tab === 'bookmarks' && bookmarks === null) {
      setLoading(true);
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/user/bookmarks`, {
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          setBookmarks(data);
        } else {
          setBookmarks([]);
        }
      } catch (err) {
        console.error('Failed to fetch bookmarks', err);
        setBookmarks([]);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <>
      <div className="border-b border-border mb-6">
        <nav className="-mb-px flex space-x-8">
          <button 
            onClick={() => handleTabChange('posts')}
            className={`${activeTab === 'posts' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-foreground hover:border-border'} whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium`}
          >
            {dict.profile?.posts || 'Posts'} ({user._count.posts})
          </button>
          {isOwner && (
            <button 
              onClick={() => handleTabChange('bookmarks')}
              className={`${activeTab === 'bookmarks' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-foreground hover:border-border'} whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium`}
            >
              {dict.profile?.bookmarks || 'Bookmarks'}
            </button>
          )}
        </nav>
      </div>

      <div className="space-y-4">
        {activeTab === 'posts' && (
          user.posts.length === 0 ? (
            <p className="text-muted text-sm">{dict.profile?.noPostsYet || 'No posts yet.'}</p>
          ) : (
            user.posts.map((post: any) => (
              <div key={post.id} className="rounded-xl bg-card p-5 shadow-sm border border-border/50 transition-shadow hover:shadow-md cursor-pointer">
                <Link href={`/p/${post.id}`}>
                  <h2 className="text-lg font-bold text-foreground mb-2 hover:text-primary">{post.title}</h2>
                </Link>
                <p className="text-sm text-muted mb-4 line-clamp-2">{post.content}</p>
                <div className="flex items-center text-xs text-muted gap-4">
                  <span>{post.category?.name || dict.profile?.uncategorized || 'Uncategorized'}</span>
                  <span>•</span>
                  <span>{new Date(post.createdAt).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US')}</span>
                </div>
              </div>
            ))
          )
        )}

        {activeTab === 'bookmarks' && (
          loading ? (
            <p className="text-muted text-sm">Loading...</p>
          ) : !bookmarks || bookmarks.length === 0 ? (
            <p className="text-muted text-sm">{dict.profile?.noBookmarksYet || 'No bookmarks yet.'}</p>
          ) : (
            bookmarks.map((item: any) => {
              if (item.type === 'comment') {
                const isDeleted = item.deletedAt != null;
                
                if (isDeleted) {
                  return (
                    <div key={`comment-${item.id}`} className="rounded-xl bg-muted/30 p-5 shadow-sm border border-border/50 opacity-70">
                      <div className="flex flex-col py-2 text-muted">
                        <p className="text-sm font-medium">{dict.profile?.commentDeleted || 'This comment has been deleted.'}</p>
                        <span className="text-xs mt-2">{new Date(item.bookmarkedAt).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US')}</span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={`comment-${item.id}`} className="rounded-xl bg-card p-5 shadow-sm border border-border/50 transition-shadow hover:shadow-md cursor-pointer">
                    <Link href={`/p/${item.postId}#comment-${item.id}`}>
                      <h2 className="text-sm font-medium text-foreground mb-2 hover:text-primary">
                        <span className="text-muted">{dict.profile?.commentOn || 'Comment on: '}</span> 
                        {item.post?.title || 'Unknown Post'}
                      </h2>
                    </Link>
                    <p className="text-sm text-muted mb-4 line-clamp-2">{item.content}</p>
                    <div className="flex items-center text-xs text-muted gap-4">
                      <span>{item.author?.username}</span>
                      <span>•</span>
                      <span>{new Date(item.createdAt).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US')}</span>
                    </div>
                  </div>
                );
              }
              
              // Post bookmark
              const isDeleted = item.status === 'DELETED';
              
              if (isDeleted) {
                return (
                  <div key={`post-${item.id}`} className="rounded-xl bg-muted/30 p-5 shadow-sm border border-border/50 opacity-70">
                    <div className="flex flex-col py-2 text-muted">
                      <p className="text-sm font-medium">{dict.profile?.postDeleted || 'This post has been deleted.'}</p>
                      <span className="text-xs mt-2">{new Date(item.bookmarkedAt).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US')}</span>
                    </div>
                  </div>
                );
              }

              return (
                <div key={`post-${item.id}`} className="rounded-xl bg-card p-5 shadow-sm border border-border/50 transition-shadow hover:shadow-md cursor-pointer">
                  <Link href={`/p/${item.id}`}>
                    <h2 className="text-lg font-bold text-foreground mb-2 hover:text-primary">{item.title}</h2>
                  </Link>
                  <p className="text-sm text-muted mb-4 line-clamp-2">{item.content}</p>
                  <div className="flex items-center text-xs text-muted gap-4">
                    <span>{item.category?.name || dict.profile?.uncategorized || 'Uncategorized'}</span>
                    <span>•</span>
                    <span>{new Date(item.createdAt).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US')}</span>
                  </div>
                </div>
              );
            })
          )
        )}
      </div>
    </>
  );
}