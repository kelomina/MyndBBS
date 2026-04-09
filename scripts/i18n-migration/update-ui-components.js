const fs = require('fs');
const path = require('path');

const zhDictPath = path.join(__dirname, 'packages/frontend/src/i18n/dictionaries/zh.json');
const enDictPath = path.join(__dirname, 'packages/frontend/src/i18n/dictionaries/en.json');

const zhDict = JSON.parse(fs.readFileSync(zhDictPath, 'utf8'));
const enDict = JSON.parse(fs.readFileSync(enDictPath, 'utf8'));

zhDict.common.toggleLanguage = "切换语言";
enDict.common.toggleLanguage = "Toggle Language";

zhDict.common.toggleTheme = "切换主题";
enDict.common.toggleTheme = "Toggle Theme";

fs.writeFileSync(zhDictPath, JSON.stringify(zhDict, null, 2), 'utf8');
fs.writeFileSync(enDictPath, JSON.stringify(enDict, null, 2), 'utf8');

// ThemeToggle.tsx
let themePath = path.join(__dirname, 'packages/frontend/src/components/ThemeToggle.tsx');
let themeCode = fs.readFileSync(themePath, 'utf8');
themeCode = themeCode.replace(`import { useTheme } from 'next-themes';`, `import { useTheme } from 'next-themes';\nimport { useTranslation } from './TranslationProvider';`);
themeCode = themeCode.replace(`export function ThemeToggle() {`, `export function ThemeToggle() {\n  const dict = useTranslation();`);
themeCode = themeCode.replace(`title="Toggle Theme"`, `title={dict.common.toggleTheme}`);
themeCode = themeCode.replace(`>Toggle Theme</span>`, `>{dict.common.toggleTheme}</span>`);
fs.writeFileSync(themePath, themeCode, 'utf8');

// LanguageSwitcher.tsx
let langPath = path.join(__dirname, 'packages/frontend/src/components/LanguageSwitcher.tsx');
let langCode = fs.readFileSync(langPath, 'utf8');
langCode = langCode.replace(`import { Locale } from '../i18n/config';`, `import { Locale } from '../i18n/config';\nimport { useTranslation } from './TranslationProvider';`);
langCode = langCode.replace(`export function LanguageSwitcher({ currentLocale }: { currentLocale: Locale }) {`, `export function LanguageSwitcher({ currentLocale }: { currentLocale: Locale }) {\n  const dict = useTranslation();`);
langCode = langCode.replace(`title={currentLocale === 'en' ? 'Switch to Chinese' : '切换至英文'}`, `title={dict.common.toggleLanguage}`);
langCode = langCode.replace(`>Toggle Language</span>`, `>{dict.common.toggleLanguage}</span>`);
fs.writeFileSync(langPath, langCode, 'utf8');
