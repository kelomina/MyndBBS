const fs = require('fs');
const path = require('path');

function replaceAll(content, search, replacement) {
  return content.split(search).join(replacement);
}

// 1. ProfileSettings.tsx
let profilePath = path.join(__dirname, 'packages/frontend/src/components/ProfileSettings.tsx');
let profileCode = fs.readFileSync(profilePath, 'utf8');

profileCode = replaceAll(profileCode, `import { User, Mail, Lock } from 'lucide-react';`, `import { User, Mail, Lock } from 'lucide-react';\nimport { useTranslation } from './TranslationProvider';`);
profileCode = replaceAll(profileCode, `export function ProfileSettings() {`, `export function ProfileSettings() {\n  const dict = useTranslation();`);

profileCode = replaceAll(profileCode, `'Profile updated successfully'`, `dict.settings.profileUpdated`);
profileCode = replaceAll(profileCode, `'Failed to update profile'`, `dict.settings.failedUpdateProfile`);
profileCode = replaceAll(profileCode, `'Network error'`, `dict.auth.networkError`);

profileCode = replaceAll(profileCode, `if (loading) return <div className="text-sm text-muted">Loading profile...</div>;`, `if (loading) return <div className="text-sm text-muted">{dict.settings.loadingProfile}</div>;`);
profileCode = replaceAll(profileCode, `>Basic Profile</h2>`, `>{dict.profile.basicProfile}</h2>`);
profileCode = replaceAll(profileCode, `>Manage your public profile and login details.</p>`, `>{dict.settings.manageProfile}</p>`);
profileCode = replaceAll(profileCode, `>Username</label>`, `>{dict.settings.username}</label>`);
profileCode = replaceAll(profileCode, `>Email</label>`, `>{dict.settings.email}</label>`);
profileCode = replaceAll(profileCode, `>Change Password</label>`, `>{dict.settings.changePassword}</label>`);
profileCode = replaceAll(profileCode, `>Leave blank to keep your current password.</p>`, `>{dict.settings.leaveBlankToKeep}</p>`);
profileCode = replaceAll(profileCode, `placeholder="New Password"`, `placeholder={dict.settings.newPassword}`);
profileCode = replaceAll(profileCode, `{saving ? 'Saving...' : 'Save Changes'}`, `{saving ? dict.settings.saving : dict.settings.saveChanges}`);

fs.writeFileSync(profilePath, profileCode, 'utf8');

// 2. SecuritySettings.tsx
let securityPath = path.join(__dirname, 'packages/frontend/src/components/SecuritySettings.tsx');
let securityCode = fs.readFileSync(securityPath, 'utf8');

securityCode = replaceAll(securityCode, `import { TwoFactorSetup } from './TwoFactorSetup';`, `import { TwoFactorSetup } from './TwoFactorSetup';\nimport { useTranslation } from './TranslationProvider';`);
securityCode = replaceAll(securityCode, `export function SecuritySettings() {`, `export function SecuritySettings() {\n  const dict = useTranslation();`);

securityCode = replaceAll(securityCode, `'Passkey added successfully'`, `dict.settings.passkeyAdded`);
securityCode = replaceAll(securityCode, `'Failed to verify passkey'`, `dict.auth.passkeyVerificationFailed`);
securityCode = replaceAll(securityCode, `'An error occurred adding passkey'`, `dict.auth.passkeyError`);

securityCode = replaceAll(securityCode, `if (!confirm('Are you sure you want to remove this passkey?')) return;`, `if (!confirm(dict.settings.confirmRemovePasskey)) return;`);
securityCode = replaceAll(securityCode, `'Passkey removed successfully'`, `dict.settings.passkeyRemoved`);

securityCode = replaceAll(securityCode, `if (!confirm('Are you sure you want to disable Authenticator App (TOTP)?')) return;`, `if (!confirm(dict.settings.confirmDisableTotp)) return;`);
securityCode = replaceAll(securityCode, `'Authenticator App disabled successfully'`, `dict.settings.totpDisabled`);

securityCode = replaceAll(securityCode, `if (loading) return <div className="text-sm text-muted">Loading security settings...</div>;`, `if (loading) return <div className="text-sm text-muted">{dict.settings.loadingSecurity}</div>;`);
securityCode = replaceAll(securityCode, `>Security & Passkeys</h2>`, `>{dict.profile.securityPasskeys}</h2>`);
securityCode = replaceAll(securityCode, `>Manage your two-factor authentication and passwordless login methods.</p>`, `>{dict.settings.manageSecurity}</p>`);
securityCode = replaceAll(securityCode, `>Passkeys</h3>`, `>{dict.settings.passkeys}</h3>`);
securityCode = replaceAll(securityCode, `>Passkeys allow you to securely sign in using your device&apos;s fingerprint, face scan, or screen lock.</p>`, `>{dict.settings.passkeysDesc}</p>`);
securityCode = replaceAll(securityCode, `>No passkeys registered yet.</p>`, `>{dict.settings.noPasskeys}</p>`);

securityCode = replaceAll(securityCode, `>Added {`, `>{dict.settings.added} {`);
securityCode = replaceAll(securityCode, `title="Remove Passkey"`, `title={dict.settings.removePasskey}`);
securityCode = replaceAll(securityCode, `> Add New Passkey`, `> {dict.settings.addNewPasskey}`);
securityCode = replaceAll(securityCode, `>Authenticator App (TOTP)</h3>`, `>{dict.settings.totpTitle}</h3>`);
securityCode = replaceAll(securityCode, `>Use an authenticator app (like Google Authenticator or Authy) to generate one-time codes for 2FA.</p>`, `>{dict.settings.totpDesc}</p>`);
securityCode = replaceAll(securityCode, `>Authenticator App Enabled</div>`, `>{dict.settings.totpEnabled}</div>`);
securityCode = replaceAll(securityCode, `>Your account is protected with 2FA</div>`, `>{dict.settings.accountProtected}</div>`);
securityCode = replaceAll(securityCode, `>Disable<`, `>{dict.settings.disable}<`);
securityCode = replaceAll(securityCode, `> Enable Authenticator App`, `> {dict.settings.enableTotp}`);
securityCode = replaceAll(securityCode, `>Cancel Setup<`, `>{dict.settings.cancelSetup}<`);

fs.writeFileSync(securityPath, securityCode, 'utf8');


// 3. SessionManagement.tsx
let sessionPath = path.join(__dirname, 'packages/frontend/src/components/SessionManagement.tsx');
let sessionCode = fs.readFileSync(sessionPath, 'utf8');

sessionCode = replaceAll(sessionCode, `import { Monitor, Trash2 } from 'lucide-react';`, `import { Monitor, Trash2 } from 'lucide-react';\nimport { useTranslation } from './TranslationProvider';`);
sessionCode = replaceAll(sessionCode, `export function SessionManagement() {`, `export function SessionManagement() {\n  const dict = useTranslation();`);

sessionCode = replaceAll(sessionCode, `'Error loading sessions'`, `dict.settings.failedFetchSessions`);
sessionCode = replaceAll(sessionCode, `if (!confirm('Are you sure you want to sign out of this session?')) return;`, `if (!confirm(dict.settings.confirmRevokeSession)) return;`);
sessionCode = replaceAll(sessionCode, `'Session revoked successfully'`, `dict.settings.sessionRevoked`);
sessionCode = replaceAll(sessionCode, `'Failed to revoke session'`, `dict.settings.failedRevokeSession`);

sessionCode = replaceAll(sessionCode, `if (loading) return <div className="text-sm text-muted">Loading sessions...</div>;`, `if (loading) return <div className="text-sm text-muted">{dict.settings.loadingSessions}</div>;`);
sessionCode = replaceAll(sessionCode, `>Active Sessions</h2>`, `>{dict.profile.activeSessions}</h2>`);
sessionCode = replaceAll(sessionCode, `>Manage devices currently logged into your account.</p>`, `>{dict.settings.manageSessions}</p>`);
sessionCode = replaceAll(sessionCode, `>No active sessions found.</p>`, `>{dict.settings.noActiveSessions}</p>`);
sessionCode = replaceAll(sessionCode, `'Unknown Device'`, `dict.settings.unknownDevice`);
sessionCode = replaceAll(sessionCode, `IP: {session.ipAddress || 'Unknown'} • Expires: {`, `IP: {session.ipAddress || dict.settings.unknownIp} • {dict.settings.expires}: {`);
sessionCode = replaceAll(sessionCode, `Started: {`, `{dict.settings.started}: {`);
sessionCode = replaceAll(sessionCode, `title="Sign out device"`, `title={dict.settings.signOutDevice}`);

fs.writeFileSync(sessionPath, sessionCode, 'utf8');
console.log('Settings replaced.');
