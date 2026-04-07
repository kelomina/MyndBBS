'use client';
import React, { createContext, useContext } from 'react';

const TranslationContext = createContext<any>(null);

export function TranslationProvider({ dict, children }: { dict: any, children: React.ReactNode }) {
  return (
    <TranslationContext.Provider value={dict}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
}
