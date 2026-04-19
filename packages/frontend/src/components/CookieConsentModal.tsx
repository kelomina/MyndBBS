'use client';

import React, { useEffect, useState } from 'react';
import { useTranslation } from './TranslationProvider';
import { Button } from './ui/Button';

export const CookieConsentModal = () => {
  const dict = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [preferences, setPreferences] = useState({
    essential: true,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    const checkConsent = async () => {
      try {
        const res = await fetch('/api/v1/user/profile', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data.user && !data.user.cookiePreferences) {
            setIsOpen(true);
          }
        } else if (res.status === 401) {
          // If not logged in, check local storage
          const localConsent = localStorage.getItem('myndbbs_cookie_consent');
          if (!localConsent) {
            setIsOpen(true);
          }
        }
      } catch (error) {
        console.error('Failed to check cookie consent:', error);
      }
    };
    checkConsent();
  }, []);

  const handleSave = async (prefs: any) => {
    setIsOpen(false);
    localStorage.setItem('myndbbs_cookie_consent', JSON.stringify(prefs));
    
    // Sync with backend if logged in
    try {
      await fetch('/api/v1/user/cookie-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ preferences: prefs }),
      });
    } catch (e) {
      // User might not be logged in, ignore
    }
  };

  const handleAcceptAll = () => {
    const all = { essential: true, analytics: true, marketing: true };
    setPreferences(all);
    handleSave(all);
  };

  const handleSavePreferences = () => {
    handleSave(preferences);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card text-card-foreground border border-border shadow-2xl rounded-2xl w-full max-w-lg overflow-hidden flex flex-col">
        <div className="p-6 overflow-y-auto max-h-[80vh]">
          <h2 className="text-2xl font-bold mb-4">{dict.consent?.title || "Terms of Service & Privacy Policy"}</h2>
          <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
            {dict.consent?.description || "We use cookies and similar technologies to enhance your experience, analyze our traffic, and personalize content. By clicking 'Accept All', you agree to the storing of cookies on your device. You can manage your preferences below. These preferences will sync with your account."}
          </p>

          <div className="space-y-4 mt-6">
            <div className="flex items-center justify-between p-3 border border-border rounded-lg bg-muted/30">
              <div>
                <h3 className="font-semibold">{dict.consent?.essential || "Essential Cookies"}</h3>
                <p className="text-xs text-muted-foreground">{dict.consent?.essentialDesc || "Required for the website to function properly."}</p>
              </div>
              <input type="checkbox" checked disabled className="w-5 h-5 accent-primary cursor-not-allowed opacity-50" />
            </div>

            <div className="flex items-center justify-between p-3 border border-border rounded-lg">
              <div>
                <h3 className="font-semibold">{dict.consent?.analytics || "Analytics Cookies"}</h3>
                <p className="text-xs text-muted-foreground">{dict.consent?.analyticsDesc || "Help us understand how visitors interact with the website."}</p>
              </div>
              <input 
                type="checkbox" 
                checked={preferences.analytics} 
                onChange={(e) => setPreferences({ ...preferences, analytics: e.target.checked })}
                className="w-5 h-5 accent-primary cursor-pointer" 
              />
            </div>

            <div className="flex items-center justify-between p-3 border border-border rounded-lg">
              <div>
                <h3 className="font-semibold">{dict.consent?.marketing || "Marketing Cookies"}</h3>
                <p className="text-xs text-muted-foreground">{dict.consent?.marketingDesc || "Used to deliver relevant advertisements."}</p>
              </div>
              <input 
                type="checkbox" 
                checked={preferences.marketing} 
                onChange={(e) => setPreferences({ ...preferences, marketing: e.target.checked })}
                className="w-5 h-5 accent-primary cursor-pointer" 
              />
            </div>
          </div>
          
          <div className="mt-6 text-xs text-muted-foreground">
            {dict.consent?.readMore || "Read more about our"} <a href="#" className="underline text-primary">{dict.consent?.terms || "Terms"}</a> {dict.consent?.and || "and"} <a href="#" className="underline text-primary">{dict.consent?.privacy || "Privacy Policy"}</a>.
          </div>
        </div>

        <div className="border-t border-border p-4 bg-muted/20 flex justify-end gap-3 flex-wrap">
          <Button variant="outline" onClick={handleSavePreferences}>
            {dict.consent?.savePreferences || "Save Preferences"}
          </Button>
          <Button onClick={handleAcceptAll}>
            {dict.consent?.acceptAll || "Accept All"}
          </Button>
        </div>
      </div>
    </div>
  );
};
