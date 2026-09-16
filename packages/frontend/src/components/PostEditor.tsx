'use client';

import { useRef, useState } from 'react';
import {
  AlertCircle,
  Image as ImageIcon,
  Link as LinkIcon,
  List,
  Bold,
  Italic,
  Sigma,
} from 'lucide-react';
import { POST_ATTACHMENT_MAX_BYTES } from '@myndbbs/shared';
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

/**
 * Callers: [PostEditor]
 * Callees: []
 * Description: One mebibyte, used only as a display-unit divisor; the upload ceiling itself
 *   always comes from `POST_ATTACHMENT_MAX_BYTES` so no second literal can drift (FREEZE R3).
 * 描述：1 MiB 的展示换算单位；上限数值一律取自 `POST_ATTACHMENT_MAX_BYTES`，本文件不得再出现第二处字面量（FREEZE R3）。
 * Variables: `BYTES_PER_MB` = 1048576 bytes.
 * 变量：`BYTES_PER_MB` 为 1048576 字节。
 * Integration: Read-only constant for the helpers below.
 * 接入方式：仅供下方私有 helper 使用。
 * Error Handling: Not applicable (constant).
 * 错误处理：不适用（常量）。
 * Keywords: upload size, unit, single source, 上限换算, 单一真源
 */
const BYTES_PER_MB = 1024 * 1024;

/**
 * Callers: [PostEditor.handleImageChange]
 * Callees: [BYTES_PER_MB]
 * Description: Formats a byte count for the over-limit notice (DESIGN §1.4): one decimal with
 *   `MB` from 1 MiB up, whole `KB` below, never raw bytes. Both branches round **up** so a file
 *   that is over the ceiling can never render as the ceiling itself (DESIGN §7.1-3 / D3).
 * 描述：按 DESIGN §1.4 口径格式化体积：≥1MB 一位小数带 MB、<1MB 取整带 KB、禁止裸字节；
 *   两个分支一律**向上**取整，超限 1 字节也不能显示成上限本身（DESIGN §7.1-3 / D3）。
 * Variables: `bytes` is the File.size value; `value` is the rounded display number.
 * 变量：`bytes` 为 File.size；`value` 为换算后的展示数值。
 * Integration: Only feeds the `{size}` placeholder of `post.imageTooLarge`.
 * 接入方式：仅用于填充 `post.imageTooLarge` 的 `{size}` 占位符。
 * Error Handling: Non-finite input degrades to `0KB` instead of printing `NaN`.
 * 错误处理：非有限数值回落为 `0KB`，不输出 `NaN`。
 * Keywords: size format, MB, KB, ceil, round up, 体积格式化, 向上取整
 */
function formatUploadSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0KB';
  if (bytes >= BYTES_PER_MB) {
    return `${(Math.ceil((bytes / BYTES_PER_MB) * 10) / 10).toFixed(1)}MB`;
  }
  return `${Math.ceil(bytes / 1024)}KB`;
}

/**
 * Callers: [PostEditor image notice, PostEditor toolbar tooltip]
 * Callees: []
 * Description: Fills `{name}` placeholders in a dictionary string, same brace style as
 *   `post.draftFound` / `{time}` (ComposeForm.tsx:168). Unknown placeholders stay untouched.
 * 描述：填充字典字符串里的 `{name}` 占位符，沿用 `post.draftFound` 的 `{time}` 花括号插值风格；
 *   未知占位符原样保留。
 * Variables: `template` is the raw dictionary value; `values` maps placeholder name to display text.
 * 变量：`template` 为字典原文；`values` 为占位符到展示文本的映射。
 * Integration: Keeps the visible limit number derived from the shared constant (FREEZE R7),
 *   so no copy string can drift away from it.
 * 接入方式：界面上限数字始终由共享常量算出（FREEZE R7），字典文案不硬编码数字。
 * Error Handling: Unknown placeholders are left visible so a missing value shows up in review
 *   instead of silently vanishing.
 * 错误处理：未知占位符原样保留，缺参数时会在评审里显形而不是静默消失。
 * Keywords: i18n interpolation, placeholder, maxMB, 插值, 防漂移
 */
function interpolate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match: string, name: string) => values[name] ?? match);
}

/**
 * Callers: [PostEditor]
 * Callees: []
 * Description: Single-slot notice state for the image toolbar (DESIGN §2.3 / FREEZE R6):
 *   none | uploading | tooLarge | failed, latest write wins, never auto-dismisses.
 * 描述：图片工具栏的单槽位提示态（DESIGN §2.3 / FREEZE R6）：none | uploading | tooLarge | failed，
 *   后写覆盖先写，不自动消失。
 * Variables: `text` carries the sentence resolved at write time, because the two `tooLarge`
 *   writers deliberately differ (local echo vs server code, DESIGN §7.1 routing fix).
 * 变量：`text` 为写入时就解析好的句子，因为两个 `tooLarge` 写入点刻意不同文
 *   （本地回显体积 vs 服务端码无数字，DESIGN §7.1 路由修正）。
 * Integration: Rendered between the toolbar and the writing area as one bar at a time.
 * 接入方式：渲染在工具栏与书写区之间，同刻只出现一条。
 * Error Handling: `none` renders nothing, so an unhandled value cannot leave an empty bar behind.
 * 错误处理：`none` 不渲染任何节点，异常取值不会留下空条。
 * Keywords: image notice, state machine, inline error, 提示条, 四态
 */
type ImageNotice =
  | { status: 'none' }
  | { status: 'uploading' }
  | { status: 'tooLarge'; text: string }
  | { status: 'failed'; text: string };

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
  const [imageNotice, setImageNotice] = useState<ImageNotice>({ status: 'none' });

  const maxMBLabel = String(POST_ATTACHMENT_MAX_BYTES / BYTES_PER_MB);
  const imagePlaceholders = { maxMB: maxMBLabel };
  // Local pre-check copy: we know the exact file, so it echoes `{size}` (DESIGN §1.3).
  // 本地预校验文案：文件在手，故回显 `{size}`（DESIGN §1.3）。
  const localOverLimitText = (sizeText: string) =>
    interpolate(
      postDict.imageTooLarge ||
        'Image is over the {maxMB}MB limit (currently {size}). Please compress it and try again.',
      { ...imagePlaceholders, size: sizeText },
    );
  // Server / reverse-proxy 413 copy must NOT echo a local byte count: the rejection can come from
  // a different ceiling (avatar 2 MiB, journal PDF 20 MiB) or before the body is fully read, and
  // an HTML 413 never carries a size at all (DESIGN §7.1 routing fix, D2).
  // 服务端/反代 413 文案不得回显本地体积：拒因可能是别的上限（头像 2 MiB、期刊 PDF 20 MiB）或
  // body 未读完，HTML 413 根本不携带体积（DESIGN §7.1 路由修正，D2）。
  const serverOverLimitText = () =>
    apiErrors.LIMIT_FILE_SIZE ||
    'The file is larger than the upload limit. Please choose a smaller file and try again.';
  const imageButtonLabel = interpolate(
    postDict.image || 'Insert image (up to {maxMB}MB each)',
    imagePlaceholders,
  );
  const imageNoticeText =
    imageNotice.status === 'tooLarge'
      ? imageNotice.text
      : imageNotice.status === 'failed'
        ? imageNotice.text
        : '';

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

  const insertFormula = () => {
    replaceSelection(selectedText => {
      // Insert a display-math block (`$$…$$` on its own lines). The renderer
      // treats single-line `$$…$$` as display math too, so the placeholder is
      // wrapped the same way whether or not the user selected text.
      const text = selectedText || postDict.formulaPlaceholder || 'formula';
      const formulaText = `$$\n${text}\n$$`;
      return selectedText
        ? { text: formulaText }
        : { text: formulaText, selectionStart: 3, selectionEnd: 3 + text.length };
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
      setImageNotice({
        status: 'failed',
        text:
          apiErrors.ERR_FILE_TYPE_NOT_ALLOWED ||
          'Only image files (JPG, PNG, GIF, WebP) can be inserted.',
      });
      event.target.value = '';
      return;
    }

    // FREEZE R2: the ceiling is inclusive, so only `> MAX` is refused; exactly
    // POST_ATTACHMENT_MAX_BYTES must go through (backend multer uses MAX + 1).
    // Refusing here means zero network requests and zero rate-limit quota spent.
    // FREEZE R2：上限含边界，只有 `> MAX` 才拒；恰好等于上限必须放行（后端 multer 取 MAX + 1）。
    // 此处拦下即零请求、零限流配额消耗。
    if (file.size > POST_ATTACHMENT_MAX_BYTES) {
      setImageNotice({
        status: 'tooLarge',
        text: localOverLimitText(formatUploadSize(file.size)),
      });
      event.target.value = '';
      return;
    }

    setUploadingImage(true);
    setImageNotice({ status: 'uploading' });
    try {
      const formData = new FormData();
      formData.append('file', file, file.name);

      const res = await fetchWithAuth('/api/v1/messages/upload/post-image', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // R9: OpenResty can answer with an HTML 413 (no JSON body), so the status alone must
        // route to the over-limit notice; falling through would show "upload failed" instead.
        // R9：反代可能返回 HTML 413（无 JSON 体），只凭 status 就必须落到超限文案，
        // 否则用户看到的是「上传失败」这种无信息量提示。
        if (res.status === 413) {
          setImageNotice({ status: 'tooLarge', text: serverOverLimitText() });
          return;
        }
        throw new Error(data.error || 'ERR_UPLOAD_FAILED');
      }

      const uploadedUrl = data.url;
      if (typeof uploadedUrl !== 'string' || !uploadedUrl.startsWith('/uploads/')) {
        throw new Error('ERR_UPLOAD_FAILED');
      }

      const altText = file.name.replace(/\.[^.]+$/, '').trim();
      insertMarkdownImage(uploadedUrl, altText);
      setImageNotice({ status: 'none' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'ERR_UPLOAD_FAILED';
      setImageNotice({
        status: 'failed',
        text:
          apiErrors[message] ||
          apiErrors.ERR_UPLOAD_FAILED ||
          'Image upload failed. Please try again.',
      });
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
          <button
            type="button"
            onClick={insertFormula}
            className="p-2 text-muted hover:text-foreground hover:bg-background rounded"
            title={postDict.math || 'Formula'}
            aria-label={postDict.math || 'Formula'}
          >
            <Sigma className="h-4 w-4" />
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
            title={imageButtonLabel}
            aria-label={imageButtonLabel}
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

        {/* Image notice: single slot, no auto-dismiss, no close button, never steals focus.
            status/alert are two sibling nodes with fixed roles (FREEZE R6 / DESIGN P1).
            图片提示条：单槽位、不自动消失、无关闭按钮、不抢焦点；
            上传中与错误各用独立兄弟节点固定 role（FREEZE R6 / DESIGN P1）。 */}
        {imageNotice.status === 'uploading' && (
          <div
            role="status"
            aria-live="polite"
            className="flex flex-wrap items-center gap-2 border-b border-border bg-background/50 px-3 py-2 text-sm text-muted"
          >
            <ImageIcon className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 break-words">
              {postDict.imageUploading || 'Uploading image...'}
            </span>
          </div>
        )}
        {(imageNotice.status === 'tooLarge' || imageNotice.status === 'failed') && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-2 border-b border-border bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-300"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 break-words">{imageNoticeText}</span>
          </div>
        )}

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
