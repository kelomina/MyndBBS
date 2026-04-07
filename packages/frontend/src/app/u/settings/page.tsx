'use client';

import React, { useState, useEffect } from 'react';
import { User, Shield, Monitor, Bell, Palette, Settings } from 'lucide-react';
import Link from 'next/link';
import { ProfileSettings } from '../../../components/ProfileSettings';
import { SecuritySettings } from '../../../components/SecuritySettings';
import { SessionManagement } from '../../../components/SessionManagement';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'sessions'>('profile');
  const [role, setRole] = useState<string>('USER');

  useEffect(() => {
    fetch('/api/v1/user/profile', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setRole(data.user.role);
        }
      })
      .catch(err => console.error('Failed to fetch user role', err));
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-foreground mb-8">Account Settings</h1>
      
      <div className="flex flex-col md:flex-row gap-8">
        {/* Settings Nav */}
        <nav className="w-full md:w-64 flex flex-col gap-1 shrink-0">
          <button 
            onClick={() => setActiveTab('profile')}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${activeTab === 'profile' ? 'bg-card text-foreground shadow-sm border border-border/50' : 'text-muted hover:bg-card hover:text-foreground'}`}
          >
            <User className="h-4 w-4" /> Basic Profile
          </button>
          <button 
            onClick={() => setActiveTab('security')}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${activeTab === 'security' ? 'bg-card text-foreground shadow-sm border border-border/50' : 'text-muted hover:bg-card hover:text-foreground'}`}
          >
            <Shield className="h-4 w-4" /> Security & Passkeys
          </button>
          <button 
            onClick={() => setActiveTab('sessions')}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${activeTab === 'sessions' ? 'bg-card text-foreground shadow-sm border border-border/50' : 'text-muted hover:bg-card hover:text-foreground'}`}
          >
            <Monitor className="h-4 w-4" /> Active Sessions
          </button>

          {/* Placeholders for future */}
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted/50 cursor-not-allowed">
            <Palette className="h-4 w-4" /> Appearance
          </button>
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted/50 cursor-not-allowed">
            <Bell className="h-4 w-4" /> Notifications
          </button>
          
          {role === 'ADMIN' && (
            <Link 
              href="/admin"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted hover:bg-card hover:text-foreground mt-4 border-t border-border pt-4"
            >
              <Settings className="h-4 w-4" /> Admin Dashboard
            </Link>
          )}
        </nav>

        {/* Settings Content Area */}
        <div className="flex-1">
          {activeTab === 'profile' && <ProfileSettings />}
          {activeTab === 'security' && <SecuritySettings />}
          {activeTab === 'sessions' && <SessionManagement />}
        </div>
      </div>
    </div>
  );
}
