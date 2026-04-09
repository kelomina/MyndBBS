const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  for (const [search, replace] of replacements) {
    if (typeof search === 'string') {
      content = content.split(search).join(replace);
    } else {
      content = content.replace(search, replace);
    }
  }
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

const basePath = path.join(__dirname, 'packages/frontend/src');

// 1. Auth components
replaceInFile(path.join(basePath, 'app/(auth)/login/LoginClient.tsx'), [
  ["setError(data.error || 'Login failed')", "setError(data.error || dict.auth.loginFailed)"],
  ["setError('Network error')", "setError(dict.auth.networkError)"],
  ["throw new Error(optionsData.error || 'Failed to generate passkey options')", "throw new Error(optionsData.error || dict.auth.passkeyError)"],
  ["{loading ? 'Signing in...' : dict.auth.signIn}", "{loading ? dict.auth.signingIn : dict.auth.signIn}"]
]);

replaceInFile(path.join(basePath, 'app/(auth)/register/RegisterClient.tsx'), [
  ["setError(data.error || 'Registration failed')", "setError(data.error || dict.auth.registrationFailed)"],
  ["setError('Network error')", "setError(dict.auth.networkError)"],
  ["{loading ? 'Creating...' : dict.auth.createAccount}", "{loading ? dict.auth.creating : dict.auth.createAccount}"]
]);

// 2. Admin pages
// Wait, admin pages need useTranslation
const adminCategoriesPath = path.join(basePath, 'app/admin/categories/page.tsx');
let adminCategoriesContent = fs.readFileSync(adminCategoriesPath, 'utf8');
if (!adminCategoriesContent.includes('useTranslation')) {
  adminCategoriesContent = adminCategoriesContent.replace("import { useState, useEffect } from 'react';", "import { useState, useEffect } from 'react';\nimport { useTranslation } from '../../../components/TranslationProvider';");
  adminCategoriesContent = adminCategoriesContent.replace("export default function CategoriesManagement() {", "export default function CategoriesManagement() {\n  const dict = useTranslation();");
  fs.writeFileSync(adminCategoriesPath, adminCategoriesContent);
}
replaceInFile(adminCategoriesPath, [
  ['<div className="p-8 text-center text-muted">Loading...</div>', '<div className="p-8 text-center text-muted">{dict.common?.loading || "Loading..."}</div>'],
  ['<h1 className="text-2xl font-bold tracking-tight">Category Management</h1>', '<h1 className="text-2xl font-bold tracking-tight">{dict.admin?.categoryManagement || "Category Management"}</h1>'],
  ['<p className="text-muted">Create and manage forum categories and moderators.</p>', '<p className="text-muted">{dict.admin?.categoryDesc || "Create and manage forum categories and moderators."}</p>'],
  ['<Button onClick={() => setIsCreateModalOpen(true)}>Create Category</Button>', '<Button onClick={() => setIsCreateModalOpen(true)}>{dict.admin?.createCategory || "Create Category"}</Button>'],
  ['<TableHead>Order</TableHead>', '<TableHead>{dict.admin?.order || "Order"}</TableHead>'],
  ['<TableHead>Name</TableHead>', '<TableHead>{dict.admin?.name || "Name"}</TableHead>'],
  ['<TableHead>Description</TableHead>', '<TableHead>{dict.admin?.description || "Description"}</TableHead>'],
  ['<TableHead>Moderators</TableHead>', '<TableHead>{dict.admin?.moderators || "Moderators"}</TableHead>'],
  ['<TableHead className="text-right">Actions</TableHead>', '<TableHead className="text-right">{dict.admin?.actions || "Actions"}</TableHead>'],
  ['<label className="text-sm font-medium">Name</label>', '<label className="text-sm font-medium">{dict.admin?.name || "Name"}</label>'],
  ['<label className="text-sm font-medium">Description</label>', '<label className="text-sm font-medium">{dict.admin?.description || "Description"}</label>'],
  ['<label className="text-sm font-medium">Sort Order</label>', '<label className="text-sm font-medium">{dict.admin?.sortOrder || "Sort Order"}</label>'],
  ['<Button type="submit">Create</Button>', '<Button type="submit">{dict.admin?.create || "Create"}</Button>'],
  ['<label className="text-sm font-medium">Select User</label>', '<label className="text-sm font-medium">{dict.admin?.selectUser || "Select User"}</label>']
]);

const adminUsersPath = path.join(basePath, 'app/admin/users/page.tsx');
let adminUsersContent = fs.readFileSync(adminUsersPath, 'utf8');
if (!adminUsersContent.includes('useTranslation')) {
  adminUsersContent = adminUsersContent.replace("import { useState, useEffect } from 'react';", "import { useState, useEffect } from 'react';\nimport { useTranslation } from '../../../components/TranslationProvider';");
  adminUsersContent = adminUsersContent.replace("export default function UsersManagement() {", "export default function UsersManagement() {\n  const dict = useTranslation();");
  fs.writeFileSync(adminUsersPath, adminUsersContent);
}
replaceInFile(adminUsersPath, [
  ['<div className="p-8 text-center text-muted">Loading...</div>', '<div className="p-8 text-center text-muted">{dict.common?.loading || "Loading..."}</div>'],
  ['<h1 className="text-2xl font-bold tracking-tight">User Management</h1>', '<h1 className="text-2xl font-bold tracking-tight">{dict.admin?.userManagement || "User Management"}</h1>'],
  ['<p className="text-muted">Manage system users, their roles and statuses.</p>', '<p className="text-muted">{dict.admin?.userDesc || "Manage system users, their roles and statuses."}</p>'],
  ['<TableHead>Username</TableHead>', '<TableHead>{dict.admin?.username || "Username"}</TableHead>'],
  ['<TableHead>Email</TableHead>', '<TableHead>{dict.admin?.email || "Email"}</TableHead>'],
  ['<TableHead>Role</TableHead>', '<TableHead>{dict.admin?.role || "Role"}</TableHead>'],
  ['<TableHead>Status</TableHead>', '<TableHead>{dict.admin?.status || "Status"}</TableHead>'],
  ['<TableHead>Registered</TableHead>', '<TableHead>{dict.admin?.registered || "Registered"}</TableHead>'],
  ['<TableHead>Actions</TableHead>', '<TableHead>{dict.admin?.actions || "Actions"}</TableHead>']
]);

const adminLayoutPath = path.join(basePath, 'app/admin/layout.tsx');
let adminLayoutContent = fs.readFileSync(adminLayoutPath, 'utf8');
if (!adminLayoutContent.includes('useTranslation')) {
  adminLayoutContent = adminLayoutContent.replace("import Link from 'next/link';", "import Link from 'next/link';\nimport { useTranslation } from '../../components/TranslationProvider';");
  adminLayoutContent = adminLayoutContent.replace("export default function AdminLayout({ children }: { children: React.ReactNode }) {", "export default function AdminLayout({ children }: { children: React.ReactNode }) {\n  const dict = useTranslation();");
  fs.writeFileSync(adminLayoutPath, adminLayoutContent);
}
replaceInFile(adminLayoutPath, [
  ['<span>Users</span>', '<span>{dict.admin?.users || "Users"}</span>'],
  ['<span>Categories</span>', '<span>{dict.admin?.categories || "Categories"}</span>']
]);

const recentPath = path.join(basePath, 'app/recent/page.tsx');
let recentContent = fs.readFileSync(recentPath, 'utf8');
if (!recentContent.includes('useTranslation')) {
  recentContent = recentContent.replace("import Link from 'next/link';", "import Link from 'next/link';\nimport { useTranslation } from '../../components/TranslationProvider';");
  recentContent = recentContent.replace("export default function RecentPage() {", "export default function RecentPage() {\n  const dict = useTranslation();");
  fs.writeFileSync(recentPath, recentContent);
}
replaceInFile(recentPath, [
  ['<p className="text-sm text-muted">Showing the newest posts on the platform</p>', '<p className="text-sm text-muted">{dict.home?.recentDesc || "Showing the newest posts on the platform"}</p>']
]);

const popularPath = path.join(basePath, 'app/popular/page.tsx');
let popularContent = fs.readFileSync(popularPath, 'utf8');
if (!popularContent.includes('useTranslation')) {
  popularContent = popularContent.replace("import Link from 'next/link';", "import Link from 'next/link';\nimport { useTranslation } from '../../components/TranslationProvider';");
  popularContent = popularContent.replace("export default function PopularPage() {", "export default function PopularPage() {\n  const dict = useTranslation();");
  fs.writeFileSync(popularPath, popularContent);
}
replaceInFile(popularPath, [
  ['<p className="text-sm text-muted">Showing the most popular posts on the platform</p>', '<p className="text-sm text-muted">{dict.home?.popularDesc || "Showing the most popular posts on the platform"}</p>']
]);

// Modal
const modalPath = path.join(basePath, 'components/ui/Modal.tsx');
let modalContent = fs.readFileSync(modalPath, 'utf8');
if (!modalContent.includes('useTranslation')) {
  modalContent = modalContent.replace("import { X } from 'lucide-react';", "import { X } from 'lucide-react';\nimport { useTranslation } from '../TranslationProvider';");
  modalContent = modalContent.replace("export function Modal({ isOpen, onClose, title, children }: ModalProps) {", "export function Modal({ isOpen, onClose, title, children }: ModalProps) {\n  const dict = useTranslation();");
  fs.writeFileSync(modalPath, modalContent);
}
replaceInFile(modalPath, [
  ['<span className="sr-only">Close</span>', '<span className="sr-only">{dict.common?.close || "Close"}</span>']
]);

// ProfileTabs Loading
const profileTabsPath = path.join(basePath, 'app/u/[username]/ProfileTabs.tsx');
let profileTabsContent = fs.readFileSync(profileTabsPath, 'utf8');
if (!profileTabsContent.includes('useTranslation')) {
  profileTabsContent = profileTabsContent.replace("import { formatDistanceToNow } from 'date-fns';", "import { formatDistanceToNow } from 'date-fns';\nimport { useTranslation } from '../../../components/TranslationProvider';");
  profileTabsContent = profileTabsContent.replace("export function ProfileTabs({ username, initialPosts }: { username: string, initialPosts: any[] }) {", "export function ProfileTabs({ username, initialPosts }: { username: string, initialPosts: any[] }) {\n  const dict = useTranslation();");
  fs.writeFileSync(profileTabsPath, profileTabsContent);
}
replaceInFile(profileTabsPath, [
  ['<p className="text-muted text-sm">Loading...</p>', '<p className="text-muted text-sm">{dict.common?.loading || "Loading..."}</p>']
]);

// Compose Verify to Publish
const composeFormPath = path.join(basePath, 'app/compose/ComposeForm.tsx');
let composeFormContent = fs.readFileSync(composeFormPath, 'utf8');
if (!composeFormContent.includes('useTranslation')) {
  composeFormContent = composeFormContent.replace("import { SliderCaptcha } from '../../components/SliderCaptcha';", "import { SliderCaptcha } from '../../components/SliderCaptcha';\nimport { useTranslation } from '../../components/TranslationProvider';");
  composeFormContent = composeFormContent.replace("export function ComposeForm({ categories }: { categories: any[] }) {", "export function ComposeForm({ categories }: { categories: any[] }) {\n  const dict = useTranslation();");
  fs.writeFileSync(composeFormPath, composeFormContent);
}
replaceInFile(composeFormPath, [
  ['<h3 className="text-lg font-bold mb-4 text-center">Verify to Publish</h3>', '<h3 className="text-lg font-bold mb-4 text-center">{dict.post?.verifyToPublish || "Verify to Publish"}</h3>']
]);

// CommentsSection
const commentsSectionPath = path.join(basePath, 'app/p/[id]/CommentsSection.tsx');
let commentsSectionContent = fs.readFileSync(commentsSectionPath, 'utf8');
if (!commentsSectionContent.includes('useTranslation')) {
  commentsSectionContent = commentsSectionContent.replace("import { SliderCaptcha } from '../../../components/SliderCaptcha';", "import { SliderCaptcha } from '../../../components/SliderCaptcha';\nimport { useTranslation } from '../../../components/TranslationProvider';");
  commentsSectionContent = commentsSectionContent.replace("export function CommentsSection({ postId, initialComments }: { postId: number, initialComments: any[] }) {", "export function CommentsSection({ postId, initialComments }: { postId: number, initialComments: any[] }) {\n  const dict = useTranslation();");
  fs.writeFileSync(commentsSectionPath, commentsSectionContent);
}
replaceInFile(commentsSectionPath, [
  ['<h3 className="text-lg font-bold mb-4 text-center">Verify to Post Comment</h3>', '<h3 className="text-lg font-bold mb-4 text-center">{dict.post?.verifyToPostComment || "Verify to Post Comment"}</h3>'],
  ['<span>Replying to <span className="font-medium text-foreground">{replyTo.username}</span></span>', '<span>{dict.post?.replyingTo || "Replying to"} <span className="font-medium text-foreground">{replyTo.username}</span></span>'],
  ['<button onClick={() => setReplyTo(null)} className="hover:text-foreground">Cancel</button>', '<button onClick={() => setReplyTo(null)} className="hover:text-foreground">{dict.common?.cancel || "Cancel"}</button>']
]);

console.log('All files processed.');
