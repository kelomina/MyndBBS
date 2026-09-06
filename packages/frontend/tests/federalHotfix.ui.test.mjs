import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

/**
 * P0 hotfix 回归（channel-general 23:45 诊断帧 R0–R3）：
 * - H2：unlock 模式只签发 slider（门控 issue kind），其余题型解锁入口不可选（附说明文案，不许静默失败）；verify 模式不受影响。
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

test('H2 unlock gate: unlock issues slider only, others unselectable with note, only slider exchanges token', async (t) => {
  const root = process.cwd();
  const read = (p) => fs.readFile(path.join(root, p), 'utf-8');
  const [modalSrc, zhRaw, enRaw, publicDictSrc] = await Promise.all([
    read('src/components/federal/FederalCaptchaModal.tsx'),
    fs.readFile(path.join(root, 'src', 'i18n', 'dictionaries', 'zh.json'), 'utf-8'),
    fs.readFile(path.join(root, 'src', 'i18n', 'dictionaries', 'en.json'), 'utf-8'),
    read('src/i18n/public-dictionary.ts'),
  ]);

  await t.test('doIssue gates kind to slider in unlock mode, verify mode unaffected', () => {
    assert.match(modalSrc, /isUnlockMode/);
    assert.match(modalSrc, /isUnlockMode \? 'slider'/);
    // 打开仍为 void doIssue()（门控在内部生效；verify 模式走服务端 effectiveKind，换一种经 doIssue(next)）
    assert.match(modalSrc, /void doIssue\(\)/);
    assert.match(modalSrc, /void doIssue\(next\)/);
    assert.match(modalSrc, /issueFederalCaptcha\(effectiveHint\)/);
  });

  await t.test('switch disabled in unlock with tip + persistent note (no silent failure)', () => {
    assert.match(modalSrc, /if \(isUnlockMode\) return/);
    assert.match(modalSrc, /disabled=\{verifying \|\| cooling \|\| isUnlockMode\}/);
    assert.match(modalSrc, /unlockSliderOnlyTip/);
    assert.match(modalSrc, /unlockSliderOnlyNote/);
    assert.match(modalSrc, /role="note"/);
    // verify 模式受限换一种 ghost 保留（禁自由三 tab）
    assert.match(modalSrc, /switchKind/);
    assert.doesNotMatch(modalSrc, /role="tablist"/);
  });

  await t.test('only slider exchanges token; geometry/pow never fetch unlock', () => {
    assert.match(modalSrc, /if \(kind !== 'slider'\) return false/);
    assert.match(modalSrc, /postUnlock/);
    assert.match(modalSrc, /handleFallbackSlider/);
    // geometry/pow 防御性直接回落（不消费联邦挑战）
    assert.match(modalSrc, /unlock 入口无几何题体|unlock 入口无 PoW 题体/);
  });

  await t.test('unlock-only copy exists en/zh + public pick (anonymous unlock modal bilingual)', () => {
    const zh = JSON.parse(zhRaw);
    const en = JSON.parse(enRaw);
    assert.ok(zh.captcha?.federal?.unlockSliderOnlyNote, 'zh captcha.federal.unlockSliderOnlyNote missing');
    assert.ok(zh.captcha?.federal?.unlockSliderOnlyTip, 'zh captcha.federal.unlockSliderOnlyTip missing');
    assert.ok(en.captcha?.federal?.unlockSliderOnlyNote, 'en captcha.federal.unlockSliderOnlyNote missing');
    assert.ok(en.captcha?.federal?.unlockSliderOnlyTip, 'en captcha.federal.unlockSliderOnlyTip missing');
    assert.match(publicDictSrc, /unlockSliderOnlyNote/);
    assert.match(publicDictSrc, /unlockSliderOnlyTip/);
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
