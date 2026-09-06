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

test('PowCollector: Worker pure JS SHA-256 + silent progress + 10s auto-downgrade/fallback (COPY-CHANGE-1 v1.1)', async (t) => {
  const root = process.cwd();
  const read = (p) => fs.readFile(path.join(root, p), 'utf-8');
  const [powSrc, shaSrc, modalSrc] = await Promise.all([
    read('src/components/federal/PowCollector.tsx'),
    read('src/lib/federal/sha256.ts'),
    read('src/components/federal/FederalCaptchaModal.tsx'),
  ]);

  await t.test('Worker + pure JS SHA-256 zero-dep + silent progress, no manual cancel', () => {
    assert.match(powSrc, /new Worker/);
    assert.match(powSrc, /POW_WORKER_SOURCE/);
    assert.match(powSrc, /postMessage/);
    assert.match(powSrc, /terminate\(\)/);
    // COPY-CHANGE-1 v1.1 D15：删取消按钮与用户中断路径（仅保留 unmount/切换/超时内部 cleanup terminate）
    assert.doesNotMatch(powSrc, /handleCancel/);
    assert.doesNotMatch(powSrc, /onCancel/);
    // D1/E2 静默进度：进度条 + 纯数字 nonce 行 + 空态 role=status（无 pow.* 文案依赖）
    assert.match(powSrc, /nonce-live/);
    assert.match(powSrc, /data-testid="pow-mining"/);
    assert.match(powSrc, /role="status"/);
    assert.match(shaSrc, /sha256Hex/);
    assert.match(shaSrc, /meetsLeadingZeroBits/);
    assert.match(shaSrc, /powHash/);
    assert.doesNotMatch(shaSrc, /from 'crypto'|require\('crypto'\)|node:crypto/);
  });

  await t.test('10s dual-track timeout + auto-downgrade once + auto-fallback slider-low', () => {
    assert.match(powSrc, /timeoutSec = 10/);
    assert.match(powSrc, /setTimeout\(handleTimeout, timeoutSec \* 1000\)/);
    // 双轨：timerRef 超时 + 主线程分片 elapsed 检查
    assert.match(powSrc, /\(nowMs - startRef\.current\) \/ 1000 > timeoutSec/);
    assert.match(powSrc, /suggestedBits/);
    assert.match(powSrc, /bits - 4/);
    // D16/D23：删手动降档/切换按钮，改自动链（Modal 侧计数恰 1 + 直接回落）
    assert.doesNotMatch(powSrc, /t\('downgrade'/);
    assert.doesNotMatch(powSrc, /t\('fallbackGo'/);
    assert.match(modalSrc, /powDowngradeCountRef/);
    assert.match(modalSrc, /handleFallbackSlider/);
    assert.match(modalSrc, /handlePowTimeout/);
  });

  await t.test('auto-start on issue success with triple guard (no manual start button)', () => {
    // COPY-CHANGE-1 v1.1 §6.2：删开始按钮，issue 成功回调自动开算（经挂载 effect，不经点击）
    assert.doesNotMatch(powSrc, /t\('start'/);
    assert.doesNotMatch(powSrc, /Start computing/);
    // 三重守卫：captchaId+challenge 快照 + miningRef/solvedRef + issueSeqRef（Modal 侧 seq 守卫）
    assert.match(powSrc, /captchaId/);
    assert.match(powSrc, /miningRef/);
    assert.match(powSrc, /solvedRef/);
    assert.match(modalSrc, /issueSeqRef/);
    assert.match(modalSrc, /powDowngradeCountRef/);
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

  await t.test('admin.federal dict + captcha.geometry/federal retained + pow deleted + notifications badge + FEDERAL error en/zh (COPY-CHANGE-1 v1.1)', () => {
    for (const k of ['title', 'powBits', 'geometryLevel', 'timeoutSec', 'saved']) {
      assert.ok(zh.admin?.federal?.[k], `zh admin.federal.${k} missing`);
      assert.ok(en.admin?.federal?.[k], `en admin.federal.${k} missing`);
    }
    // geometry 保留 11 键存在
    for (const k of ['target', 'verify', 'timeout', 'targetValue', 'idleCountdown']) {
      assert.ok(zh.captcha?.geometry?.[k], `zh captcha.geometry.${k} missing`);
      assert.ok(en.captcha?.geometry?.[k], `en captcha.geometry.${k} missing`);
    }
    // geometry 删 8 键不存在
    for (const k of ['title', 'desc', 'current', 'tolerance', 'idle', 'degraded', 'again', 'faceValue']) {
      assert.equal(zh.captcha?.geometry?.[k], undefined, `zh captcha.geometry.${k} should be deleted`);
      assert.equal(en.captcha?.geometry?.[k], undefined, `en captcha.geometry.${k} should be deleted`);
    }
    // pow 17 键全删：整段不存在
    assert.equal(zh.captcha?.pow, undefined, 'zh captcha.pow should be deleted');
    assert.equal(en.captcha?.pow, undefined, 'en captcha.pow should be deleted');
    // federal 保留 9 键存在
    for (const k of ['modalTitle', 'switchKind', 'kindSlider', 'strengthHint', 'loading']) {
      assert.ok(zh.captcha?.federal?.[k], `zh captcha.federal.${k} missing`);
      assert.ok(en.captcha?.federal?.[k], `en captcha.federal.${k} missing`);
    }
    // federal 删 4 键不存在
    for (const k of ['modalDesc', 'fallbackToSlider', 'degradedNote', 'timeoutNote']) {
      assert.equal(zh.captcha?.federal?.[k], undefined, `zh captcha.federal.${k} should be deleted`);
      assert.equal(en.captcha?.federal?.[k], undefined, `en captcha.federal.${k} should be deleted`);
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

test('B3 几何目标与倒计时显隐：回包对接 + 回落门控 + 目标行/倒计时testid', async (t) => {
  const root = process.cwd();
  const read = (p) => fs.readFile(path.join(root, p), 'utf-8');
  const [apiSrc, modalSrc, clockSrc] = await Promise.all([
    read('src/lib/federal/federal-api.ts'),
    read('src/components/federal/FederalCaptchaModal.tsx'),
    read('src/components/federal/GeometryClock.tsx'),
  ]);

  await t.test('回包对接：后端恒返{perm,targetHour}，svg可选，判定0-11对齐', () => {
    // B3复现：后端controller:186恒返puzzle{perm,targetHour}（0-11），无svg；前端svg已改可选，判定与后端isValid对齐
    assert.match(apiSrc, /svg\?:/);
    assert.match(apiSrc, /targetHour\?:/);
    assert.match(apiSrc, /perm\?:/);
    assert.match(apiSrc, /hasGeometryInteractable/);
    assert.match(apiSrc, /targetHour < 0/);
    assert.match(apiSrc, /targetHour > 11/);
    assert.match(apiSrc, /perm\.length !== 12/);
  });

  await t.test('回落门控：缺targetHour/perm才degraded+fallbackSlider，非误触发', () => {
    assert.match(modalSrc, /hasGeometryInteractable\(res\.puzzle\)/);
    assert.match(modalSrc, /setState\('degraded'\)/);
    assert.match(modalSrc, /setFallbackSlider\(true\)/);
    // 几何挂载仅过门控后（fallbackSlider优先，geometry分支挂Clock）
    assert.match(modalSrc, /fallbackSlider \?/);
    assert.match(modalSrc, /issue\?\.kind === 'geometry'/);
  });

  await t.test('目标行与倒计时显隐正确（挂载显、回落隐）', () => {
    // Clock挂载即显现目标值+倒计时（testid可断言），回落/loading未挂载即隐去（Modal分支保证）
    assert.match(clockSrc, /data-testid="geometry-clock"/);
    assert.match(clockSrc, /data-testid="geometry-target"/);
    assert.match(clockSrc, /data-testid="geometry-countdown"/);
    assert.match(clockSrc, /role="status"/);
    assert.match(clockSrc, /idleLeft/);
    assert.match(clockSrc, /targetHour/);
  });
});
