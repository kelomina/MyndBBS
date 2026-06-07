'use client';

import React, { useCallback, useRef, useState } from 'react';
import { ReauthModal } from '../../components/ReauthModal';

type PendingAction = (() => Promise<void>) | null;
type PendingErrorHandler = ((err: unknown) => void) | null;

export function useSudoAction() {
  const [showReauth, setShowReauth] = useState(false);
  const pendingActionRef = useRef<PendingAction>(null);
  const pendingErrorHandlerRef = useRef<PendingErrorHandler>(null);

  const runWithSudo = useCallback(async (action: () => Promise<void>, onRetryError?: (err: unknown) => void) => {
    try {
      await action();
    } catch (err) {
      if (err instanceof Error && err.message === 'ERR_SUDO_REQUIRED') {
        pendingActionRef.current = action;
        pendingErrorHandlerRef.current = onRetryError ?? null;
        setShowReauth(true);
        return;
      }
      throw err;
    }
  }, []);

  const modal = (
    <ReauthModal
      isOpen={showReauth}
      onClose={() => {
        pendingActionRef.current = null;
        pendingErrorHandlerRef.current = null;
        setShowReauth(false);
      }}
      onSuccess={() => {
        const action = pendingActionRef.current;
        const onRetryError = pendingErrorHandlerRef.current;
        pendingActionRef.current = null;
        pendingErrorHandlerRef.current = null;
        setShowReauth(false);
        if (action) {
          void action().catch((err) => {
            if (onRetryError) {
              onRetryError(err);
            }
          });
        }
      }}
    />
  );

  return { runWithSudo, sudoModal: modal };
}
