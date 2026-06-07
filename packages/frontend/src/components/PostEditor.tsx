'use client';

import { useRef, useState } from 'react';
import { Image as ImageIcon, Link as LinkIcon, List, Bold, Italic } from 'lucide-react';
import type { Dictionary } from '../types';
import { fetchWithAuth } from '../lib/api/fetcher';

interface PostEditorProps {
  dict: Dictionary;
  title: string;
  setTitle: (t: string) => void;
  content: string;
  setContent: (c: string) => void;
  categoryId: string;
  setCategoryId: (id: string) => void;
  categories: { id: string; name: string; description: string }[];
}

export function PostEditor({
  dict,
  title,
  setTitle,
  content,
  setContent,
  categoryId,
  setCategoryId,
  categories
}: PostEditorProps) {
  const common = dict.common as unknown as Record<string, string | undefined>;
  const postDict = dict.post as unknown as Record<string, string | undefined>;
  const apiErrors = dict.apiErrors as unknown as Record<string, string | undefined>;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const replaceSelection = (
    buildText: (selectedText: string) => { text: string; selectionStart?: number; selectionEnd?: number },
  ) => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? content.length;
    const end = textarea?.selectionEnd ?? content.length;
    const selectedText = content.slice(start, end);
    const replacement = buildText(selectedText);
    const nextContent = `${content.slice(0, start)}${replacement.text}${content.slice(end)}`;

    setContent(nextContent);

    requestAnimationFrame(() => {
      const nextTextarea = textareaRef.current;
      if (!nextTextarea) return;
      nextTextarea.focus();
      const selectionStart = start + (replacement.selectionStart ?? replacement.text.length);
      const selectionEnd = start + (replacement.selectionEnd ?? replacement.text.length);
      nextTextarea.setSelectionRange(selectionStart, selectionEnd);
    });
  };

  const wrapSelection = (prefix: string, suffix: string, placeholder: string) => {
    replaceSelection(selectedText => {
      const text = selectedText || placeholder;
      const wrappedText = `${prefix}${text}${suffix}`;
      return selectedText
        ? { text: wrappedText }
        : { text: wrappedText, selectionStart: prefix.length, selectionEnd: prefix.length + text.length };
    });
  };

  const insertList = () => {
    replaceSelection(selectedText => {
      const text = selectedText || (postDict.listItemPlaceholder || 'List item');
      const lines = text.split(/\r?\n/);
      const listText = lines
        .map(line => {
          const trimmed = line.trim();
          if (!trimmed) return '- ';
          if (/^([-*+]|\d+\.)\s+/.test(trimmed)) return line;
          return `- ${line}`;
        })
        .join('\n');

      return selectedText
        ? { text: listText }
        : { text: listText, selectionStart: 2, selectionEnd: listText.length };
    });
  };

  const insertLink = () => {
    const url = window.prompt(postDict.linkUrlPrompt || 'Enter link URL');
    if (!url) return;

    replaceSelection(selectedText => {
      const label = selectedText || postDict.linkTextPlaceholder || 'link text';
      const linkText = `[${label}](${url})`;
      return selectedText
        ? { text: linkText }
        : { text: linkText, selectionStart: 1, selectionEnd: 1 + label.length };
    });
  };

  const insertMarkdownImage = (url: string, altText: string) => {
    replaceSelection(selectedText => {
      const label = selectedText || altText || postDict.imageAltPlaceholder || 'image';
      const imageText = `![${label}](${url})`;
      return selectedText
        ? { text: imageText }
        : { text: imageText, selectionStart: 2, selectionEnd: 2 + label.length };
    });
  };

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      window.alert(apiErrors.ERR_FILE_TYPE_NOT_ALLOWED || 'Only image files are allowed');
      event.target.value = '';
      return;
    }

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file, file.name);

      const res = await fetchWithAuth('/api/v1/messages/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'ERR_UPLOAD_FAILED');
      }

      const uploadedUrl = data.url;
      if (typeof uploadedUrl !== 'string' || !uploadedUrl.startsWith('/uploads/')) {
        throw new Error('ERR_UPLOAD_FAILED');
      }

      const altText = file.name.replace(/\.[^.]+$/, '').trim();
      insertMarkdownImage(uploadedUrl, altText);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'ERR_UPLOAD_FAILED';
      window.alert(apiErrors[message] || apiErrors.ERR_UPLOAD_FAILED || 'Image upload failed');
    } finally {
      setUploadingImage(false);
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <select 
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary w-48"
        >
          <option value="">{dict.post?.selectCategory || 'Select Category'}</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {common[`category${cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}`] || cat.name}
            </option>
          ))}
        </select>
      </div>

      <input 
        type="text" 
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={dict.post?.postTitle || 'Title'}
        className="w-full bg-transparent text-4xl font-bold text-foreground placeholder-muted focus:outline-none"
      />

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col min-h-[400px]">
        {/* Toolbar */}
        <div className="flex items-center gap-1 border-b border-border p-2 bg-background/50">
          <button
            type="button"
            onClick={() => wrapSelection('**', '**', postDict.boldPlaceholder || 'bold text')}
            className="p-2 text-muted hover:text-foreground hover:bg-background rounded"
            title={postDict.bold || 'Bold'}
            aria-label={postDict.bold || 'Bold'}
          >
            <Bold className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => wrapSelection('*', '*', postDict.italicPlaceholder || 'italic text')}
            className="p-2 text-muted hover:text-foreground hover:bg-background rounded"
            title={postDict.italic || 'Italic'}
            aria-label={postDict.italic || 'Italic'}
          >
            <Italic className="h-4 w-4" />
          </button>
          <div className="w-px h-4 bg-border mx-2"></div>
          <button
            type="button"
            onClick={insertList}
            className="p-2 text-muted hover:text-foreground hover:bg-background rounded"
            title={postDict.list || 'List'}
            aria-label={postDict.list || 'List'}
          >
            <List className="h-4 w-4" />
          </button>
          <div className="w-px h-4 bg-border mx-2"></div>
          <button
            type="button"
            onClick={insertLink}
            className="p-2 text-muted hover:text-foreground hover:bg-background rounded"
            title={postDict.link || 'Link'}
            aria-label={postDict.link || 'Link'}
          >
            <LinkIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={uploadingImage}
            className="p-2 text-muted hover:text-foreground hover:bg-background rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title={postDict.image || 'Image'}
            aria-label={postDict.image || 'Image'}
          >
            <ImageIcon className="h-4 w-4" />
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
          />
        </div>
        
        {/* Editor Area */}
        <textarea 
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="flex-1 w-full bg-transparent p-4 text-foreground placeholder-muted focus:outline-none resize-none"
          placeholder={dict.post?.writeContent || 'Write something...'}
        ></textarea>
      </div>
    </div>
  );
}
