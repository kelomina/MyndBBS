import { Fingerprint, Shield, User, Bell, Palette } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-foreground mb-8">Settings</h1>
      
      <div className="flex flex-col md:flex-row gap-8">
        {/* Settings Nav */}
        <nav className="w-full md:w-64 flex flex-col gap-1 shrink-0">
          <a href="#" className="flex items-center gap-3 rounded-lg bg-card px-3 py-2.5 text-sm font-medium text-foreground shadow-sm border border-border/50">
            <User className="h-4 w-4" /> Profile
          </a>
          <a href="#" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted hover:bg-card hover:text-foreground transition-colors">
            <Shield className="h-4 w-4" /> Security & Passkeys
          </a>
          <a href="#" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted hover:bg-card hover:text-foreground transition-colors">
            <Palette className="h-4 w-4" /> Appearance
          </a>
          <a href="#" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted hover:bg-card hover:text-foreground transition-colors">
            <Bell className="h-4 w-4" /> Notifications
          </a>
        </nav>

        {/* Settings Content Area */}
        <div className="flex-1 space-y-8">
          {/* Mocking the Security Tab as it's the most critical for our features */}
          <div className="rounded-xl bg-card p-6 shadow-sm border border-border/50">
            <h2 className="text-xl font-bold text-foreground mb-1">Security & Passkeys</h2>
            <p className="text-sm text-muted mb-6">Manage your password and secure passwordless login methods.</p>
            
            <div className="space-y-6">
              <div className="pb-6 border-b border-border">
                <h3 className="text-sm font-medium text-foreground mb-4">Change Password</h3>
                <div className="space-y-4 max-w-md">
                  <input type="password" placeholder="Current Password" className="block w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
                  <input type="password" placeholder="New Password" className="block w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
                  <button className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition-colors">Update Password</button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-foreground mb-4">Passkeys</h3>
                <p className="text-sm text-muted mb-4">Passkeys allow you to securely sign in using your device&apos;s fingerprint, face scan, or screen lock.</p>
                
                <div className="rounded-lg border border-border bg-background p-4 flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Fingerprint className="h-8 w-8 text-primary" />
                    <div>
                      <div className="text-sm font-medium text-foreground">MacBook Pro Touch ID</div>
                      <div className="text-xs text-muted">Added Apr 6, 2026 • Last used today</div>
                    </div>
                  </div>
                  <button className="text-sm text-red-500 hover:text-red-600 font-medium">Remove</button>
                </div>

                <button className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-background transition-colors">
                  <Fingerprint className="h-4 w-4" /> Add New Passkey
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
