import { ArrowLeft, Image as ImageIcon, Link as LinkIcon, List, Bold, Italic } from 'lucide-react';
import Link from 'next/link';
import { headers } from 'next/headers';
import { Locale, defaultLocale } from '../../i18n/config';
import { getDictionary } from '../../i18n/get-dictionary';

export default async function ComposePage() {
  const headersList = await headers();
  const locale = (headersList.get('x-locale') || defaultLocale) as Locale;
  const dict = await getDictionary(locale);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="flex items-center text-sm font-medium text-muted hover:text-foreground transition-colors">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {dict.post.backToHome}
          </Link>
          <button className="rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors">
            {dict.post.publish}
          </button>
        </div>

        <div className="space-y-6">
          <div className="flex gap-4">
            <select className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary w-48">
              <option value="">{dict.post.selectCategory}</option>
              <option value="tech">{dict.common.categoryTech}</option>
              <option value="life">{dict.common.categoryLife}</option>
              <option value="qa">{dict.common.categoryQA}</option>
            </select>
          </div>

          <input 
            type="text" 
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
              className="flex-1 w-full bg-transparent p-4 text-foreground placeholder-muted focus:outline-none resize-none"
              placeholder={dict.post.writeContent}
            ></textarea>
          </div>
        </div>

      </div>
    </div>
  );
}
