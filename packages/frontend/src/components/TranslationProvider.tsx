'use client';
import React, { createContext, useContext } from 'react';
import type { Dictionary } from '../types';

const TranslationContext = createContext<Dictionary | null>(null);

export function TranslationProvider({ dict, children }: { dict: Dictionary; children: React.ReactNode }) {
  return (
    <TranslationContext.Provider value={dict}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation(): Dictionary {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
}
