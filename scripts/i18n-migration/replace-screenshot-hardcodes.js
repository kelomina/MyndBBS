const fs = require('fs');
const path = require('path');

const basePath = path.join(__dirname, 'packages/frontend/src');

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

// 1. ProfileTabs (Bookmarks)
replaceInFile(path.join(basePath, 'app/u/[username]/ProfileTabs.tsx'), [
  ["{dict.profile?.bookmarks || 'Bookmarks'}", "{dict.profile?.bookmarks}"]
]);

// 2. Category Page
const categoryPagePath = path.join(basePath, 'app/c/[category]/page.tsx');
let catContent = fs.readFileSync(categoryPagePath, 'utf8');
if (!catContent.includes('useTranslation')) {
  catContent = "import { useTranslation } from '../../../components/TranslationProvider';\n" + catContent;
  catContent = catContent.replace('export default function CategoryPage() {', 'export default function CategoryPage() {\n  const dict = useTranslation();');
  fs.writeFileSync(categoryPagePath, catContent);
}
replaceInFile(categoryPagePath, [
  ['<h1 className="text-2xl font-bold text-foreground capitalize">{categoryTitle} Posts</h1>', '<h1 className="text-2xl font-bold text-foreground capitalize">{categoryTitle} {dict.category?.postsTitle}</h1>'],
  ['<p className="text-sm text-muted">Showing posts for category: {categoryTitle}</p>', '<p className="text-sm text-muted">{dict.category?.showingPostsFor}{categoryTitle}</p>'],
  ['No posts found in this category.', '{dict.category?.noPostsFound}']
]);

// 3. UserNav (Settings, Logout)
const userNavPath = path.join(basePath, 'components/layout/UserNav.tsx');
let userNavContent = fs.readFileSync(userNavPath, 'utf8');
if (!userNavContent.includes('useTranslation')) {
  userNavContent = userNavContent.replace("import { User, LogOut, Settings, PlusCircle } from 'lucide-react';", "import { User, LogOut, Settings, PlusCircle } from 'lucide-react';\nimport { useTranslation } from '../TranslationProvider';");
  userNavContent = userNavContent.replace("export function UserNav({ title = \"Account\", newPostText = \"New Post\" }: { title?: string, newPostText?: string }) {", "export function UserNav({ title = \"Account\", newPostText = \"New Post\" }: { title?: string, newPostText?: string }) {\n  const dict = useTranslation();");
  fs.writeFileSync(userNavPath, userNavContent);
}
replaceInFile(userNavPath, [
  ['Settings', '{dict.common?.settings || "Settings"}'],
  ['Logout', '{dict.common?.logout || "Logout"}']
]);

// 4. Home page (No posts found.)
const homePagePath = path.join(basePath, 'app/page.tsx');
let homeContent = fs.readFileSync(homePagePath, 'utf8');
if (!homeContent.includes('useTranslation')) {
  homeContent = homeContent.replace("import Link from 'next/link';", "import Link from 'next/link';\nimport { useTranslation } from '../../components/TranslationProvider';");
  homeContent = homeContent.replace("export default function Home() {", "export default function Home() {\n  const dict = useTranslation();");
  fs.writeFileSync(homePagePath, homeContent);
}
replaceInFile(homePagePath, [
  ['No posts found.', '{dict.category?.noPostsFoundGeneral || "No posts found."}']
]);

