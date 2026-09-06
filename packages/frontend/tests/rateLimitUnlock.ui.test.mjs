import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('F1 RateLimitUnlockModal: five states + unlock exchange + a11y + mobile + dict', async (t) => {
  const root = process.cwd();
  const read = (p) => fs.readFile(path.join(root, p), 'utf-8');
  const [modalSrc, federalSrc, sliderSrc, uiModalSrc, zhRaw, enRaw, publicDictSrc] = await Promise.all([
    read('src/components/RateLimitUnlockModal.tsx'),
    read('src/components/federal/FederalCaptchaModal.tsx'),
    read('src/components/SliderCaptcha.tsx'),
    read('src/components/ui/Modal.tsx'),
    fs.readFile(path.join(root, 'src', 'i18n', 'dictionaries', 'zh.json'), 'utf-8'),
    fs.readFile(path.join(root, 'src', 'i18n', 'dictionaries', 'en.json'), 'utf-8'),
    read('src/i18n/public-dictionary.ts'),
  ]);
  const zh = JSON.parse(zhRaw);
  const en = JSON.parse(enRaw);
  // 联邦接入后：RateLimitUnlockModal 为 FederalCaptchaModal mode=unlock 薄封装（X-RateLimit-Unlock 载体不变）；
  // 五态与直兑载荷断言落在 FederalCaptchaModal（超集 timeout/degraded 不破坏五态）。
  const combinedModal = `${modalSrc}\n${federalSrc}`;

  await t.test('modal has five states idle/verifying/success/error/cooldown', () => {
    assert.match(combinedModal, /idle.*verifying.*success.*error.*cooldown/s);
    assert.match(modalSrc, /UnlockModalState/);
    assert.match(modalSrc, /FederalCaptchaModal/);
    assert.match(modalSrc, /mode="unlock"/);
  });

  await t.test('modal embeds SliderCaptcha manual + posts full unlock payload', () => {
    assert.match(federalSrc, /import.*SliderCaptcha.*from/);
    assert.match(federalSrc, /<SliderCaptcha[^>]*manual/);
    assert.match(federalSrc, /postUnlock/);
    assert.match(federalSrc, /captchaId/);
    assert.match(federalSrc, /dragPath/);
    assert.match(federalSrc, /totalDragTime/);
    assert.match(federalSrc, /finalPosition/);
    assert.match(federalSrc, /unlockToken/);
    assert.match(federalSrc, /exemptMinutes/);
    assert.match(federalSrc, /expiresAt/);
  });

  await t.test('unlock flows via federal issue/verify, X-RateLimit-Unlock carrier unchanged, no Cookie', async () => {
    const federalApiSrc = await read('src/lib/federal/federal-api.ts');
    assert.match(federalSrc, /issueFederalCaptcha/);
    assert.match(federalSrc, /verifyFederalCaptcha/);
    // 路径收敛在 federal-api.ts（组件化分层），modal 经封装调用
    assert.match(federalApiSrc, /\/api\/v1\/auth\/captcha\/federal\/issue/);
    assert.match(federalApiSrc, /\/api\/v1\/auth\/captcha\/federal\/verify/);
    assert.doesNotMatch(combinedModal, /document\.cookie/);
  });

  await t.test('modal failure 1.5s refresh + visible refresh button', () => {
    assert.match(federalSrc, /1500/);
    assert.match(combinedModal, /refreshChallenge/);
    assert.match(federalSrc, /disabled=\{verifying/);
  });

  await t.test('modal a11y: labelledby/describedby, alert, status, Esc, focus return, reduced-motion', () => {
    assert.match(federalSrc, /describedBy/);
    assert.match(federalSrc, /role="alert"/);
    assert.match(federalSrc, /role="status"/);
    assert.match(federalSrc, /aria-live/);
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
    // 联邦注入 additive（externalCaptchaId/externalImage 可选，缺省走 legacy 拉题）
    assert.match(sliderSrc, /externalCaptchaId\?: string/);
    assert.match(sliderSrc, /externalImage\?:/);
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
      // 联邦注入亦不得污染现有 5 处（external* 仅联邦 modal 使用）
      assert.doesNotMatch(src, /<SliderCaptcha[^>]*\bexternalCaptchaId\b/);
      assert.doesNotMatch(src, /<SliderCaptcha[^>]*\bexternalImage\b/);
    }
  });

  await t.test('dictionaries contain rateLimitUnlock.* 11 keys en/zh + public pick (COPY-CHANGE-1 v1.1: retryNow deleted, modalDesc rewritten)', () => {
    const keys = [
      'cardTitle', 'cardDesc', 'retryAfter', 'verifyToUnlock',
      'modalTitle', 'modalDesc', 'refreshChallenge', 'unlockSuccess',
      'unlockFailedRetry', 'exemptedHint', 'waitWithoutUnlock',
    ];
    for (const k of keys) {
      assert.ok(zh.rateLimitUnlock?.[k], `zh rateLimitUnlock.${k} missing`);
      assert.ok(en.rateLimitUnlock?.[k], `en rateLimitUnlock.${k} missing`);
    }
    // D31 删键不存在
    assert.equal(zh.rateLimitUnlock?.retryNow, undefined, 'zh retryNow should be deleted');
    assert.equal(en.rateLimitUnlock?.retryNow, undefined, 'en retryNow should be deleted');
    // E3 改写键新值（zh/en 同义同步）
    assert.equal(zh.rateLimitUnlock?.modalDesc, '按提示完成验证');
    assert.equal(en.rateLimitUnlock?.modalDesc, 'Follow the prompt to complete verification.');
    assert.match(publicDictSrc, /rateLimitUnlock/);
    assert.match(publicDictSrc, /refresh/);
    assert.doesNotMatch(publicDictSrc, /retryNow/);
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
  const [fetcherSrc, unlockSrc, tokenSrc, islandSrc, modalSrc, federalSrc, federalApiSrc, powSrc, clockSrc] = await Promise.all([
    read('src/lib/api/fetcher.ts'),
    read('src/lib/rate-limit/unlock.ts'),
    read('src/lib/rate-limit/unlock-token.ts'),
    read('src/components/PostListRateLimitIsland.tsx'),
    read('src/components/RateLimitUnlockModal.tsx'),
    read('src/components/federal/FederalCaptchaModal.tsx'),
    read('src/lib/federal/federal-api.ts'),
    read('src/components/federal/PowCollector.tsx'),
    read('src/components/federal/GeometryClock.tsx'),
  ]);
  const all = [fetcherSrc, unlockSrc, tokenSrc, islandSrc, modalSrc, federalSrc, federalApiSrc, powSrc, clockSrc].join('\n');

  await t.test('no Cookie carrier introduced (B1 allowlist: unlock-token dual-write only)', () => {
    // B1 生产修复：unlock-token.ts 允许同源持久化 Cookie（localStorage + document.cookie 双写，
    // 供 SSR serverFetch 读后附头；后端仍只认 X-RateLimit-Unlock 头，BFF 零改）；
    // 其余 8 文件仍禁 document.cookie；全量仍禁服务端独占标记（JS 须可读写，设该标记会断兼容读）。
    // 注：源码注释已 sanitized，字面 HttpOnly 仅以“服务端独占标记”中文指代，免触发整文件 doesNotMatch 误报。
    assert.match(tokenSrc, /document\.cookie/);
    assert.match(tokenSrc, /UNLOCK_COOKIE_NAME/);
    assert.match(tokenSrc, /localStorage/);
    assert.match(tokenSrc, /SameSite=Lax/);
    const others = [fetcherSrc, unlockSrc, islandSrc, modalSrc, federalSrc, federalApiSrc, powSrc, clockSrc].join('\n');
    assert.doesNotMatch(others, /document\.cookie/);
    assert.doesNotMatch(all, /HttpOnly/);
    // SameSite 仅允许 unlock-token 双写处（SSR Cookie），他处不得新增
    assert.doesNotMatch(others, /SameSite/);
  });

  await t.test('X-RateLimit-Unlock is the sole carrier', () => {
    assert.match(all, /X-RateLimit-Unlock/);
  });

  await t.test('browser calls use BFF relative paths, never stitch backend URL', () => {
    assert.match(unlockSrc, /fetch\('\/api\/v1\/auth\/captcha\/unlock'/);
    assert.doesNotMatch(unlockSrc, /API_URL|buildBackendUrl|localhost:3001|127\.0\.0\.1:3001/);
    assert.doesNotMatch(islandSrc, /API_URL|buildBackendUrl/);
    // 联邦 BFF 相对路径，禁直拼后端
    assert.match(federalApiSrc, /fetch\('\/api\/v1\/auth\/captcha\/federal\/issue'/);
    assert.match(federalApiSrc, /fetch\('\/api\/v1\/auth\/captcha\/federal\/verify'/);
    assert.doesNotMatch(federalApiSrc, /API_URL|buildBackendUrl|localhost:3001|127\.0\.0\.1:3001/);
    assert.doesNotMatch(federalSrc, /API_URL|buildBackendUrl|localhost:3001|127\.0\.0\.1:3001/);
  });

  await t.test('BFF zero-change: no federal/unlock special-case in proxy', async () => {
    const proxySrc = await read('src/lib/bff/proxy.ts');
    assert.match(proxySrc, /copyRequestHeaders/);
    assert.doesNotMatch(proxySrc, /X-RateLimit-Unlock/);
    assert.doesNotMatch(proxySrc, /federal/);
    assert.doesNotMatch(proxySrc, /unlock/);
  });
});

test('B1 SSR同状态：unlockToken Cookie双写 + serverFetch附头 + 无token仍限流（防刷新绕过）', async (t) => {
  const root = process.cwd();
  const read = (p) => fs.readFile(path.join(root, p), 'utf-8');
  const [tokenSrc, serverApiSrc, hookSrc, islandSrc, ssrSrc] = await Promise.all([
    read('src/lib/rate-limit/unlock-token.ts'),
    read('src/lib/bff/serverApi.ts'),
    read('src/lib/rate-limit/use-rate-limit.ts'),
    read('src/components/PostListRateLimitIsland.tsx'),
    read('src/lib/rate-limit/ssr-rate-limit.ts'),
  ]);

  await t.test('unlock-token双写localStorage+Cookie、兼容读、过期自洁', () => {
    // 双写
    assert.match(tokenSrc, /UNLOCK_COOKIE_NAME/);
    assert.match(tokenSrc, /window\.localStorage\.setItem/);
    assert.match(tokenSrc, /document\.cookie/);
    assert.match(tokenSrc, /Max-Age/);
    assert.match(tokenSrc, /SameSite=Lax/);
    assert.match(tokenSrc, /encodeURIComponent/);
    // 兼容读：local优先、Cookie回填/补写
    assert.match(tokenSrc, /window\.localStorage\.getItem/);
    assert.match(tokenSrc, /readCookieRaw/);
    assert.match(tokenSrc, /decodeURIComponent/);
    assert.match(tokenSrc, /writeCookieRecord/);
    // 过期自洁：双端过期均不附头
    assert.match(tokenSrc, /isExpiredRecord/);
    assert.match(tokenSrc, /clearUnlockToken/);
    assert.match(tokenSrc, /getValidUnlockToken/);
  });

  await t.test('serverFetch读Cookie附X-RateLimit-Unlock、无token不附头', () => {
    assert.match(serverApiSrc, /getServerUnlockToken/);
    assert.match(serverApiSrc, /UNLOCK_COOKIE_NAME/);
    assert.match(serverApiSrc, /X-RateLimit-Unlock/);
    assert.match(serverApiSrc, /cookies\(\)/);
    assert.match(serverApiSrc, /decodeURIComponent/);
    assert.match(serverApiSrc, /Date\.parse/);
    // 已显式附头不覆盖
    assert.match(serverApiSrc, /merged\.has\(UNLOCK_HEADER_NAME\)/);
    // 有token才附、无token/过期返回null保持限流
    assert.match(serverApiSrc, /if \(token\) merged\.set/);
    assert.match(serverApiSrc, /if \(!raw\) return null/);
    assert.match(serverApiSrc, /Number\.isNaN\(exp\)/);
  });

  await t.test('无token连刷仍限流：水合无自动重试、SSR无头仍429卡', () => {
    // 水合后无token不自动试（early return），首帧必卡
    assert.match(hookSrc, /if \(!getValidUnlockToken\(\)\) return/);
    assert.match(hookSrc, /useState\(true\)/);
    // Island仅恢复+有数据才切列表，否则恒卡（无token无data不切）
    assert.match(islandSrc, /if \(!limited && data\)/);
    assert.match(islandSrc, /RateLimitCard/);
    // SSR仅解锁型429才进卡，通用/无token仍按头倒计时限流态（不 bypass 为正常页）
    assert.match(ssrSrc, /ERR_RATE_LIMITED_NEEDS_CAPTCHA/);
    assert.match(ssrSrc, /unlockRequired/);
  });
});

test('B2 管理时长：window行内错 + dict不覆盖dirty + Save指明字段 + MODERATOR无权限显式', async (t) => {
  const root = process.cwd();
  const read = (p) => fs.readFile(path.join(root, p), 'utf-8');
  const [sectionSrc, zhRaw, enRaw] = await Promise.all([
    read('src/components/RateLimitPolicySection.tsx'),
    fs.readFile(path.join(root, 'src', 'i18n', 'dictionaries', 'zh.json'), 'utf-8'),
    fs.readFile(path.join(root, 'src', 'i18n', 'dictionaries', 'en.json'), 'utf-8'),
  ]);
  const zh = JSON.parse(zhRaw);
  const en = JSON.parse(enRaw);

  await t.test('windowSelect行内错误态与阈值/豁免同形', () => {
    assert.match(sectionSrc, /showWindowError/);
    assert.match(sectionSrc, /ratelimit-window-error/);
    assert.match(sectionSrc, /ratelimit-window-hint/);
    assert.match(sectionSrc, /aria-invalid=\{showWindowError\}/);
    assert.match(sectionSrc, /invalidWindow/);
  });

  await t.test('dict变化不覆盖dirty（仅首次加载回填）', () => {
    assert.match(sectionSrc, /initialFilledRef/);
    assert.match(sectionSrc, /if \(!initialFilledRef\.current\)/);
  });

  await t.test('Save禁用title指明具体非法字段', () => {
    assert.match(sectionSrc, /saveDisabledTitle/);
    assert.match(sectionSrc, /invalidThreshold/);
    assert.match(sectionSrc, /invalidExemption/);
    assert.match(sectionSrc, /invalidWindow/);
    assert.ok(zh.admin?.invalidWindow, 'zh admin.invalidWindow missing');
    assert.ok(en.admin?.invalidWindow, 'en admin.invalidWindow missing');
  });

  await t.test('MODERATOR错误态明确无权限而非表单消失', () => {
    assert.match(sectionSrc, /ratelimit-no-permission/);
    assert.match(sectionSrc, /isNoPermission/);
    assert.match(sectionSrc, /loadErrorCode/);
    assert.match(sectionSrc, /rateLimitNoPermission/);
    assert.match(sectionSrc, /无权限/);
    assert.ok(zh.admin?.rateLimitNoPermission?.includes('无权限'), 'zh rateLimitNoPermission must contain 无权限');
    assert.match(en.admin?.rateLimitNoPermission ?? '', /No permission/);
  });
});
