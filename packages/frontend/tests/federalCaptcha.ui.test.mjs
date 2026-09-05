import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('Federal modal: server-driven single + restricted switch ghost + five states + slider reuse', async (t) => {
  const root = process.cwd();
  const read = (p) => fs.readFile(path.join(root, p), 'utf-8');
  const [modalSrc, apiSrc, sliderSrc] = await Promise.all([
    read('src/components/federal/FederalCaptchaModal.tsx'),
    read('src/lib/federal/federal-api.ts'),
    read('src/components/SliderCaptcha.tsx'),
  ]);

  await t.test('server-driven single issue (no kind) + restricted switch ghost (no free tabs)', () => {
    // 服务端驱动单题：打开即 void doIssue()（不传 kind 按 effectiveKind），换一种经 doIssue(next) 受限 hint
    assert.match(modalSrc, /void doIssue\(\)/);
    assert.match(modalSrc, /void doIssue\(next\)/);
    assert.match(apiSrc, /issueFederalCaptcha/);
    assert.match(modalSrc, /switchKind/);
    assert.doesNotMatch(modalSrc, /role="tablist"/);
    // 关闭类型入口 disabled + tooltip
    assert.match(modalSrc, /switchDisabledTip/);
    assert.match(modalSrc, /disabledKinds/);
  });

  await t.test('five states沿用 + timeout/degraded superset, Modal a11y/mobile', async () => {
    assert.match(modalSrc, /idle.*verifying.*success.*error.*cooldown/s);
    assert.match(modalSrc, /timeout/);
    assert.match(modalSrc, /degraded/);
    assert.match(modalSrc, /describedBy/);
    assert.match(modalSrc, /role="alert"/);
    assert.match(modalSrc, /role="status"/);
    assert.match(modalSrc, /aria-live/);
    assert.match(modalSrc, /fallbackToSlider|fallbackSlider/);
    const uiModal = await read('src/components/ui/Modal.tsx');
    assert.match(uiModal, /max-h-\[90dvh\]/);
  });

  await t.test('slider branch reuses SliderCaptcha manual with federal inject, 5 calls untouched', () => {
    assert.match(modalSrc, /<SliderCaptcha[^>]*manual/);
    assert.match(modalSrc, /externalCaptchaId/);
    assert.match(modalSrc, /externalImage/);
    assert.match(sliderSrc, /externalCaptchaId\?: string/);
  });

  await t.test('federal BFF relative paths, unified 400, independent limiter shape', () => {
    // 路径收敛在 federal-api.ts（BFF 相对），modal 经封装调用（组件化分层，不直拼 URL）
    assert.match(apiSrc, /\/api\/v1\/auth\/captcha\/federal\/issue/);
    assert.match(apiSrc, /\/api\/v1\/auth\/captcha\/federal\/verify/);
    assert.match(apiSrc, /ERR_VERIFICATION_FAILED/);
    assert.match(modalSrc, /verifyFederalCaptcha/);
    assert.doesNotMatch(apiSrc, /API_URL|buildBackendUrl|localhost:3001/);
  });
});

test('GeometryClock: SVG shuffled clock + mouse drag + 1560 slots + behavior samples no verdict', async (t) => {
  const root = process.cwd();
  const read = (p) => fs.readFile(path.join(root, p), 'utf-8');
  const [clockSrc, apiSrc] = await Promise.all([
    read('src/components/federal/GeometryClock.tsx'),
    read('src/lib/federal/federal-api.ts'),
  ]);

  await t.test('1560 micro slots literal + 130 per number + strict 30', () => {
    assert.match(clockSrc, /TOTAL_SLOTS = 1560/);
    assert.match(clockSrc, /SLOTS_PER_NUM = 130/);
    assert.match(clockSrc, /STRICT_DEV = 30/);
  });

  await t.test('pure mouse drag needle, no slider/keyboard mover', () => {
    assert.match(clockSrc, /onPointerDown/);
    assert.match(clockSrc, /onPointerMove/);
    assert.match(clockSrc, /setPointerCapture/);
    assert.match(clockSrc, /requestAnimationFrame/);
    assert.doesNotMatch(clockSrc, /input[^>]*type="range"/);
    assert.doesNotMatch(clockSrc, /onKeyDown.*micro|Arrow.*micro/);
  });

  await t.test('behavior sampling (t,x,y) uploaded, no client verdict', () => {
    assert.match(clockSrc, /behaviorSamples/);
    assert.match(clockSrc, /getSolution/);
    assert.match(clockSrc, /microSlot/);
    assert.match(apiSrc, /microSlot/);
    assert.match(apiSrc, /behaviorSamples/);
    // 采集侧不下结论：不得出现服务端判定口径的客户端复刻（如加速度方差阈值 + 直线度联合拒识逻辑）
    assert.doesNotMatch(clockSrc, /behVerdict/);
    assert.doesNotMatch(clockSrc, /passes behavioral/);
  });

  await t.test('idle timeout default 60 strict 15', () => {
    assert.match(clockSrc, /strength === 'strict' \? 15 : 60/);
    assert.match(clockSrc, /idleTimeoutSec/);
  });
});

test('PowCollector: Worker pure JS SHA-256 + progress + cancel + 10s timeout + downgrade + fallback', async (t) => {
  const root = process.cwd();
  const read = (p) => fs.readFile(path.join(root, p), 'utf-8');
  const [powSrc, shaSrc, modalSrc] = await Promise.all([
    read('src/components/federal/PowCollector.tsx'),
    read('src/lib/federal/sha256.ts'),
    read('src/components/federal/FederalCaptchaModal.tsx'),
  ]);

  await t.test('Worker + pure JS SHA-256 zero-dep + progress + cancel', () => {
    assert.match(powSrc, /new Worker/);
    assert.match(powSrc, /POW_WORKER_SOURCE/);
    assert.match(powSrc, /postMessage/);
    assert.match(powSrc, /terminate\(\)/);
    assert.match(powSrc, /cancel/);
    assert.match(shaSrc, /sha256Hex/);
    assert.match(shaSrc, /meetsLeadingZeroBits/);
    assert.match(shaSrc, /powHash/);
    assert.doesNotMatch(shaSrc, /from 'crypto'|require\('crypto'\)|node:crypto/);
  });

  await t.test('10s timeout fallback slider-low + downgrade retry', () => {
    assert.match(powSrc, /timeoutSec = 10/);
    assert.match(powSrc, /setTimeout\(handleTimeout, timeoutSec \* 1000\)/);
    assert.match(powSrc, /downgrade/);
    assert.match(powSrc, /fallbackToSlider|onFallback/);
    assert.match(powSrc, /bits - 4/);
    assert.match(modalSrc, /handleFallbackSlider/);
  });

  await t.test('no auto-start (user gesture required)', () => {
    assert.match(powSrc, /Start computing|start/);
    assert.doesNotMatch(powSrc, /useEffect\(\(\) => \{\s*startMining/);
  });
});

test('Federal admin fifth section: kinds保1 + default select + bits/level/timeout strict + confirms + four states + 60s', async (t) => {
  const root = process.cwd();
  const read = (p) => fs.readFile(path.join(root, p), 'utf-8');
  const [sectionSrc, pageSrc, adminApiSrc, typesSrc, zhRaw, enRaw] = await Promise.all([
    read('src/components/FederalCaptchaSection.tsx'),
    read('src/app/admin/protection/page.tsx'),
    read('src/lib/api/admin.ts'),
    read('src/types/protection.ts'),
    fs.readFile(path.join(root, 'src', 'i18n', 'dictionaries', 'zh.json'), 'utf-8'),
    fs.readFile(path.join(root, 'src', 'i18n', 'dictionaries', 'en.json'), 'utf-8'),
  ]);
  const zh = JSON.parse(zhRaw);
  const en = JSON.parse(enRaw);

  await t.test('protection page renders fifth section', () => {
    assert.match(pageSrc, /FederalCaptchaSection/);
    assert.match(pageSrc, /RateLimitPolicySection/);
  });

  await t.test('admin client exposes get/updateFederalPolicy via BFF relative', () => {
    assert.match(adminApiSrc, /getFederalPolicy/);
    assert.match(adminApiSrc, /updateFederalPolicy/);
    assert.match(adminApiSrc, /\/api\/admin\/protection\/federal/);
    assert.doesNotMatch(adminApiSrc, /http:\/\/|https:\/\//);
  });

  await t.test('types define frozen 6-field config + defaults', () => {
    assert.match(typesSrc, /FederalProtectionConfig/);
    assert.match(typesSrc, /FederalKinds/);
    assert.match(typesSrc, /powBits/);
    assert.match(typesSrc, /geometryLevel/);
    assert.match(typesSrc, /timeoutSec/);
    assert.match(typesSrc, /FEDERAL_POLICY_DEFAULTS/);
    // strictTimeout 不属 API（additionalProperties:false），类型内不得出现该字段
    assert.doesNotMatch(typesSrc, /strictTimeoutSec/);
  });

  await t.test('section rows: 3 switches + default select + bits + segmented + timeout', () => {
    assert.match(sectionSrc, /sliderEnabled|sliderOn/);
    assert.match(sectionSrc, /geometryEnabled|geometryOn/);
    assert.match(sectionSrc, /powEnabled|powOn/);
    assert.match(sectionSrc, /kindsValid|at least 1|至少保留/);
    assert.match(sectionSrc, /<select/);
    assert.match(sectionSrc, /defaultKind/);
    assert.match(sectionSrc, /type="range"/);
    assert.match(sectionSrc, /role="radiogroup"/);
    assert.match(sectionSrc, /timeoutSec|federal-timeout/);
    assert.match(sectionSrc, /strictTimeoutHint/);
  });

  await t.test('strict semantics: inline error no clamp, integer regex', () => {
    assert.match(sectionSrc, /isIntegerInRange/);
    assert.match(sectionSrc, /8, 24/);
    assert.match(sectionSrc, /1, 3/);
    assert.match(sectionSrc, /5, 60/);
    assert.match(sectionSrc, /aria-invalid/);
    assert.match(sectionSrc, /role="alert"/);
    assert.doesNotMatch(sectionSrc, /Math\.min\(|Math\.max\(/);
  });

  await t.test('dangerous confirms + four save states + 60s', () => {
    assert.match(sectionSrc, /confirmKind/);
    assert.match(sectionSrc, /lowBits|powBitsDanger/);
    assert.match(sectionSrc, /highBits|powBitsHighWarn/);
    assert.match(sectionSrc, /variant="destructive"/);
    assert.match(sectionSrc, /SaveState.*idle.*saving.*success.*error/s);
    assert.match(sectionSrc, /60/);
  });

  await t.test('admin.federal dict + captcha.geometry/pow/federal + notifications badge + FEDERAL error en/zh', () => {
    for (const k of ['title', 'powBits', 'geometryLevel', 'timeoutSec', 'saved']) {
      assert.ok(zh.admin?.federal?.[k], `zh admin.federal.${k} missing`);
      assert.ok(en.admin?.federal?.[k], `en admin.federal.${k} missing`);
    }
    for (const k of ['title', 'verify', 'timeout']) {
      assert.ok(zh.captcha?.geometry?.[k], `zh captcha.geometry.${k} missing`);
      assert.ok(en.captcha?.geometry?.[k], `en captcha.geometry.${k} missing`);
    }
    for (const k of ['title', 'start', 'timeout']) {
      assert.ok(zh.captcha?.pow?.[k], `zh captcha.pow.${k} missing`);
      assert.ok(en.captcha?.pow?.[k], `en captcha.pow.${k} missing`);
    }
    for (const k of ['modalTitle', 'switchKind', 'fallbackToSlider']) {
      assert.ok(zh.captcha?.federal?.[k], `zh captcha.federal.${k} missing`);
      assert.ok(en.captcha?.federal?.[k], `en captcha.federal.${k} missing`);
    }
    for (const k of ['badgeAria', 'badgeTooltip', 'unreadTitle']) {
      assert.ok(zh.notifications?.[k], `zh notifications.${k} missing`);
      assert.ok(en.notifications?.[k], `en notifications.${k} missing`);
    }
    assert.ok(zh.apiErrors?.ERR_INVALID_FEDERAL_POLICY, 'zh missing FEDERAL policy code');
    assert.ok(en.apiErrors?.ERR_INVALID_FEDERAL_POLICY, 'en missing FEDERAL policy code');
  });
});

test('Notify badge sum: parallel unread-count + DM, 99+ cap, aria split, WS split, events, 30s poll, no inbox', async (t) => {
  const root = process.cwd();
  const read = (p) => fs.readFile(path.join(root, p), 'utf-8');
  const [navSrc, headerSrc, publicDictSrc] = await Promise.all([
    read('src/components/layout/UserNav.tsx'),
    read('src/components/layout/Header.tsx'),
    read('src/i18n/public-dictionary.ts'),
  ]);

  await t.test('parallel fetch DM + notify sum, no table mixing', () => {
    assert.match(navSrc, /\/api\/v1\/messages\/unread/);
    assert.match(navSrc, /\/api\/notifications\/unread-count/);
    assert.match(navSrc, /Promise\.all/);
    assert.match(navSrc, /dmUnread \+ notifyUnread|total = dmUnread/);
  });

  await t.test('99+ cap + aria-label split + tooltip', () => {
    assert.match(navSrc, /99\+/);
    assert.match(navSrc, /aria-label/);
    assert.match(navSrc, /badgeAriaTemplate/);
    assert.match(navSrc, /badgeTooltipTemplate/);
    assert.match(navSrc, /title=\{tooltip\}/);
  });

  await t.test('WS notification split + notifications-read event + 30s poll reuse', () => {
    assert.match(navSrc, /message\.type === 'notification'/);
    assert.match(navSrc, /new_message/);
    assert.match(navSrc, /fetchNotifyOnly/);
    assert.match(navSrc, /fetchDmOnly/);
    assert.match(navSrc, /notifications-read/);
    assert.match(navSrc, /notifications-received/);
    assert.match(navSrc, /setInterval\(fetchUnreadCount, 30000\)/);
  });

  await t.test('no inbox page introduced', async () => {
    const glob = await import('node:fs/promises').then((m) => m.default);
    // 收件箱页另立项：不得新增 /notifications 页面目录
    let hasNotificationsPage = false;
    try {
      await glob.access(path.join(root, 'src', 'app', 'notifications', 'page.tsx'));
      hasNotificationsPage = true;
    } catch {
      hasNotificationsPage = false;
    }
    assert.equal(hasNotificationsPage, false, 'notifications inbox page must not exist (separate project)');
  });

  await t.test('Header passes public badge templates, public dict picks badge keys', () => {
    assert.match(headerSrc, /badgeAriaTemplate/);
    assert.match(headerSrc, /badgeTooltipTemplate/);
    assert.match(publicDictSrc, /notifications:\s*pick\(dict\.notifications/);
    assert.match(publicDictSrc, /badgeAria/);
  });
});
