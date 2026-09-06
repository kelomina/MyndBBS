import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

/**
 * P0 hotfix 回归（channel-general 23:45 诊断帧 R0–R3）+ v1.0.2 去 H2 门控：
 * - H2（v1.0.2 已下线门控）：unlock 恢复三题型（删 slider 门控 + 说明横幅下线，换题 ghost 受限可用）；
 *   verify 成功凭 redeemToken+kind 调 /unlock 兑换 unlockToken（失败统一 error 态 + 换题，不静默）；
 *   旧滑块直兑路径仅 legacy fallback 保留兼容。
 * - H3：behaviorSamples 透出 s（stroke）；纯鼠标拖针 / 1560 微槽 / 严格 ±30 / 15s 语义不变。
 * - H4：小时域 0–11（与后端 isValidTargetHour/generateTargetHour 对齐）；targetHour=0 正常签发验证。
 * - H5：联邦跨端固定向量 UI 断言（与后端同向量，H1 '|' 口径；注释互指后端 federalPow.ts）。
 */

// 与前端 meetsLeadingZeroBits 同算法（MSB 优先逐位计数，见 src/lib/federal/sha256.ts）。
function leadingZeroBits(hashHex) {
  let bits = 0;
  for (const ch of hashHex) {
    const v = parseInt(ch, 16);
    for (let b = 3; b >= 0; b--) {
      if ((v >> b) & 1) return bits;
      bits++;
    }
  }
  return bits;
}

// H5 跨端固定向量（H1 '|' 口径；后端 H1 后 powNonce 与本向量同值 '13'）。
const PIPE_CHALLENGE = '0123456789abcdef0123456789abcdef';
const PIPE_NONCE = '13';
const PIPE_BITS = 8;
const PIPE_EXPECT_DIGEST = '0025b120f0ff25a607c96117b781129351077fd0a0b28c91f09ef7ac5608abe2';

test('H2 unlock redeem v1.0.2: unlock restores three kinds, verify->redeem->unlock, legacy direct kept', async (t) => {
  const root = process.cwd();
  const read = (p) => fs.readFile(path.join(root, p), 'utf-8');
  const [modalSrc, apiSrc, unlockSrc, zhRaw, enRaw, publicDictSrc] = await Promise.all([
    read('src/components/federal/FederalCaptchaModal.tsx'),
    read('src/lib/federal/federal-api.ts'),
    read('src/lib/rate-limit/unlock.ts'),
    fs.readFile(path.join(root, 'src', 'i18n', 'dictionaries', 'zh.json'), 'utf-8'),
    fs.readFile(path.join(root, 'src', 'i18n', 'dictionaries', 'en.json'), 'utf-8'),
    read('src/i18n/public-dictionary.ts'),
  ]);

  await t.test('doIssue no longer gates kind to slider in unlock mode', () => {
    // v1.0.2 去门控：effectiveHint 直接取 kindHint，不再按 isUnlockMode 强制 slider
    assert.doesNotMatch(modalSrc, /isUnlockMode \? 'slider'/);
    assert.match(modalSrc, /const effectiveHint.*= kindHint/);
    // 打开仍为 void doIssue()（服务端 effectiveKind），换一种经 doIssue(next) 受限 hint
    assert.match(modalSrc, /void doIssue\(\)/);
    assert.match(modalSrc, /void doIssue\(next\)/);
    assert.match(modalSrc, /issueFederalCaptcha\(effectiveHint\)/);
  });

  await t.test('switch ghost restored in unlock (no disabled gate, no slider-only banner)', () => {
    // 换题 ghost 恢复受限可用：不再 early-return，不再 disabled||isUnlockMode
    assert.doesNotMatch(modalSrc, /if \(isUnlockMode\) return/);
    assert.doesNotMatch(modalSrc, /disabled=\{verifying \|\| cooling \|\| isUnlockMode\}/);
    assert.match(modalSrc, /disabled=\{verifying \|\| cooling\}/);
    // H2 说明横幅下线：unlockSliderOnly 文案与 role=note 横幅均移除
    assert.doesNotMatch(modalSrc, /unlockSliderOnlyTip/);
    assert.doesNotMatch(modalSrc, /unlockSliderOnlyNote/);
    // 受限换一种 ghost 保留（禁自由三 tab）
    assert.match(modalSrc, /switchKind/);
    assert.match(modalSrc, /disabledKinds/);
    assert.doesNotMatch(modalSrc, /role="tablist"/);
  });

  await t.test('unlock three kinds exchange via redeemToken+kind; failure goes error+refresh, never silent', () => {
    // 联邦兑换助手存在：redeem 路径 + legacy 直兑兼容路径
    assert.match(modalSrc, /exchangeWithRedeem/);
    assert.match(modalSrc, /exchangeLegacySlider/);
    assert.match(modalSrc, /redeemToken/);
    // 三题型均走 verify->redeem->unlock（slider 联邦态亦先 verify，不再直兑）
    assert.match(modalSrc, /exchangeWithRedeem\(captchaId, 'slider'/);
    assert.match(modalSrc, /exchangeWithRedeem\(issue\.captchaId, 'geometry'/);
    assert.match(modalSrc, /exchangeWithRedeem\(issue\.captchaId, 'pow'/);
    // verify 成功体含 redeem 三字段（federal-api 类型与调用方校验）
    assert.match(apiSrc, /redeemToken: string/);
    assert.match(apiSrc, /redeemExpiresInSec/);
    assert.match(apiSrc, /redeemExpiresAt/);
    assert.match(modalSrc, /verified\.redeemToken/);
    // 失败统一 error 态 + 换题（兑换 false / redeem 缺失均 error + scheduleRefresh，不静默）
    assert.match(modalSrc, /setState\('error'\)/);
    assert.match(modalSrc, /scheduleRefresh\(\)/);
    // 旧滑块直兑路径保留兼容（unlock.ts 双模式 + modal legacy 分支）
    assert.match(unlockSrc, /UnlockRedeemRequest/);
    assert.match(unlockSrc, /redeemToken/);
    assert.match(unlockSrc, /captchaId/);
    assert.match(unlockSrc, /dragPath/);
    assert.match(modalSrc, /exchangeLegacySlider\(captchaId/);
    assert.match(modalSrc, /fallbackSlider/);
    // 防御性回落文案已删（不再“unlock 入口无几何/PoW 题体直接回落”）
    assert.doesNotMatch(modalSrc, /unlock 入口无几何题体|unlock 入口无 PoW 题体/);
    assert.doesNotMatch(modalSrc, /if \(kind !== 'slider'\) return false/);
  });

  await t.test('unlockSliderOnly copy removed en/zh + public pick (banner offline)', () => {
    const zh = JSON.parse(zhRaw);
    const en = JSON.parse(enRaw);
    assert.equal(zh.captcha?.federal?.unlockSliderOnlyNote, undefined);
    assert.equal(zh.captcha?.federal?.unlockSliderOnlyTip, undefined);
    assert.equal(en.captcha?.federal?.unlockSliderOnlyNote, undefined);
    assert.equal(en.captcha?.federal?.unlockSliderOnlyTip, undefined);
    assert.doesNotMatch(publicDictSrc, /unlockSliderOnlyNote/);
    assert.doesNotMatch(publicDictSrc, /unlockSliderOnlyTip/);
  });
});

test('H3 behaviorSamples carry stroke s; drag/slot/strict semantics unchanged', async (t) => {
  const root = process.cwd();
  const read = (p) => fs.readFile(path.join(root, p), 'utf-8');
  const [clockSrc, apiSrc] = await Promise.all([
    read('src/components/federal/GeometryClock.tsx'),
    read('src/lib/federal/federal-api.ts'),
  ]);

  await t.test('BehaviorSample has s + getSolution passes s through', () => {
    assert.match(apiSrc, /s: number/);
    assert.match(clockSrc, /s: s\.s/);
    assert.match(clockSrc, /behaviorSamples/);
    assert.match(clockSrc, /getSolution/);
  });

  await t.test('pure mouse drag + 1560 slots + strict 30/15s untouched', () => {
    assert.match(clockSrc, /TOTAL_SLOTS = 1560/);
    assert.match(clockSrc, /SLOTS_PER_NUM = 130/);
    assert.match(clockSrc, /STRICT_DEV = 30/);
    assert.match(clockSrc, /strength === 'strict' \? 15 : 60/);
    assert.match(clockSrc, /onPointerDown/);
    assert.match(clockSrc, /setPointerCapture/);
    assert.match(clockSrc, /requestAnimationFrame/);
    assert.doesNotMatch(clockSrc, /input[^>]*type="range"/);
  });
});

test('H4 hour domain 0-11 aligned with backend (targetHour=0 issues+verifies)', async (t) => {
  const root = process.cwd();
  const read = (p) => fs.readFile(path.join(root, p), 'utf-8');
  const [apiSrc, modalSrc] = await Promise.all([
    read('src/lib/federal/federal-api.ts'),
    read('src/components/federal/FederalCaptchaModal.tsx'),
  ]);

  await t.test('hasGeometryInteractable accepts 0-11, rejects 1-12-only semantics', () => {
    assert.match(apiSrc, /targetHour < 0/);
    assert.match(apiSrc, /targetHour > 11/);
    assert.doesNotMatch(apiSrc, /targetHour >= 1/);
    assert.doesNotMatch(apiSrc, /targetHour <= 12/);
  });

  await t.test('modal fallback perm is 0-11 arrangement (backend generatePerm)', () => {
    assert.match(modalSrc, /\[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11\]/);
    assert.doesNotMatch(modalSrc, /\[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12\]/);
  });
});

test('H5 cross-end fixed vector matches backend same vector (H1 pipe caliber)', async (t) => {
  const root = process.cwd();
  const read = (p) => fs.readFile(path.join(root, p), 'utf-8');
  const shaSrc = await read('src/lib/federal/sha256.ts');

  await t.test("pipe vector nonce='13' passes 8 bits with exact digest", () => {
    const digest = createHash('sha256').update(`${PIPE_CHALLENGE}|${PIPE_NONCE}`, 'utf8').digest('hex');
    assert.equal(digest, PIPE_EXPECT_DIGEST);
    assert.ok(leadingZeroBits(digest) >= PIPE_BITS, `expected >=8 leading zero bits, got ${leadingZeroBits(digest)}`);
  });

  await t.test('vectors discriminate calibers (old backend data invalid post-H1)', () => {
    // '|' 口径下旧 nonce='0' 必失败（69ace822…，1bit）
    const pipeZero = createHash('sha256').update(`${PIPE_CHALLENGE}|0`, 'utf8').digest('hex');
    assert.ok(leadingZeroBits(pipeZero) < PIPE_BITS, `pipe nonce=0 must fail 8 bits, got ${leadingZeroBits(pipeZero)}`);
    // 无 '|' 口径下 nonce='0' 通过（000cb919…，12bits）——即 P0 前后端错位证据
    const nopipeZero = createHash('sha256').update(`${PIPE_CHALLENGE}0`, 'utf8').digest('hex');
    assert.ok(leadingZeroBits(nopipeZero) >= PIPE_BITS, 'nopipe nonce=0 documents pre-H1 backend behavior');
    // 无 '|' 口径下 nonce='13' 失败（0552b1…，5bits）——与本向量严格区分
    const nopipe13 = createHash('sha256').update(`${PIPE_CHALLENGE}13`, 'utf8').digest('hex');
    assert.ok(leadingZeroBits(nopipe13) < PIPE_BITS, 'nopipe nonce=13 must fail: proves pipe is load-bearing');
  });

  await t.test('frontend powHash + Worker both use pipe join (main/worker same caliber)', () => {
    assert.match(shaSrc, /\$\{challenge\}\|\$\{nonce\}/);
    assert.match(shaSrc, /challenge \+ '\|'/);
  });

  await t.test('fixed digest + backend mutual pointer documented in source', () => {
    assert.match(shaSrc, /0025b120/);
    assert.match(shaSrc, /federalPow/);
    assert.match(shaSrc, /federalHotfix/);
  });
});
