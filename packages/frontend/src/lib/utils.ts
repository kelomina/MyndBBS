import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getCategoryTranslation(name: string | undefined | null, dict: any): string {
  if (!name) return dict?.profile?.uncategorized || 'Uncategorized';
  const key = `category${name.charAt(0).toUpperCase() + name.slice(1)}`;
  return dict?.common?.[key] || name;
}
