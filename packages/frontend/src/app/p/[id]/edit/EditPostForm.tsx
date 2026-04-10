'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PostEditor } from '../../../../components/PostEditor';

export function EditPostForm({ dict, initialPost }: { dict: any, initialPost: any }) {
  const router = useRouter();
  const [title, setTitle] = useState(initialPost.title);
  const [content, setContent] = useState(initialPost.content);
  const [categoryId, setCategoryId] = useState(initialPost.categoryId);
  const [categories, setCategories] = useState<{ id: string; name: string; description: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/categories`);
        if (res.ok) {
          const data = await res.json();
          setCategories(data);
        }
      } catch (err) {
        console.error('Failed to load categories', err);
      }
    };
    fetchCategories();
  }, []);

  const handlePublish = async () => {
    if (!title || !content || !categoryId) {
      alert('Please fill out all fields');
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/posts/${initialPost.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, content, categoryId }),
        credentials: 'include'
      });
      
      if (res.ok) {
        router.push(`/p/${initialPost.id}`);
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to publish post');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to publish post');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <button onClick={() => router.back()} className="flex items-center text-sm font-medium text-muted hover:text-foreground transition-colors">
          &larr; {dict.post.backToHome}
        </button>
        <button 
          onClick={handlePublish}
          disabled={loading}
          className="rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? '...' : dict.post.save || 'Save'}
        </button>
      </div>

      <PostEditor dict={dict} title={title} setTitle={setTitle} content={content} setContent={setContent} categoryId={categoryId} setCategoryId={setCategoryId} categories={categories} />
    </>
  );
}
