import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('F1 RateLimitUnlockModal: five states + unlock exchange + a11y + mobile + dict', async (t) => {
  const root = process.cwd();
  const read = (p) => fs.readFile(path.join(root, p), 'utf-8');
  const [modalSrc, sliderSrc, uiModalSrc, zhRaw, enRaw, publicDictSrc] = await Promise.all([
    read('src/components/RateLimitUnlockModal.tsx'),
    read('src/components/SliderCaptcha.tsx'),
    read('src/components/ui/Modal.tsx'),
    fs.readFile(path.join(root, 'src', 'i18n', 'dictionaries', 'zh.json'), 'utf-8'),
    fs.readFile(path.join(root, 'src', 'i18n', 'dictionaries', 'en.json'), 'utf-8'),
    read('src/i18n/public-dictionary.ts'),
  ]);
  const zh = JSON.parse(zhRaw);
  const en = JSON.parse(enRaw);

  await t.test('modal has five states idle/verifying/success/error/cooldown', () => {
    assert.match(modalSrc, /idle.*verifying.*success.*error.*cooldown/s);
    assert.match(modalSrc, /UnlockModalState/);
  });

  await t.test('modal embeds SliderCaptcha manual + posts full unlock payload', () => {
    assert.match(modalSrc, /import.*SliderCaptcha.*from/);
    assert.match(modalSrc, /<SliderCaptcha[^>]*manual/);
    assert.match(modalSrc, /postUnlock/);
    assert.match(modalSrc, /captchaId/);
    assert.match(modalSrc, /dragPath/);
    assert.match(modalSrc, /totalDragTime/);
    assert.match(modalSrc, /finalPosition/);
    assert.match(modalSrc, /unlockToken/);
    assert.match(modalSrc, /exemptMinutes/);
    assert.match(modalSrc, /expiresAt/);
  });

  await t.test('modal failure 1.5s refresh + visible refresh button', () => {
    assert.match(modalSrc, /1500/);
    assert.match(modalSrc, /refreshChallenge/);
    assert.match(modalSrc, /disabled=\{verifying/);
  });

  await t.test('modal a11y: labelledby/describedby, alert, status, Esc, focus return, reduced-motion', () => {
    assert.match(modalSrc, /describedBy/);
    assert.match(modalSrc, /role="alert"/);
    assert.match(modalSrc, /role="status"/);
    assert.match(modalSrc, /aria-live/);
    assert.match(uiModalSrc, /Escape/);
    assert.match(uiModalSrc, /previouslyFocusedRef/);
    assert.match(uiModalSrc, /aria-labelledby/);
    assert.match(uiModalSrc, /aria-describedby/);
    assert.match(uiModalSrc, /motion-reduce/);
  });

  await t.test('modal mobile: Slider w-full max-w + Modal calc + 90dvh', () => {
    assert.match(sliderSrc, /w-full max-w-\[350px\]/);
    assert.match(uiModalSrc, /calc\(100vw-2rem\)/);
    assert.match(uiModalSrc, /max-h-\[90dvh\]/);
  });

  await t.test('SliderCaptcha additive manual mode keeps 5 existing calls compatible', () => {
    assert.match(sliderSrc, /manual\?: boolean/);
    assert.match(sliderSrc, /manual = false/);
    assert.match(sliderSrc, /solution\?: SliderCaptchaSolutionPayload/);
    // 禁止 toUpperCase 破坏中文（DESIGN §1.7）
    assert.doesNotMatch(sliderSrc, /\.toUpperCase\(\)/);
    // img alt 不允许空裸奔
    assert.match(sliderSrc, /alt=\{dict\.captcha\.securityVerification\}/);
    assert.match(sliderSrc, /aria-valuetext/);
    assert.match(sliderSrc, /aria-busy/);
  });

  await t.test('existing 5 SliderCaptcha calls untouched (no manual prop, no style change)', async () => {
    const callSites = [
      'src/app/(auth)/register/RegisterClient.tsx',
      'src/app/compose/ComposeForm.tsx',
      'src/app/friends/page.tsx',
      'src/app/p/[id]/CommentsSection.tsx',
      'src/app/u/[username]/OwnerSettingsButton.tsx',
    ];
    for (const p of callSites) {
      const src = await read(p);
      assert.match(src, /<SliderCaptcha/);
      // 禁止新增 manual 直兑 prop（现有调用保持默认 /verify 流程）；用 prop 级正则避免误伤英文 manual/manually 注释
      assert.doesNotMatch(src, /<SliderCaptcha[^>]*\bmanual\b/);
    }
  });

  await t.test('dictionaries contain rateLimitUnlock.* 12 keys en/zh + public pick', () => {
    const keys = [
      'cardTitle', 'cardDesc', 'retryAfter', 'verifyToUnlock', 'retryNow',
      'modalTitle', 'modalDesc', 'refreshChallenge', 'unlockSuccess',
      'unlockFailedRetry', 'exemptedHint', 'waitWithoutUnlock',
    ];
    for (const k of keys) {
      assert.ok(zh.rateLimitUnlock?.[k], `zh rateLimitUnlock.${k} missing`);
      assert.ok(en.rateLimitUnlock?.[k], `en rateLimitUnlock.${k} missing`);
    }
    assert.match(publicDictSrc, /rateLimitUnlock/);
    assert.match(publicDictSrc, /refresh/);
  });
});

test('F2 trigger & retry: RateLimitError + BFF zero-change + SSR bridge + Card + AutoRefresh', async (t) => {
  const root = process.cwd();
  const read = (p) => fs.readFile(path.join(root, p), 'utf-8');
  const [fetcherSrc, proxySrc, cardSrc, islandSrc, postListSrc, autoSrc, zhRaw, enRaw] = await Promise.all([
    read('src/lib/api/fetcher.ts'),
    read('src/lib/bff/proxy.ts'),
    read('src/components/RateLimitCard.tsx'),
    read('src/components/PostListRateLimitIsland.tsx'),
    read('src/components/PostList.tsx'),
    read('src/components/AutoRefresh.tsx'),
    fs.readFile(path.join(root, 'src', 'i18n', 'dictionaries', 'zh.json'), 'utf-8'),
    fs.readFile(path.join(root, 'src', 'i18n', 'dictionaries', 'en.json'), 'utf-8'),
  ]);
  const zh = JSON.parse(zhRaw);
  const en = JSON.parse(enRaw);

  await t.test('fetcher throws structured RateLimitError, unlock 429 does not loop', async () => {
    const errorsSrc = await read('src/lib/rate-limit/errors.ts');
    // 冻结码定义在 errors.ts（唯一事实源），fetcher 经 parseRateLimitDetails 消费
    assert.match(errorsSrc, /ERR_RATE_LIMITED_NEEDS_CAPTCHA/);
    assert.match(fetcherSrc, /RateLimitError/);
    assert.match(fetcherSrc, /retryAfterSec/);
    assert.match(fetcherSrc, /unlockRequired/);
    // 无 unlockRequired 的不弹（含 POST /unlock 自身 429 通用体）
    assert.match(fetcherSrc, /parseRateLimitDetails/);
    assert.match(fetcherSrc, /isUnlockEndpoint/);
    assert.match(fetcherSrc, /X-RateLimit-Unlock/);
    assert.doesNotMatch(fetcherSrc, /document\.cookie/);
  });

  await t.test('BFF zero-change: X-RateLimit-Unlock naturally passthrough, no unlock special-case', () => {
    assert.match(proxySrc, /copyRequestHeaders/);
    assert.doesNotMatch(proxySrc, /X-RateLimit-Unlock/);
    assert.doesNotMatch(proxySrc, /unlock/);
  });

  await t.test('SSR bridge: RSC pages pass rateLimited/retryAfter to Client Island, retry once with header', async () => {
    const pages = [
      'src/app/page.tsx',
      'src/app/recent/page.tsx',
      'src/app/popular/page.tsx',
      'src/app/c/[category]/page.tsx',
    ];
    for (const p of pages) {
      const src = await read(p);
      assert.match(src, /serverFetch/);
      assert.match(src, /getSsrRateLimitInfo/);
      assert.match(src, /PostListRateLimitIsland/);
      assert.match(src, /initialRetryAfterSec/);
      // bffUrl 可为字面量（/、/recent、/popular）或变量（c/* 用 bffUrl 变量避免重复编码），均须指向 /api/posts
      assert.match(src, /bffUrl/);
      assert.match(src, /\/api\/posts/);
      assert.match(src, /paused=\{\!\!rateLimited\}/);
      assert.doesNotMatch(src, /fetch\(serverApiUrl\(/);
    }
    assert.match(islandSrc, /useRateLimitRetry/);
    // Island 经 useRateLimitRetry(bffUrl) 间接调 fetcher(bffUrl)（附头在 fetcher 内自动完成）；直接 fetcher(bffUrl) 位于 hook 内
    assert.match(islandSrc, /useRateLimitRetry.*bffUrl/);
    const hookSrc = await read('src/lib/rate-limit/use-rate-limit.ts');
    assert.match(hookSrc, /fetcher\(bffUrl\)/);
    assert.match(islandSrc, /handleUnlocked/);
  });

  await t.test('RateLimitCard independent amber + ShieldAlert + countdown + CTA + role=alert, zero reuse empty-state', () => {
    assert.match(cardSrc, /data-testid="ratelimit-card"/);
    assert.match(cardSrc, /role="alert"/);
    assert.match(cardSrc, /role="status"/);
    assert.match(cardSrc, /aria-live="polite"/);
    assert.match(cardSrc, /ShieldAlert/);
    assert.match(cardSrc, /amber-500\/40/);
    assert.match(cardSrc, /bg-amber-50/);
    assert.match(cardSrc, /verifyToUnlock/);
    assert.match(postListSrc, /data-testid="empty-state"/);
    // 零复用指 data-testid 正交（注释提及对方 testid 作文档说明不算复用）
    assert.doesNotMatch(cardSrc, /data-testid="empty-state"/);
    assert.doesNotMatch(postListSrc, /data-testid="ratelimit-card"/);
  });

  await t.test('AutoRefresh pauses in rate-limit state', () => {
    assert.match(autoSrc, /paused/);
    assert.match(autoSrc, /if \(paused\) return/);
  });

  await t.test('apiErrors contain unlock codes en/zh', () => {
    assert.ok(zh.apiErrors?.ERR_RATE_LIMITED_NEEDS_CAPTCHA, 'zh missing unlock 429 code');
    assert.ok(en.apiErrors?.ERR_RATE_LIMITED_NEEDS_CAPTCHA, 'en missing unlock 429 code');
  });
});

test('F3 serverFetch transparent XFF first IP covers all RSC direct points', async (t) => {
  const root = process.cwd();
  const read = (p) => fs.readFile(path.join(root, p), 'utf-8');
  const serverApiSrc = await read('src/lib/bff/serverApi.ts');

  await t.test('serverFetch takes XFF first segment and emits X-Forwarded-For', () => {
    assert.match(serverApiSrc, /export async function serverFetch/);
    assert.match(serverApiSrc, /getIncomingForwardedForFirstIp/);
    assert.match(serverApiSrc, /split\(','\)\[0\]/);
    assert.match(serverApiSrc, /trim\(\)/);
    assert.match(serverApiSrc, /X-Forwarded-For/);
    assert.match(serverApiSrc, /next\/headers/);
  });

  await t.test('all RSC direct points use serverFetch, none use raw serverApiUrl fetch', async () => {
    const points = [
      'src/app/page.tsx',
      'src/app/recent/page.tsx',
      'src/app/popular/page.tsx',
      'src/app/c/[category]/page.tsx',
      'src/app/p/[id]/page.tsx',
      'src/app/p/[id]/edit/page.tsx',
      'src/app/search/page.tsx',
      'src/app/tags/page.tsx',
      'src/app/tags/[name]/page.tsx',
      'src/app/u/[username]/page.tsx',
      'src/components/layout/Header.tsx',
      'src/app/admin/layout.tsx',
    ];
    for (const p of points) {
      const src = await read(p);
      assert.doesNotMatch(src, /fetch\(serverApiUrl\(/, `${p} still uses raw serverApiUrl fetch`);
      // 允许 import serverApiUrl for URL building? 本期要求统一 serverFetch，import 也不应残留 serverApiUrl
      if (p !== 'src/lib/bff/serverApi.ts') {
        assert.doesNotMatch(src, /serverApiUrl/, `${p} still imports serverApiUrl`);
      }
    }
  });

  await t.test('only trusted chain first IP, no blind trust of full XFF', () => {
    // 只取首段，不拼接多段，不信任 x-real-ip 优先（XFF 优先，real-ip 仅回退）；注释提及后端 getClientIp 作信任链说明不算前端盲信
    assert.match(serverApiSrc, /x-forwarded-for/);
    assert.doesNotMatch(serverApiSrc, /getClientIp\(/);
    assert.doesNotMatch(serverApiSrc, /import.*getClientIp/);
  });
});

test('F4 admin fourth section: rows + strict zod mirror + dangerous confirms + four save states', async (t) => {
  const root = process.cwd();
  const read = (p) => fs.readFile(path.join(root, p), 'utf-8');
  const [sectionSrc, pageSrc, adminApiSrc, typesSrc, zhRaw, enRaw] = await Promise.all([
    read('src/components/RateLimitPolicySection.tsx'),
    read('src/app/admin/protection/page.tsx'),
    read('src/lib/api/admin.ts'),
    read('src/types/protection.ts'),
    fs.readFile(path.join(root, 'src', 'i18n', 'dictionaries', 'zh.json'), 'utf-8'),
    fs.readFile(path.join(root, 'src', 'i18n', 'dictionaries', 'en.json'), 'utf-8'),
  ]);
  const zh = JSON.parse(zhRaw);
  const en = JSON.parse(enRaw);

  await t.test('protection page renders fourth section component', () => {
    assert.match(pageSrc, /RateLimitPolicySection/);
  });

  await t.test('admin client exposes get/updateRateLimitPolicy via BFF relative paths', () => {
    assert.match(adminApiSrc, /getRateLimitPolicy/);
    assert.match(adminApiSrc, /updateRateLimitPolicy/);
    assert.match(adminApiSrc, /\/api\/admin\/protection\/rate-limit/);
    assert.doesNotMatch(adminApiSrc, /http:\/\/|https:\/\//);
  });

  await t.test('types define frozen 7-field config + defaults + window options', () => {
    assert.match(typesSrc, /RateLimitProtectionConfig/);
    assert.match(typesSrc, /enabled/);
    assert.match(typesSrc, /publicReadMax/);
    assert.match(typesSrc, /windowSec/);
    assert.match(typesSrc, /captchaStrength/);
    assert.match(typesSrc, /exemptionMinutes/);
    assert.match(typesSrc, /exemptionScope/);
    assert.match(typesSrc, /loginRelaxed/);
    assert.match(typesSrc, /RATE_LIMIT_POLICY_DEFAULTS/);
    assert.match(typesSrc, /10 \| 30 \| 60 \| 300 \| 600/);
  });

  await t.test('section layout rows: switch+exemption / slider+select / segmented / search readonly / loginRelaxed grey', () => {
    assert.match(sectionSrc, /readUnlockEnabled/);
    assert.match(sectionSrc, /exemptionMinutes/);
    assert.match(sectionSrc, /type="range"/);
    assert.match(sectionSrc, /<select/);
    assert.match(sectionSrc, /role="radiogroup"/);
    assert.match(sectionSrc, /searchMax/);
    assert.match(sectionSrc, /searchLinkReserved/);
    assert.match(sectionSrc, /loginRelaxedReserved/);
    assert.match(sectionSrc, /exemptionScope/);
  });

  await t.test('strict semantics: inline error no clamp, integer regex, range checks', () => {
    assert.match(sectionSrc, /isIntegerInRange/);
    assert.match(sectionSrc, /10, 1000/);
    assert.match(sectionSrc, /1, 120/);
    assert.match(sectionSrc, /aria-invalid/);
    assert.match(sectionSrc, /role="alert"/);
    // 禁止静默修正代码（注释提及 clamp 作“不 clamp”声明不算违规）
    assert.doesNotMatch(sectionSrc, /Math\.min\(|Math\.max\(/);
    assert.doesNotMatch(sectionSrc, /\.clamp\(/);
  });

  await t.test('dangerous three require second confirm + four save states', () => {
    assert.match(sectionSrc, /confirmKind/);
    assert.match(sectionSrc, /confirmRiskyTitle/);
    assert.match(sectionSrc, /confirmDisableUnlock/);
    assert.match(sectionSrc, /resetDefaults/);
    assert.match(sectionSrc, /SaveState.*idle.*saving.*success.*error/s);
    assert.match(sectionSrc, /variant="destructive"/);
  });

  await t.test('admin dict has 18+ keys en/zh', () => {
    const required = [
      'rateLimitTitle', 'rateLimitDesc', 'readUnlockEnabled', 'readUnlockEnabledHint',
      'publicReadMax', 'publicReadMaxHint', 'thresholdTooLowWarn', 'publicReadWindowSec',
      'captchaStrength', 'strengthEasy', 'strengthEasyHint', 'strengthNormal', 'strengthNormalHint',
      'strengthStrict', 'strengthStrictHint', 'exemptionMinutes', 'exemptionMinutesHint',
      'searchLinkReserved', 'loginRelaxedReserved', 'resetDefaults', 'rateLimitSaved',
      'failedToSaveRateLimit', 'confirmRiskyTitle', 'confirmDisableUnlock',
    ];
    for (const k of required) {
      assert.ok(zh.admin?.[k], `zh admin.${k} missing`);
      assert.ok(en.admin?.[k], `en admin.${k} missing`);
    }
  });
});

test('Forbidden zones: no Cookie carrier, X-RateLimit-Unlock sole carrier, no backend URL stitching', async (t) => {
  const root = process.cwd();
  const read = (p) => fs.readFile(path.join(root, p), 'utf-8');
  const [fetcherSrc, unlockSrc, tokenSrc, islandSrc, modalSrc] = await Promise.all([
    read('src/lib/api/fetcher.ts'),
    read('src/lib/rate-limit/unlock.ts'),
    read('src/lib/rate-limit/unlock-token.ts'),
    read('src/components/PostListRateLimitIsland.tsx'),
    read('src/components/RateLimitUnlockModal.tsx'),
  ]);
  const all = [fetcherSrc, unlockSrc, tokenSrc, islandSrc, modalSrc].join('\n');

  await t.test('no Cookie carrier introduced', () => {
    assert.doesNotMatch(all, /document\.cookie/);
    assert.doesNotMatch(all, /HttpOnly/);
    assert.doesNotMatch(all, /SameSite/);
  });

  await t.test('X-RateLimit-Unlock is the sole carrier', () => {
    assert.match(all, /X-RateLimit-Unlock/);
  });

  await t.test('browser calls use BFF relative paths, never stitch backend URL', () => {
    assert.match(unlockSrc, /fetch\('\/api\/v1\/auth\/captcha\/unlock'/);
    assert.doesNotMatch(unlockSrc, /API_URL|buildBackendUrl|localhost:3001|127\.0\.0\.1:3001/);
    assert.doesNotMatch(islandSrc, /API_URL|buildBackendUrl/);
  });
});
