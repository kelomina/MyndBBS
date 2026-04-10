import { Image as ImageIcon, Link as LinkIcon, List, Bold, Italic } from 'lucide-react';

interface PostEditorProps {
  dict: any;
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
              {dict.common?.[`category${cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}`] || cat.name}
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
          placeholder={dict.post?.writeContent || 'Write something...'}
        ></textarea>
      </div>
    </div>
  );
}
