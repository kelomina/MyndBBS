const fs = require('fs');
const path = require('path');

const basePath = path.join(__dirname, 'packages/frontend/src');

function injectUseTranslation(filePath, componentDeclaration) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('useTranslation')) {
    if (content.includes("import { useState")) {
      content = content.replace(/import \{ useState[^}]*\} from 'react';/, "$&\nimport { useTranslation } from '../../../components/TranslationProvider';");
    } else if (content.includes("import Link from 'next/link';")) {
      content = content.replace("import Link from 'next/link';", "import Link from 'next/link';\nimport { useTranslation } from '../../../components/TranslationProvider';");
    } else {
      content = "import { useTranslation } from '../../../components/TranslationProvider';\n" + content;
    }
    
    // Sometimes the import path is different depending on depth
    let depth = (filePath.match(/\//g) || []).length - (basePath.match(/\//g) || []).length;
    let importPath = '../'.repeat(depth - 1) + 'components/TranslationProvider';
    content = content.replace(/import \{ useTranslation \} from '.*?';/, `import { useTranslation } from '${importPath}';`);
    
    content = content.replace(componentDeclaration, componentDeclaration + "\n  const dict = useTranslation();");
    fs.writeFileSync(filePath, content);
    console.log(`Injected useTranslation in ${filePath}`);
  }
}

injectUseTranslation(path.join(basePath, 'app/admin/categories/page.tsx'), 'export default function CategoriesPage() {');
injectUseTranslation(path.join(basePath, 'app/admin/users/page.tsx'), 'export default function UsersPage() {');
injectUseTranslation(path.join(basePath, 'app/admin/layout.tsx'), 'export default function AdminLayout({ children }: { children: React.ReactNode }) {');
injectUseTranslation(path.join(basePath, 'app/recent/page.tsx'), 'export default function RecentPage() {');
injectUseTranslation(path.join(basePath, 'app/popular/page.tsx'), 'export default function PopularPage() {');
injectUseTranslation(path.join(basePath, 'components/ui/Modal.tsx'), 'export function Modal({ isOpen, onClose, title, children }: ModalProps) {');
injectUseTranslation(path.join(basePath, 'app/u/[username]/ProfileTabs.tsx'), 'export function ProfileTabs({ username, initialPosts }: { username: string, initialPosts: any[] }) {');
injectUseTranslation(path.join(basePath, 'app/compose/ComposeForm.tsx'), 'export function ComposeForm({ categories }: { categories: any[] }) {');
injectUseTranslation(path.join(basePath, 'app/p/[id]/CommentsSection.tsx'), 'export function CommentsSection({ postId, initialComments }: { postId: number, initialComments: any[] }) {');

// Update dictionaries
const zhDictPath = path.join(basePath, 'i18n/dictionaries/zh.json');
const enDictPath = path.join(basePath, 'i18n/dictionaries/en.json');

const zhDict = JSON.parse(fs.readFileSync(zhDictPath, 'utf8'));
const enDict = JSON.parse(fs.readFileSync(enDictPath, 'utf8'));

// Common
Object.assign(zhDict.common, {
  loading: "加载中...",
  cancel: "取消",
  close: "关闭"
});
Object.assign(enDict.common, {
  loading: "Loading...",
  cancel: "Cancel",
  close: "Close"
});

// Admin
zhDict.admin = {
  categoryManagement: "分类管理",
  categoryDesc: "创建并管理论坛分类及版主。",
  createCategory: "创建分类",
  order: "排序",
  name: "名称",
  description: "描述",
  moderators: "版主",
  actions: "操作",
  sortOrder: "排序权重",
  create: "创建",
  selectUser: "选择用户",
  userManagement: "用户管理",
  userDesc: "管理系统用户及其角色与状态。",
  username: "用户名",
  email: "邮箱",
  role: "角色",
  status: "状态",
  registered: "注册时间",
  users: "用户",
  categories: "分类节点"
};
enDict.admin = {
  categoryManagement: "Category Management",
  categoryDesc: "Create and manage forum categories and moderators.",
  createCategory: "Create Category",
  order: "Order",
  name: "Name",
  description: "Description",
  moderators: "Moderators",
  actions: "Actions",
  sortOrder: "Sort Order",
  create: "Create",
  selectUser: "Select User",
  userManagement: "User Management",
  userDesc: "Manage system users, their roles and statuses.",
  username: "Username",
  email: "Email",
  role: "Role",
  status: "Status",
  registered: "Registered",
  users: "Users",
  categories: "Categories"
};

// Home overrides
zhDict.home = zhDict.home || {};
zhDict.home.recentDesc = "显示平台上最新发布的帖子";
zhDict.home.popularDesc = "显示平台上最受欢迎的帖子";

enDict.home = enDict.home || {};
enDict.home.recentDesc = "Showing the newest posts on the platform";
enDict.home.popularDesc = "Showing the most popular posts on the platform";

// Post overrides
zhDict.post = zhDict.post || {};
zhDict.post.verifyToPublish = "验证以发布";
zhDict.post.verifyToPostComment = "验证以发表评论";
zhDict.post.replyingTo = "回复";

enDict.post = enDict.post || {};
enDict.post.verifyToPublish = "Verify to Publish";
enDict.post.verifyToPostComment = "Verify to Post Comment";
enDict.post.replyingTo = "Replying to";

fs.writeFileSync(zhDictPath, JSON.stringify(zhDict, null, 2), 'utf8');
fs.writeFileSync(enDictPath, JSON.stringify(enDict, null, 2), 'utf8');
console.log('Dictionaries updated!');
