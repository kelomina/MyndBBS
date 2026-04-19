'use client';

import React, { useEffect, useState } from 'react';
import { useTranslation } from './TranslationProvider';
import { Button } from './ui/Button';
import { useToast } from './ui/Toast';
import Link from 'next/link';
import { ExternalLink, ShieldCheck } from 'lucide-react';

export const PrivacySettings = () => {
  const dict = useTranslation();
  const { toast } = useToast();
  const [preferences, setPreferences] = useState({
    essential: true,
    analytics: false,
    marketing: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/v1/user/profile', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.user && data.user.cookiePreferences) {
          setPreferences({
            essential: true,
            analytics: !!data.user.cookiePreferences.analytics,
            marketing: !!data.user.cookiePreferences.marketing,
          });
        }
      })
      .catch((err) => console.error('Failed to load preferences', err))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/v1/user/cookie-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ preferences }),
      });
      if (res.ok) {
        localStorage.setItem('myndbbs_cookie_consent', JSON.stringify(preferences));
        toast(dict.profile?.preferencesSaved || 'Preferences saved successfully!', 'success');
      } else {
        throw new Error('Failed to save');
      }
    } catch (e) {
      toast(dict.profile?.preferencesSaveError || 'Failed to save preferences.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Privacy Options / Cookie Preferences */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-border bg-muted/20">
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            {dict.profile?.privacyOptions || "Privacy & Cookie Preferences"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {dict.consent?.description || "Manage your cookie preferences. These preferences will sync with your account."}
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/10">
            <div>
              <h3 className="font-medium text-foreground">{dict.consent?.essential || "Essential Cookies"}</h3>
              <p className="text-sm text-muted-foreground mt-1">{dict.consent?.essentialDesc || "Required for the website to function properly."}</p>
            </div>
            <input type="checkbox" checked disabled className="w-5 h-5 accent-primary cursor-not-allowed opacity-50" />
          </div>

          <div className="flex items-center justify-between p-4 border border-border rounded-lg">
            <div>
              <h3 className="font-medium text-foreground">{dict.consent?.analytics || "Analytics Cookies"}</h3>
              <p className="text-sm text-muted-foreground mt-1">{dict.consent?.analyticsDesc || "Help us understand how visitors interact with the website."}</p>
            </div>
            <input
              type="checkbox"
              checked={preferences.analytics}
              onChange={(e) => setPreferences({ ...preferences, analytics: e.target.checked })}
              className="w-5 h-5 accent-primary cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-4 border border-border rounded-lg">
            <div>
              <h3 className="font-medium text-foreground">{dict.consent?.marketing || "Marketing Cookies"}</h3>
              <p className="text-sm text-muted-foreground mt-1">{dict.consent?.marketingDesc || "Used to deliver relevant advertisements."}</p>
            </div>
            <input
              type="checkbox"
              checked={preferences.marketing}
              onChange={(e) => setPreferences({ ...preferences, marketing: e.target.checked })}
              className="w-5 h-5 accent-primary cursor-pointer"
            />
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (dict.common?.save || "Saving...") : (dict.consent?.savePreferences || "Save Preferences")}
            </Button>
          </div>
        </div>
      </div>

      {/* Legal Links */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-border bg-muted/20">
          <h2 className="text-xl font-semibold text-foreground">
            {dict.profile?.legalDocuments || "Legal Documents"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {dict.profile?.legalDesc || "Review our terms of service and privacy policy."}
          </p>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <Link href="/terms" className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors group">
            <span className="font-medium text-foreground">{dict.consent?.terms || "Terms of Service"}</span>
            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
          </Link>
          <Link href="/privacy" className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors group">
            <span className="font-medium text-foreground">{dict.consent?.privacy || "Privacy Policy"}</span>
            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
          </Link>
        </div>
      </div>
    </div>
  );
};
