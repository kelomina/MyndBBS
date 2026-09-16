import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Sprint post-attachment-10mb / frontend acceptance surface.
 * 本 sprint 前端验收面。
 * Sources of truth: FREEZE-POST-ATTACHMENT-10MB.md (R1/R2/R3/R6/R7/R9),
 * DESIGN-POST-ATTACHMENT-10MB.md (§1.3/§1.4/§2.2/§2.3), PRD §4 AC-FE-1..5, AC-I18N-1..4.
 */

const POST_IMAGE_ENDPOINT = '/api/v1/messages/upload/post-image';
const POST_COPY_KEYS = ['image', 'imageTooLarge', 'imageUploading'];
const UPLOAD_ERROR_CODES = [
  'LIMIT_FILE_SIZE',
  'ERR_FILE_TYPE_NOT_ALLOWED',
  'ERR_FILE_CONTENT_TYPE_MISMATCH',
  'ERR_NO_FILE',
  'ERR_UPLOAD_FAILED',
];

async function loadContext() {
  const root = process.cwd();
  const [editorSrc, zhRaw, enRaw, sharedSrc] = await Promise.all([
    fs.readFile(path.join(root, 'src', 'components', 'PostEditor.tsx'), 'utf-8'),
    fs.readFile(path.join(root, 'src', 'i18n', 'dictionaries', 'zh.json'), 'utf-8'),
    fs.readFile(path.join(root, 'src', 'i18n', 'dictionaries', 'en.json'), 'utf-8'),
    fs.readFile(path.join(root, '..', 'shared', 'src', 'constants', 'index.ts'), 'utf-8'),
  ]);
  return { editorSrc, zh: JSON.parse(zhRaw), en: JSON.parse(enRaw), sharedSrc };
}

/**
 * Callers: [postImageSizeLimit tests]
 * Callees: []
 * Description: Reads a numeric shared constant out of `packages/shared/src/constants/index.ts`
 *   without importing TypeScript, supporting `a * b * c` products only.
 * 描述：不引入 TS 运行时，直接从 shared 常量源文件读出数值，仅支持 `a * b * c` 乘积形式。
 * Variables: `name` is the exported symbol; the returned number is its evaluated value.
 * 变量：`name` 为导出符号名；返回值为换算后的数字。
 * Integration: Keeps this test honest about the single source of truth (FREEZE R3).
 * 接入方式：让本测试真的校验单一真源（FREEZE R3）。
 * Error Handling: Returns undefined when the symbol is absent or not a plain product.
 * 错误处理：符号缺失或不是纯乘积时返回 undefined。
 * Keywords: single source, constant parse, shared, 单一真源
 */
function readSharedConstant(sharedSrc, name) {
  const match = sharedSrc.match(
    new RegExp(`export const ${name}\\s*=\\s*([0-9]+(?:\\s*\\*\\s*[0-9]+)*)`),
  );
  if (!match) return undefined;
  return match[1]
    .split('*')
    .map((part) => Number(part.trim()))
    .reduce((acc, value) => acc * value, 1);
}

function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    values[name] === undefined ? match : values[name],
  );
}

/**
 * Callers: [pre-check and 413 assertions below]
 * Callees: []
 * Description: Isolates `handleImageChange` from the render body so ordering assertions cannot
 *   match against JSX text.
 * 描述：只截出 `handleImageChange` 本体，避免顺序断言误匹配到 JSX 文本。
 * Variables: `src` is the component source; the return value is the handler block.
 * 变量：`src` 为组件源码，返回值为该处理函数片段。
 * Integration: Relies on the component top-level `return (` sitting at two-space indent.
 * 接入方式：依赖组件顶层 `return (` 为两空格缩进。
 * Error Handling: Throws when either marker disappears, which is a test failure worth having.
 * 错误处理：任一标记缺失即抛错，这本身就是一条该红的断言。
 * Keywords: source slice, handler, 源码定位
 */
function extractHandler(src) {
  const start = src.indexOf('const handleImageChange');
  const end = src.indexOf('\n  return (', start);
  assert.ok(start > -1 && end > start, 'handleImageChange block not found in PostEditor.tsx');
  return src.slice(start, end);
}

/**
 * Callers: [rounding and interpolation assertions below]
 * Callees: []
 * Description: Lifts one private helper out of PostEditor.tsx and evaluates it, so the test runs
 *   the shipped implementation instead of a second copy of the same arithmetic.
 * 描述：把组件内私有 helper 原样取出求值，测的是随包发布的实现，而不是另抄一份算法。
 * Variables: `name` is the function name; TS annotations are stripped for `new Function`.
 * 变量：`name` 为函数名；为 `new Function` 先剥掉 TS 类型标注。
 * Integration: Only used for the pure helpers `formatUploadSize` / `interpolate`.
 * 接入方式：仅用于纯函数 `formatUploadSize` 与 `interpolate`。
 * Error Handling: Throws when the function body cannot be located.
 * 错误处理：找不到函数体即抛错。
 * Keywords: helper extraction, single implementation, 取源求值, 不另抄口径
 */
function extractHelper(src, name) {
  const match = new RegExp(`function ${name}\\([\\s\\S]*?\\n\\}`).exec(src);
  assert.ok(match, `${name}() not found in PostEditor.tsx`);
  const js = match[0]
    .replace(/: Record<string, string>/g, '')
    .replace(/: string/g, '')
    .replace(/: number/g, '');
  // The helper closes over the module-level unit constant, so that declaration travels with it.
  // 该 helper 闭包引用模块级单位常量，取源时一并带上声明。
  const unitConstant = /const BYTES_PER_MB = [^;]+;/.exec(src)?.[0] ?? '';
  assert.ok(unitConstant, 'BYTES_PER_MB declaration not found');
  return new Function(`${unitConstant}\n${js}; return ${name};`)();
}

test('post image 10 MiB limit: copy, pre-check and 413 handling', async (t) => {
  const { editorSrc, zh, en, sharedSrc } = await loadContext();
  const maxBytes = readSharedConstant(sharedSrc, 'POST_ATTACHMENT_MAX_BYTES');

  await t.test('shared constant is the single numeric source and divides by 1 MiB', () => {
    assert.equal(maxBytes, 10485760, 'POST_ATTACHMENT_MAX_BYTES must stay 10 MiB (FREEZE R1)');
    assert.equal(maxBytes % (1024 * 1024), 0, 'display copy relies on whole-MB division (R7)');
    assert.equal(maxBytes / 1024 / 1024, 10);
  });

  await t.test('post.* and apiErrors.* keys exist in both locales (AC-I18N-1)', () => {
    for (const locale of ['zh', 'en']) {
      const dict = locale === 'zh' ? zh : en;
      for (const key of POST_COPY_KEYS) {
        const value = dict.post?.[key];
        assert.equal(
          typeof value === 'string' && value.trim().length > 0,
          true,
          `${locale}.post.${key} missing or empty`,
        );
        assert.notEqual(value, key, `${locale}.post.${key} must not equal the key name`);
      }
      for (const code of UPLOAD_ERROR_CODES) {
        const value = dict.apiErrors?.[code];
        assert.equal(
          typeof value === 'string' && value.trim().length > 0,
          true,
          `${locale}.apiErrors.${code} missing or empty`,
        );
        assert.notEqual(value, code, `${locale}.apiErrors.${code} must not equal the raw code`);
      }
    }
  });

  await t.test('post and apiErrors sections stay key-symmetric across locales', () => {
    for (const section of ['post', 'apiErrors']) {
      const zhKeys = Object.keys(zh[section]).sort();
      const enKeys = Object.keys(en[section]).sort();
      assert.deepEqual(enKeys, zhKeys, `${section} keys drifted between zh.json and en.json`);
    }
  });

  await t.test('limit number is interpolated, never hardcoded into copy (R7 / AC-I18N-3)', () => {
    const sizeLabel = String(maxBytes / 1024 / 1024);
    for (const locale of ['zh', 'en']) {
      const dict = locale === 'zh' ? zh : en;
      assert.match(dict.post.image, /\{maxMB\}/, `${locale}.post.image must use {maxMB}`);
      assert.match(dict.post.imageTooLarge, /\{maxMB\}/);
      assert.match(dict.post.imageTooLarge, /\{size\}/, `${locale} over-limit copy must echo {size}`);
      for (const key of POST_COPY_KEYS) {
        const value = dict.post[key];
        assert.doesNotMatch(value, /10MB|10 MiB|10485760|10,000,000/, `${locale}.post.${key} hardcodes the number`);
        assert.doesNotMatch(value, /…/, `${locale}.post.${key} must use three dots, not an ellipsis char`);
      }
      // Rendered shapes the user actually sees, derived from the constant.
      assert.equal(
        fill(dict.post.image, { maxMB: sizeLabel }),
        locale === 'zh' ? '插入图片（单张不超过 10MB）' : 'Insert image (up to 10MB each)',
      );
      assert.equal(
        fill(dict.post.imageTooLarge, { maxMB: sizeLabel, size: '12.6MB' }),
        locale === 'zh'
          ? '图片超过 10MB 上限（当前 12.6MB），请压缩后再上传。'
          : 'Image is over the 10MB limit (currently 12.6MB). Please compress it and try again.',
      );
    }
  });

  await t.test('apiErrors stays placeholder-free so no surface can print raw braces', () => {
    for (const locale of ['zh', 'en']) {
      const dict = locale === 'zh' ? zh : en;
      for (const [code, value] of Object.entries(dict.apiErrors)) {
        assert.doesNotMatch(value, /\{[^}]+\}/, `${locale}.apiErrors.${code} carries an unfilled placeholder`);
      }
    }
  });

  await t.test('PostEditor imports the constant instead of duplicating it (AC-BE-3)', () => {
    assert.match(editorSrc, /import \{ POST_ATTACHMENT_MAX_BYTES \} from '@myndbbs\/shared';/);
    assert.doesNotMatch(editorSrc, /10 \* 1024 \* 1024|10485760|10MB|10 MiB/);
    assert.doesNotMatch(editorSrc, /window\.alert/);
  });

  await t.test('pre-check refuses only strictly over the inclusive ceiling (AC-FE-1/2/3, R2)', () => {
    assert.match(editorSrc, /if \(file\.size > POST_ATTACHMENT_MAX_BYTES\) \{/);
    assert.doesNotMatch(editorSrc, /file\.size >= POST_ATTACHMENT_MAX_BYTES/);
    assert.doesNotMatch(editorSrc, /file\.size < POST_ATTACHMENT_MAX_BYTES/);

    const handler = extractHandler(editorSrc);
    const guard = handler.slice(
      handler.indexOf('if (file.size > POST_ATTACHMENT_MAX_BYTES)'),
      handler.indexOf('setUploadingImage(true)'),
    );
    // Local rejection keeps the {size} echo copy (DESIGN §7.1 routing fix).
    // 本地拒绝保留 {size} 回显文案（DESIGN §7.1 路由修正）。
    assert.match(
      guard,
      /setImageNotice\(\{\s*status: 'tooLarge',\s*text: localOverLimitText\(formatUploadSize\(file\.size\)\),?\s*\}\)/,
    );
    // UI walkthrough item 5: without the reset, re-picking the same file fires no change event.
    // 走查第 5 条：不清 value 的话，重选同一个文件不会触发 change。
    assert.match(guard, /event\.target\.value = '';/);
    assert.ok(!guard.includes('fetchWithAuth'), 'rejected file must not reach the network');
    assert.ok(
      handler.indexOf('fetchWithAuth') > handler.indexOf('setUploadingImage(true)'),
      'the only request must be issued after the local checks',
    );
  });

  await t.test('413 shows the server-code copy with no size echo (DESIGN §7.1 / D2, R9)', () => {
    const handler = extractHandler(editorSrc);
    const branch = handler.slice(handler.indexOf('if (res.status === 413)'), handler.indexOf('throw new Error(data.error'));
    assert.match(branch, /setImageNotice\(\{ status: 'tooLarge', text: serverOverLimitText\(\) \}\)/);
    assert.match(branch, /return;/);
    assert.ok(!branch.includes('ERR_UPLOAD_FAILED'), '413 must not degrade to the upload-failed copy');
    assert.ok(!branch.includes('formatUploadSize'), '413 must not echo a local byte count');
    assert.ok(!branch.includes('imageTooLarge'), '413 must not reuse the {size} echo copy');
    assert.match(
      editorSrc,
      /const serverOverLimitText = \(\) =>\s*\n\s*apiErrors\.LIMIT_FILE_SIZE \|\|/,
      'the 413 sentence must come from the server code entry',
    );
    // Only the local pre-check may render the {size} echo copy, so the two builders stay distinct
    // and stay synonymous (R7), never one string reused for both paths.
    // 只有本地预校验可渲染 {size} 回显文案，两个 builder 必须分开：同义而不同串（R7）。
    assert.equal(editorSrc.match(/postDict\.imageTooLarge/g)?.length, 1);
    assert.equal(editorSrc.match(/apiErrors\.LIMIT_FILE_SIZE/g)?.length, 1);
    assert.equal(editorSrc.match(/setImageNotice\(\{\s*status: 'tooLarge'/g)?.length, 2);
  });

  await t.test('size echo rounds up in both branches so over-limit never reads as the limit (D3)', () => {
    // This subtest renders the ceiling number, so pin the cross-package input first: a torn read
    // while @backend-dev edits shared would otherwise surface as a confusing string diff.
    // 本子测会渲染上限数字，先钉住跨包输入：@backend-dev 正在改 shared 时读到中间态，
    // 否则只会表现成一个看不懂的字符串差异。
    assert.equal(maxBytes, 10485760, 'shared POST_ATTACHMENT_MAX_BYTES drifted while reading it');
    const formatUploadSize = extractHelper(editorSrc, 'formatUploadSize');
    assert.equal(formatUploadSize(10485761), '10.1MB', 'one byte over the ceiling must not read 10.0MB');
    assert.equal(formatUploadSize(10485760), '10.0MB');
    assert.equal(formatUploadSize(10485759), '10.0MB');
    assert.equal(formatUploadSize(5242880), '5.0MB');
    assert.equal(formatUploadSize(13212058), '12.7MB');
    assert.equal(formatUploadSize(819200), '800KB');
    assert.equal(formatUploadSize(1025), '2KB', 'the KB branch must round up too, no split rule');
    assert.equal(formatUploadSize(1024), '1KB');
    assert.equal(formatUploadSize(123), '1KB');
    assert.equal(formatUploadSize(0), '0KB');
    // Every output must carry a unit: no raw byte counts reach the UI (DESIGN §1.4).
    // 任何输出都必须带单位，裸字节不得示人（DESIGN §1.4）。
    assert.match(formatUploadSize(12345), /^\d+(\.\d+)?(MB|KB)$/, 'unit required');
    assert.equal(formatUploadSize(12345), '13KB');
    // Rendered local rejection line for the exact boundary +1, as the walkthrough demands.
    // 走查要求的边界 +1 实际渲染句。
    const interpolate = extractHelper(editorSrc, 'interpolate');
    assert.equal(
      interpolate(zh.post.imageTooLarge, {
        maxMB: String(maxBytes / 1024 / 1024),
        size: formatUploadSize(10485761),
      }),
      '图片超过 10MB 上限（当前 10.1MB），请压缩后再上传。',
    );
    assert.equal(
      interpolate(en.post.imageTooLarge, {
        maxMB: String(maxBytes / 1024 / 1024),
        size: formatUploadSize(10485761),
      }),
      'Image is over the 10MB limit (currently 10.1MB). Please compress it and try again.',
    );
  });

  await t.test('server-code copy is context-free: no digits, no braces, no image wording (§7.1-1)', () => {
    for (const locale of ['zh', 'en']) {
      const dict = locale === 'zh' ? zh : en;
      const value = dict.apiErrors.LIMIT_FILE_SIZE;
      assert.doesNotMatch(value, /[0-9]/, `${locale} LIMIT_FILE_SIZE must not name a number`);
      assert.doesNotMatch(value, /\{[^}]+\}/, `${locale} LIMIT_FILE_SIZE must stay placeholder-free`);
      assert.doesNotMatch(value, /图片|压缩|image|compress/i, `${locale} LIMIT_FILE_SIZE must stay file-typed`);
    }
    assert.equal(
      zh.apiErrors.LIMIT_FILE_SIZE,
      '文件体积超出上传上限，请改用更小的文件后重试。',
    );
    assert.equal(
      en.apiErrors.LIMIT_FILE_SIZE,
      'The file is larger than the upload limit. Please choose a smaller file and try again.',
    );
  });

  await t.test('notice bar keeps the DESIGN §2.2 classes and fixed sibling roles (R6)', () => {
    assert.match(
      editorSrc,
      /role="status"\s+aria-live="polite"\s+className="flex flex-wrap items-center gap-2 border-b border-border bg-background\/50 px-3 py-2 text-sm text-muted"/,
    );
    assert.match(
      editorSrc,
      /role="alert"\s+className="flex flex-wrap items-center gap-2 border-b border-border bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900\/20 dark:text-red-300"/,
    );
    assert.match(editorSrc, /<span className="min-w-0 flex-1 break-words">/);
    assert.match(editorSrc, /<AlertCircle className="h-4 w-4 shrink-0" \/>/);
    // No close affordance, no autofocus: DESIGN §2.3 rules 2 and 3.
    assert.doesNotMatch(editorSrc, /autoFocus/);
    const slot = editorSrc.slice(editorSrc.indexOf('{/* Image notice'));
    assert.doesNotMatch(slot.slice(0, slot.indexOf('Editor Area')), /<button/);
    assert.equal(editorSrc.match(/role="alert"/g)?.length, 1, 'status and alert must be siblings, not a mutated role');
  });

  await t.test('notice clears on success and never leaves the button stuck (AC-FE-4)', () => {
    assert.match(editorSrc, /insertMarkdownImage\(uploadedUrl, altText\);\s*\n\s*setImageNotice\(\{ status: 'none' \}\);/);
    assert.match(editorSrc, /\} finally \{\s*\n\s*setUploadingImage\(false\);\s*\n\s*event\.target\.value = '';/);
    assert.equal(editorSrc.match(/event\.target\.value = '';/g)?.length, 3);
  });

  await t.test('existing upload behaviour is preserved (AC-REG-1 / AC-COMPAT-1)', () => {
    assert.match(editorSrc, /fetchWithAuth\('\/api\/v1\/messages\/upload\/post-image'/);
    assert.match(editorSrc, /if \(!file\.type\.startsWith\('image\/'\)\)/);
    assert.match(editorSrc, /if \(!res\.ok\)/);
    assert.match(editorSrc, /uploadedUrl\.startsWith\('\/uploads\/'\)/);
    assert.match(editorSrc, /const imageText = `!\[\$\{label\}\]\(\$\{url\}\)`/);
    assert.match(editorSrc, /imageInputRef\.current\?\.click\(\)/);
    assert.match(editorSrc, /disabled=\{uploadingImage\}/);
    assert.match(editorSrc, /accept="image\/\*"/);
    // Tooltip leak fix: the button must read post.image, not the bare 'Image' fallback.
    // tooltip 泄漏修复：按钮必须读 post.image，不再落到裸 'Image'。
    assert.match(editorSrc, /title=\{imageButtonLabel\}/);
    assert.match(editorSrc, /aria-label=\{imageButtonLabel\}/);
    assert.doesNotMatch(editorSrc, /postDict\.image \|\| 'Image'/);
    assert.ok(editorSrc.includes(`'${POST_IMAGE_ENDPOINT}'`));
  });
});
