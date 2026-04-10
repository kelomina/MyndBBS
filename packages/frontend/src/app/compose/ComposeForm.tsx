'use client';

import { useState, useEffect } from 'react';
import { useCategories } from '../../lib/hooks';
import { useRouter } from 'next/navigation';
import { PostEditor } from '../../components/PostEditor';
import { SliderCaptcha } from '../../components/SliderCaptcha';
import { useTranslation } from '../../components/TranslationProvider';

export function ComposeForm({ dict }: { dict: any }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState<{ id: string; name: string; description: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCaptcha, setShowCaptcha] = useState(false);

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

  const handlePrePublish = () => {
    if (!title || !content || !categoryId) {
      alert('Please fill out all fields');
      return;
    }
    setShowCaptcha(true);
  };

  const handlePublish = async (captchaId: string) => {
    setShowCaptcha(false);
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, content, categoryId, captchaId }),
        credentials: 'include'
      });
      
      if (res.ok) {
        router.push('/');
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
          onClick={handlePrePublish}
          disabled={loading}
          className="rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? '...' : dict.post.publish}
        </button>
      </div>

      {showCaptcha && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card p-6 rounded-2xl shadow-xl relative">
            <button 
              onClick={() => setShowCaptcha(false)}
              className="absolute top-2 right-2 text-muted hover:text-foreground"
            >
              &times;
            </button>
            <h3 className="text-lg font-bold mb-4 text-center">{dict.post?.verifyToPublish || "Verify to Publish"}</h3>
            <SliderCaptcha 
              onSuccess={handlePublish} 
              apiUrl={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/auth`}
            />
          </div>
        </div>
      )}

      <PostEditor dict={dict} title={title} setTitle={setTitle} content={content} setContent={setContent} categoryId={categoryId} setCategoryId={setCategoryId} categories={categories} />
    </>
  );
}
