'use client';
import React, { createContext, useContext } from 'react';
import type { Dictionary } from '../i18n/types';

const TranslationContext = createContext<Dictionary | null>(null);

/**
 * Callers: []
 * Callees: []
 * Description: Handles the translation provider logic for the application.
 * Keywords: translationprovider, translation, provider, auto-annotated
 */
export function TranslationProvider({ dict, children }: { dict: Dictionary; children: React.ReactNode }) {
  return (
    <TranslationContext.Provider value={dict}>
      {children}
    </TranslationContext.Provider>
  );
}

/**
 * Callers: []
 * Callees: [useContext]
 * Description: Handles the use translation logic for the application.
 * Keywords: usetranslation, use, translation, auto-annotated
 */
export function useTranslation(): Dictionary {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
}
