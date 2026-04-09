'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Image as ImageIcon, Link as LinkIcon, List, Bold, Italic } from 'lucide-react';
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

      <div className="space-y-6">
        <div className="flex gap-4">
          <select 
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary w-48"
          >
            <option value="">{dict.post.selectCategory}</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {/* Fallback to dictionary if available, otherwise use DB name */}
                {dict.common[`category${cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}`] || cat.name}
              </option>
            ))}
          </select>
        </div>

        <input 
          type="text" 
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={dict.post.postTitle}
          className="w-full bg-transparent text-4xl font-bold text-foreground placeholder-muted focus:outline-none"
        />

        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col min-h-[400px]">
          {/* Toolbar */}
          <div className="flex items-center gap-1 border-b border-border p-2 bg-background/50">
            <button className="p-2 text-muted hover:text-foreground hover:bg-background rounded"><Bold className="h-4 w-4" /></button>
            <button className="p-2 text-muted hover:text-foreground hover:bg-background rounded"><Italic className="h-4 w-4" /></button>
            <div className="w-px h-4 bg-border mx-2"></div>
            <button className="p-2 text-muted hover:text-foreground hover:bg-background rounded"><List className="h-4 w-4" /></button>
            <div className="w-px h-4 bg-border mx-2"></div>
            <button className="p-2 text-muted hover:text-foreground hover:bg-background rounded"><LinkIcon className="h-4 w-4" /></button>
            <button className="p-2 text-muted hover:text-foreground hover:bg-background rounded"><ImageIcon className="h-4 w-4" /></button>
          </div>
          
          {/* Editor Area */}
          <textarea 
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="flex-1 w-full bg-transparent p-4 text-foreground placeholder-muted focus:outline-none resize-none"
            placeholder={dict.post.writeContent}
          ></textarea>
        </div>
      </div>
    </>
  );
}
