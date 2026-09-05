'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';
import { X } from 'lucide-react';
import { useTranslation } from '../TranslationProvider';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  /** a11y：标题/说明元素 id（F1 要求 dialog + labelledby/describedby）。未传时自动生成。 */
  labelledBy?: string;
  describedBy?: string;
}

export function Modal({ isOpen, onClose, title, children, className, labelledBy, describedBy }: ModalProps) {
  const dict = useTranslation();
  const titleId = React.useId();
  const resolvedLabelledBy = labelledBy ?? (title ? titleId : undefined);
  const resolvedDescribedBy = describedBy;
  const previouslyFocusedRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
      document.body.style.overflow = 'hidden';
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      };
      document.addEventListener('keydown', onKeyDown);
      return () => {
        document.body.style.overflow = 'unset';
        document.removeEventListener('keydown', onKeyDown);
        // 焦点返回触发按钮（F1 a11y）
        const prev = previouslyFocusedRef.current;
        if (prev && typeof prev.focus === 'function') {
          try {
            prev.focus({ preventScroll: true });
          } catch {
            try {
              prev.focus();
            } catch {
              // 忽略焦点恢复失败（如节点已卸载）
            }
          }
        }
      };
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-all duration-100 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Modal Panel */}
      <div 
        className={cn(
          "fixed z-50 grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg duration-200 motion-reduce:animate-none motion-reduce:transition-none sm:rounded-lg",
          "max-h-[90dvh] overflow-y-auto w-[calc(100vw-2rem)] sm:w-full",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={resolvedLabelledBy}
        aria-describedby={resolvedDescribedBy}
      >
        {title && (
          <div className="flex flex-col space-y-1.5 text-center sm:text-left">
            <h2 id={resolvedLabelledBy} className="text-lg font-semibold leading-none tracking-tight">{title}</h2>
          </div>
        )}
        
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">{dict.common?.close || "Close"}</span>
        </button>

        <div className="mt-2">
          {children}
        </div>
      </div>
    </div>
  );
}
