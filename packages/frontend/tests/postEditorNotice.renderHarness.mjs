#!/usr/bin/env node
/**
 * Callers: [manual frontend self-check, QA visual walkthrough]
 * Callees: [typescript.transpileModule, postcss, @tailwindcss/postcss, react, react-dom/client, lucide-react]
 * Description: Builds a dependency-free local render harness that mounts the real
 *   `src/components/PostEditor.tsx` in a browser with the real zh/en dictionaries and the real
 *   Tailwind build, so the image notice states can be screenshotted without a backend.
 *   It is not part of `node --test`; run it explicitly (see the printed path).
 * 描述：构建一个免额外依赖的本地渲染自检台：在浏览器里挂载**真实的** `src/components/PostEditor.tsx`、
 *   真实的 zh/en 字典与真实 Tailwind 产物，用于在无后端环境时肉眼核对图片提示条四态。
 *   不属于 `node --test` 用例，需显式运行（输出目录会打印）。
 * Variables: `--out` overrides the output directory; default is `reports/posteditor-notice`.
 * 变量：`--out` 覆盖输出目录，默认 `reports/posteditor-notice`。
 * Integration: Only reads sources; writes artifacts under the gitignored `reports/` tree.
 * 接入方式：只读源码，产物写到已 gitignore 的 `reports/` 下。
 * Error Handling: Fails loudly when a runtime module or the Tailwind build cannot be resolved.
 * 错误处理：运行时模块或 Tailwind 构建不可解析时直接报错，不出半成品产物。
 * Keywords: render harness, screenshot self-check, notice states, 渲染自检, 截图取证
 */
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const nodeRequire = createRequire(path.join(root, 'package.json'));
const ts = nodeRequire('typescript');
const tailwindPlugin = nodeRequire('@tailwindcss/postcss');
// postcss is a transitive dependency of @tailwindcss/postcss, not a direct frontend dep.
// postcss 是 @tailwindcss/postcss 的间接依赖，前端包并未直接声明。
const postcss = createRequire(nodeRequire.resolve('@tailwindcss/postcss'))('postcss');

const outIndex = process.argv.indexOf('--out');
const outDir = outIndex > -1 ? path.resolve(process.argv[outIndex + 1]) : path.join(root, 'reports', 'posteditor-notice');

/**
 * Callers: [buildHarness]
 * Callees: [createRequire]
 * Description: Resolves a package entry point and returns its package root directory.
 * 描述：解析包入口并返回其包根目录。
 * Variables: `spec` is a resolvable module specifier such as `react` or `react-dom/client`.
 * 变量：`spec` 为可解析的模块名。
 * Integration: Used to reach React's CJS builds for the browser runtime.
 * 接入方式：为浏览器运行时取 React 的 CJS 产物。
 * Error Handling: Throws when the specifier cannot be resolved.
 * 错误处理：解析失败即抛错。
 * Keywords: require.resolve, package root, 包根
 */
function packageRoot(spec, resolver) {
  const entry = (resolver || nodeRequire).resolve(spec);
  const rel = path.relative(root, entry);
  const marker = `${path.join('node_modules')}${path.sep}`;
  const tail = rel.includes(marker) ? rel.slice(rel.lastIndexOf(marker) + marker.length) : entry;
  const first = tail.split(path.sep)[0];
  return entry.slice(0, entry.length - tail.length) + first;
}

async function buildHarness() {
  const reactRoot = packageRoot('react');
  const reactDomRoot = packageRoot('react-dom/client');
  // scheduler is a react-dom dependency, not declared by the frontend package itself.
  // scheduler 是 react-dom 的依赖，前端包本身未声明。
  const schedulerRoot = packageRoot('scheduler', createRequire(path.join(reactDomRoot, 'package.json')));
  const lucideFile = nodeRequire.resolve('lucide-react');

  const runtimeModules = {
    react: path.join(reactRoot, 'cjs', 'react.production.js'),
    'react/jsx-runtime': path.join(reactRoot, 'cjs', 'react-jsx-runtime.production.js'),
    scheduler: path.join(schedulerRoot, 'cjs', 'scheduler.production.js'),
    'react-dom': path.join(reactDomRoot, 'cjs', 'react-dom.production.js'),
    'react-dom/client': path.join(reactDomRoot, 'cjs', 'react-dom-client.production.js'),
    'lucide-react': lucideFile,
  };

  const editorTs = await fs.readFile(path.join(root, 'src', 'components', 'PostEditor.tsx'), 'utf-8');
  const editorJs = ts
    .transpileModule(editorTs, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
        filename: 'PostEditor.tsx',
      },
    })
    .outputText.replace('require("@myndbbs/shared")', 'require("harness:shared")')
    .replace('require("../lib/api/fetcher")', 'require("harness:fetcher")');

  const sharedSrc = await fs.readFile(path.join(root, '..', 'shared', 'src', 'constants', 'index.ts'), 'utf-8');
  const maxExpr = sharedSrc.match(/export const POST_ATTACHMENT_MAX_BYTES\s*=\s*([0-9*\s]+)\/\//);
  if (!maxExpr) throw new Error('POST_ATTACHMENT_MAX_BYTES not found in packages/shared/src/constants/index.ts');
  const maxBytes = maxExpr[1]
    .split('*')
    .map((part) => Number(part.trim()))
    .reduce((acc, value) => acc * value, 1);

  const [zh, en] = await Promise.all([
    fs.readFile(path.join(root, 'src', 'i18n', 'dictionaries', 'zh.json'), 'utf-8'),
    fs.readFile(path.join(root, 'src', 'i18n', 'dictionaries', 'en.json'), 'utf-8'),
  ]);

  // Inline module sources, keyed the way the browser loader will look them up.
  // 内联模块源码，键名与浏览器加载器一致。
  const inlineModules = {
    'harness:shared': `module.exports = { POST_ATTACHMENT_MAX_BYTES: ${maxBytes} };`,
    // Mirrors the real client fetch path: every call is recorded, and the response shape is
    // selectable so the server-413 and proxy-HTML-413 branches can be driven for real.
    // 复刻真实客户端 fetch 路径：记录每次调用，并可切换响应形，用来真跑服务端 413 与反代 HTML 413 分支。
    'harness:fetcher': `module.exports = {
      fetchWithAuth: async (url, init) => {
        const h = globalThis.harness;
        h.fetchLog.push({ url, method: (init && init.method) || 'GET' });
        return globalThis.fetch(url, init);
      },
    };`,
    'harness:posteditor': editorJs,
  };

  const sources = {};
  for (const [id, file] of Object.entries(runtimeModules)) {
    sources[id] = await fs.readFile(file, 'utf-8');
  }
  Object.assign(sources, inlineModules);

  const globalsCss = (await fs.readFile(path.join(root, 'src', 'app', 'globals.css'), 'utf-8'))
    .replace(/^@config .*$/m, '')
    .replace('@import "tailwindcss";', '@import "tailwindcss";\n@source "../../src/**/*.{ts,tsx}";');
  const css = await postcss([tailwindPlugin()]).process(globalsCss, {
    from: path.join(root, 'src', 'app', 'globals.css'),
  });

  const boot = await fs.readFile(path.join(root, 'tests', 'postEditorNotice.harnessBoot.mjs'), 'utf-8');

  const html = `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>PostEditor image notice harness</title>
<style>${css.css}</style>
</head>
<body>
<div id="frame" style="padding:24px;background:var(--color-background);min-height:100vh;box-sizing:border-box">
  <div id="stage"></div>
  <pre id="probe" style="font:11px/1.45 Consolas,monospace;white-space:pre-wrap;margin:16px 0 0;color:var(--color-muted)"></pre>
</div>
<script>${safeInline(`globalThis.__HARNESS_SOURCES__ = ${JSON.stringify(sources)};`)}</script>
<script>${safeInline(`globalThis.__HARNESS_DICTS__ = ${JSON.stringify({ zh: JSON.parse(zh), en: JSON.parse(en) })};`)}</script>
<script>${safeInline(boot)}</script>
</body>
</html>
`;

  // Everything is inlined on purpose: a stray .js under the repo would get picked up by
  // `eslint .`, and the artifact stays a single file QA can open or copy.
  // 刻意全部内联：仓库里落单的 .js 会被 `eslint .` 扫到，而且单文件产物更方便 QA 直接打开或拷走。
  await fs.mkdir(outDir, { recursive: true });
  await fs.rm(path.join(outDir, 'runtime.js'), { force: true });
  await fs.rm(path.join(outDir, 'dicts.js'), { force: true });
  await fs.rm(path.join(outDir, 'boot.js'), { force: true });
  await fs.writeFile(path.join(outDir, 'harness.html'), html, 'utf-8');
  console.log(`wrote ${path.join(outDir, 'harness.html')} (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`POST_ATTACHMENT_MAX_BYTES = ${maxBytes}`);
  if (process.argv.includes('--capture')) {
    await captureFrames(outDir);
  }
}

const FRAME_MATRIX = [
  { name: '01-tooltip-zh-light' },
  { name: '02-uploading-zh-light', query: 'mode=hang&action=pick&bytes=5242880' },
  { name: '03-toolarge-zh-light', query: 'action=pick' },
  { name: '04-failed-500-zh-light', query: 'mode=err500&action=pick&bytes=5242880' },
  { name: '05-proxy-html-413-zh-light', query: 'mode=html413&action=pick&bytes=5242880' },
  { name: '06-json-413-zh-light', query: 'mode=json413&action=pick&bytes=5242880' },
  { name: '07-success-zh-light', query: 'mode=ok&action=pick&bytes=5242880' },
  { name: '08-toolarge-zh-dark', query: 'theme=dark&action=pick' },
  { name: '09-proxy-html-413-zh-dark', query: 'theme=dark&mode=html413&action=pick&bytes=5242880' },
  { name: '10-toolarge-en-light', query: 'locale=en&action=pick' },
  { name: '11-toolarge-viewport320', viewport: { width: 320, height: 720 }, query: 'action=pick' },
  { name: '12-toolarge-viewport360', viewport: { width: 360, height: 720 }, query: 'action=pick' },
  { name: '13-pick-twice', query: 'action=pickTwice' },
  { name: '14-boundary-minus1-and-exact', query: 'mode=ok&action=boundary' },
  { name: '15-oversize-then-exact', query: 'mode=ok&action=oversizeThenOk' },
  { name: '16-mime-reject-zh-light', query: 'action=pick&type=text/plain&bytes=2048' },
  // D1 changed the uploading bar's colour layer, so both themes need a frame to prove the ratio.
  // D1 改的是上传中态色层，两个主题各留一帧才能证明比值。
  { name: '17-uploading-zh-dark', query: 'theme=dark&mode=hang&action=pick&bytes=5242880' },
];

const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];
const CDP_PORT = 9333;

/**
 * Callers: [buildHarness when --capture is passed]
 * Callees: [openCdpSession, captureOne]
 * Description: Drives the harness over CDP so the narrow frames get a real 320/360 CSS viewport
 *   (`Emulation.setDeviceMetricsOverride`); `--window-size` cannot do it because Edge clamps the
 *   window to ~500px (DESIGN §7.2 D4). Every frame yields a PNG plus its own probe JSON.
 * 描述：改走 CDP 驱动自检台，窄视口帧用 `Emulation.setDeviceMetricsOverride` 拿到**真实** 320/360
 *   CSS 视口（`--window-size` 做不到，Edge 会把窗口宽度钳到 ~500，DESIGN §7.2 D4）。每帧同时产出 PNG 与独立 probe JSON。
 * Variables: `outDir/frames` receives `<frame>.png` and `<frame>.probe.json`.
 * 变量：`outDir/frames` 下产出 `<frame>.png` 与 `<frame>.probe.json`。
 * Integration: Needs only an installed Edge plus Node's global fetch/WebSocket.
 * 接入方式：只需已装 Edge，以及 Node 内置 fetch/WebSocket，不下载 Playwright 浏览器。
 * Error Handling: Throws when no browser binary is found; a frame that never settles aborts with its name.
 * 错误处理：找不到浏览器即抛错；某帧始终不 ready 时带帧名中止，不静默出空图。
 * Keywords: CDP, device metrics, screenshot, evidence, 真视口取证
 */
async function captureFrames(outDir) {
  const { spawn } = await import('node:child_process');
  const edge = EDGE_CANDIDATES.find((candidate) => fsExists(candidate));
  if (!edge) throw new Error('no Edge/Chrome binary found for headless capture: ' + EDGE_CANDIDATES.join(', '));

  const framesDir = path.join(outDir, 'frames');
  // The browser profile is throwaway state; keeping it out of the repo stops Edge from dropping
  // files that `eslint .` would then walk over.
  // 浏览器 profile 属临时状态，放仓库外可避免 Edge 落下的文件被 `eslint .` 扫到。
  // A fresh profile per run avoids EBUSY on a directory a previous still-exiting Edge holds.
  // 每次运行用全新 profile，避开上一份 Edge 尚未退出时的 EBUSY。
  const profileDir = path.join(os.tmpdir(), `myndbbs-posteditor-harness-profile-${Date.now()}`);
  await fs.mkdir(framesDir, { recursive: true });
  // Wipe the frame dir and the pre-CDP leftovers so a re-run cannot be confused with stale proof.
  // 清空帧目录与 CDP 改版前的遗留产物，避免复验时把旧证据当成新证据。
  await fs.rm(path.join(outDir, 'edge-profile'), { recursive: true, force: true });
  for (const entry of await fs.readdir(framesDir)) {
    await fs.rm(path.join(framesDir, entry), { recursive: true, force: true });
  }
  const pageUrl = `file:///${path.join(outDir, 'harness.html').split(path.sep).join('/')}`;

  const child = spawn(
    edge,
    [
      '--headless=new',
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${profileDir}`,
      '--disable-gpu',
      '--no-proxy-server',
      '--no-first-run',
      '--no-default-browser-check',
      '--allow-file-access-from-files',
      'about:blank',
    ],
    { detached: true, stdio: 'ignore' },
  );
  child.unref();

  let cdp;
  try {
    cdp = await openCdpSession(CDP_PORT);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    const results = [];
    for (const frame of FRAME_MATRIX) {
      results.push(await captureOne(cdp, frame, pageUrl, framesDir));
    }
    await cdp.send('Browser.close').catch(() => {});
    // One table per run: requested viewport, live metrics and the PNG actually written to disk.
    // 每次运行输出一张表：目标视口、实时读数、以及真正落盘的 PNG 尺寸。
    console.log('\nframe                     expect  inner  client  png');
    for (const result of results) {
      console.log(
        `${result.name.padEnd(25)} ${String(result.expected).padStart(6)}  ` +
          `${String(result.metrics ? result.metrics.innerWidth : '-').padStart(5)}  ` +
          `${String(result.metrics ? result.metrics.clientWidth : '-').padStart(6)}  ` +
          `${result.pngSize ? `${result.pngSize.width}x${result.pngSize.height}` : '-'}  ` +
          `${result.failed ? 'FAIL' : 'OK'}`,
      );
    }
    const failed = results.filter((result) => result.failed);
    if (failed.length) {
      console.error(`${failed.length}/${results.length} frames failed the viewport/PNG cross check`);
      process.exitCode = 1;
    }
  } finally {
    cdp?.close();
    try {
      child.kill();
    } catch {
      /* Browser.close already took it down. / 已由 Browser.close 关闭 */
    }
    await fs.rm(profileDir, { recursive: true, force: true }).catch(() => {
      /* A locked profile is throwaway; leave it for the OS temp cleaner. / 锁住的 profile 是临时的，交给系统清理 */
    });
  }
  console.log(`frames written to ${framesDir}`);
}

/**
 * Callers: [captureFrames]
 * Callees: [cdp.send, cdp.evaluate, summariseProbe]
 * Description: Runs one frame: set the viewport, navigate, wait for load plus the harness ready
 *   flag, then read the probe and capture the viewport screenshot.
 * 描述：跑单帧：设视口→导航→等 load 与 harness ready 标记→读探针并截视口图。
 * Variables: `frame.viewport` defaults to 1280x900; `frame.query` carries mode/action/bytes.
 * 变量：`frame.viewport` 默认 1280x900；`frame.query` 传 mode/action/bytes。
 * Integration: Ready-flag polling replaces the old `--virtual-time-budget` guesswork.
 * 接入方式：以 ready 标记轮询取代原先 `--virtual-time-budget` 的猜测式等待。
 * Error Handling: Aborts with the frame name when the page never reports ready.
 * 错误处理：页面始终不 ready 时带帧名中止。
 * Keywords: frame capture, ready flag, probe, 单帧取证
 */
const VIEWPORT_METRICS_EXPR = `JSON.stringify({
  innerWidth: window.innerWidth,
  clientWidth: document.documentElement.clientWidth,
  barWidth: (function () {
    const bar = document.querySelector('#stage [role="alert"], #stage [role="status"]');
    return bar ? Math.round(bar.getBoundingClientRect().width) : null;
  })(),
})`;

async function captureOne(cdp, frame, pageUrl, framesDir) {
  const search = new URLSearchParams({ locale: 'zh', theme: 'light', width: '960' });
  new URLSearchParams(frame.query || '').forEach((value, key) => search.set(key, value));
  // A per-frame run id makes the settle check race-free: the previous document also exposes a
  // ready harness, so "ready" alone could be answered by the page we are leaving.
  // 每帧带 run id，等待条件才不会串台：上一份文档同样有 ready 的 harness，只看 ready 会被旧页回答。
  search.set('runId', frame.name);
  const viewport = frame.viewport || { width: 1280, height: 900 };
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.send('Page.navigate', { url: `${pageUrl}?${search.toString()}` });
  await waitFor(
    () =>
      cdp.evaluate(
        `!!(window.harness && window.harness.ready && window.harness.runId === ${JSON.stringify(frame.name)})`,
      ),
    15000,
    `${frame.name}:ready`,
  );

  // QA defect (2026-09-16): reading the probe right after the ready flag captured geometry that
  // lagged one frame behind the override, so a 1280-wide screenshot could carry 320px numbers.
  // Re-assert the override after load, then require the live metrics to converge on the target
  // and stay identical across two samples before touching either the probe or the screenshot.
  // QA 缺陷（2026-09-16）：ready 一到就读探针，几何会滞后一帧——1280 宽的截图能带上 320 的读数。
  // 故加载后再下一次同样的 override，并要求实时视口先收敛到目标值、且连续两次采样完全一致，
  // 之后才允许读探针与截图。
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const settled = await settleViewport(cdp, viewport, frame.name);
  if (!settled.ok) {
    const line = `${frame.name} FAIL viewport never settled: expected ${viewport.width}, saw inner=${settled.last.innerWidth} client=${settled.last.clientWidth} bar=${settled.last.barWidth}`;
    console.log(line);
    return { name: frame.name, expected: viewport.width, failed: line };
  }

  const probe = JSON.parse(await cdp.evaluate('JSON.stringify(window.harness.state())'));
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const png = Buffer.from(shot.data, 'base64');
  const pngSize = readPngSize(png);
  // The screenshot and the probe must describe one settled state: same metrics afterwards, and a
  // PNG whose width equals the requested viewport.
  // 截图与探针必须出自同一次 settle 后的状态：取图后再读一次视口须完全一致，且 PNG 宽度等于目标视口宽。
  const after = JSON.parse(await cdp.evaluate(VIEWPORT_METRICS_EXPR));
  const drift = JSON.stringify(after) !== JSON.stringify(settled.metrics);
  const reasons = [];
  if (drift) reasons.push(`metrics drifted during capture ${JSON.stringify(settled.metrics)} -> ${JSON.stringify(after)}`);
  if (!pngSize || pngSize.width !== viewport.width) {
    reasons.push(`png width ${pngSize ? pngSize.width : 'unknown'} != viewport width ${viewport.width}`);
  }
  if (probe.clientWidth !== settled.metrics.clientWidth) {
    reasons.push(`probe clientWidth ${probe.clientWidth} != live ${settled.metrics.clientWidth}`);
  }

  const record = {
    ...probe,
    capture: {
      expectedViewportWidth: viewport.width,
      expectedViewportHeight: viewport.height,
      liveMetrics: settled.metrics,
      postCaptureMetrics: after,
      pngWidth: pngSize ? pngSize.width : null,
      pngHeight: pngSize ? pngSize.height : null,
      settled: reasons.length === 0,
    },
  };
  await fs.writeFile(path.join(framesDir, `${frame.name}.probe.json`), JSON.stringify(record, null, 2), 'utf-8');
  await fs.writeFile(path.join(framesDir, `${frame.name}.png`), png);

  const line =
    `${frame.name} expect=${viewport.width} inner=${settled.metrics.innerWidth} ` +
    `client=${settled.metrics.clientWidth} png=${pngSize ? `${pngSize.width}x${pngSize.height}` : '?'}`;
  if (reasons.length) {
    console.log(`${line} FAIL ${reasons.join('; ')}`);
    return { name: frame.name, expected: viewport.width, metrics: settled.metrics, pngSize, failed: reasons.join('; ') };
  }
  console.log(`${line} OK ${summariseProbe(JSON.stringify(probe))}`);
  return { name: frame.name, expected: viewport.width, metrics: settled.metrics, pngSize, failed: null };
}

/**
 * Callers: [captureOne]
 * Callees: [cdp.evaluate, delay]
 * Description: Polls live viewport metrics until they match the requested viewport and stop
 *   changing, so geometry read out of the page belongs to the frame being captured.
 * 描述：轮询实时视口，直到其等于目标视口且不再变化，保证读到的几何确实属于当前这一帧。
 * Variables: `timeoutMs` is the settle budget; two identical samples 120ms apart count as settled.
 * 变量：`timeoutMs` 为收敛预算；间隔 120ms 的两次完全一致才算收敛。
 * Integration: A non-settling frame is reported, never silently emitted as a bad screenshot.
 * 接入方式：不收敛的帧会被显式报失败，绝不静默出一帧错图。
 * Error Handling: Returns `{ ok:false, last }` on timeout instead of throwing, so one bad frame
 *   cannot destroy the other sixteen artifacts.
 * 错误处理：超时返回 `{ok:false,last}` 而非抛错，单帧失败不拖垮其余十六帧产物。
 * Keywords: viewport settle, layout race, geometry evidence, 视口收敛
 */
async function settleViewport(cdp, viewport, label, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  let previous = null;
  let last = { innerWidth: null, clientWidth: null, barWidth: null };
  for (;;) {
    last = JSON.parse(await cdp.evaluate(VIEWPORT_METRICS_EXPR));
    const matches =
      last.innerWidth === viewport.width &&
      last.clientWidth <= viewport.width &&
      viewport.width - last.clientWidth <= 24 &&
      (last.barWidth === null || last.barWidth <= last.clientWidth);
    if (matches && previous && JSON.stringify(previous) === JSON.stringify(last)) {
      return { ok: true, metrics: last };
    }
    if (Date.now() > deadline) return { ok: false, last };
    previous = last;
    await delay(120);
  }
}

/**
 * Callers: [captureOne]
 * Callees: []
 * Description: Reads the PNG IHDR so the reported screenshot size comes from the bytes on disk
 *   rather than from what the driver asked for.
 * 描述：直接读 PNG 的 IHDR，让上报的截图尺寸来自落盘字节，而不是驱动"以为自己设了"的值。
 * Variables: `buffer` is the PNG body returned by `Page.captureScreenshot`.
 * 变量：`buffer` 为 `Page.captureScreenshot` 返回的 PNG 字节。
 * Integration: Used for the per-frame PNG-vs-viewport cross check.
 * 接入方式：用于每帧「PNG 宽 vs 目标视口」的交叉校验。
 * Error Handling: Returns null for anything that is not a PNG with an IHDR chunk.
 * 错误处理：非 PNG 或缺 IHDR 时返回 null。
 * Keywords: png header, screenshot size, 截图尺寸自证
 */
function readPngSize(buffer) {
  if (!buffer || buffer.length < 24) return null;
  if (buffer.readUInt32BE(0) !== 0x89504e47 >>> 0 || buffer.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

/**
 * Callers: [captureFrames]
 * Callees: [fetch, WebSocket]
 * Description: Waits for the DevTools endpoint, attaches to the first page target and returns a
 *   minimal CDP client (send / evaluate / waitFor / close).
 * 描述：等 DevTools 端口就绪，挂到第一个 page target，返回极简 CDP 客户端（send / evaluate / waitFor / close）。
 * Variables: `port` is the `--remote-debugging-port` value.
 * 变量：`port` 即 `--remote-debugging-port` 的取值。
 * Integration: Uses Node's global fetch and WebSocket, so no new dependency is added.
 * 接入方式：只用 Node 内置 fetch 与 WebSocket，不新增依赖。
 * Error Handling: Throws when the endpoint or a page target never appears.
 * 错误处理：端口或 page target 始终不出现即抛错。
 * Keywords: CDP client, websocket, devtools, 取证通道
 */
async function openCdpSession(port) {
  const base = `http://127.0.0.1:${port}`;
  let targets = [];
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      targets = await (await fetch(`${base}/json`)).json();
      if (Array.isArray(targets) && targets.some((target) => target.type === 'page')) break;
    } catch {
      /* endpoint still warming up / 端口尚未就绪 */
    }
    await delay(250);
  }
  const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
  if (!page) throw new Error('no CDP page target on port ' + port);

  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  const events = [];
  const pending = new Map();
  let seq = 0;
  socket.addEventListener('message', (message) => {
    const payload = JSON.parse(message.data);
    if (payload.id && pending.has(payload.id)) {
      const { resolve, reject } = pending.get(payload.id);
      pending.delete(payload.id);
      if (payload.error) reject(new Error(`${payload.error.message} (${payload.error.code})`));
      else resolve(payload.result);
    } else if (payload.method) {
      events.push(payload);
    }
  });

  const client = {
    send(method, params = {}) {
      seq += 1;
      const id = seq;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
    async evaluate(expression) {
      const result = await client.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) {
        throw new Error('evaluate threw in page: ' + (result.exceptionDetails.text || expression));
      }
      return result.result?.value;
    },
    events,
    close() {
      try {
        socket.close();
      } catch {
        /* already closed / 已关闭 */
      }
    },
  };
  return client;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await predicate()) return;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await delay(120);
  }
}

/**
 * Callers: [captureOne]
 * Callees: [JSON.parse]
 * Description: Reduces a probe to one console line while keeping the decisive fields.
 * 描述：把探针压成一行控制台输出，同时保留关键字段。
 * Variables: `probeRaw` is the JSON string returned by `window.harness.state()`.
 * 变量：`probeRaw` 为 `window.harness.state()` 返回的 JSON 字符串。
 * Integration: Console only; the full JSON stays in `<frame>.probe.json`.
 * 接入方式：仅用于控制台，完整 JSON 保留在 `<frame>.probe.json`。
 * Error Handling: Unparseable input returns a short marker instead of throwing.
 * 错误处理：解析失败返回短标记，不抛错。
 * Keywords: probe summary, console, 证据摘要
 */
function summariseProbe(probeRaw) {
  let probe;
  try {
    probe = JSON.parse(probeRaw);
  } catch {
    return probeRaw ? 'unparseable probe' : 'no probe';
  }
  return JSON.stringify({
    notice: probe.notice,
    text: probe.noticeText,
    fetches: probe.fetchCalls,
    alert: probe.alertCount,
    status: probe.statusCount,
    picks: (probe.picks || []).map((pick) => `${pick.bytes}B/${pick.type}:${pick.valueAfterDispatch === '' ? 'cleared' : 'kept'}`),
    disabled: probe.buttonDisabled,
    title: probe.buttonTitle,
    inputValue: probe.inputValue,
    barStyle: probe.barStyle,
    contrast: probe.contrast ? `${probe.contrast.ratio}:1 AA=${probe.contrast.aaNormalPass}` : null,
    viewport: probe.viewport ? `${probe.viewport.innerWidth}px` : null,
    overflow: probe.horizontalOverflow,
    content: probe.content,
  });
}

function fsExists(target) {
  try {
    fsSync.accessSync(target);
    return true;
  } catch {
    return false;
  }
}

/**
 * Callers: [buildHarness]
 * Callees: []
 * Description: Neutralises `</script` sequences inside inlined JSON so the HTML stays parseable.
 * 描述：转义内联 JSON 里的 `</script`，保证 HTML 不被提前截断。
 * Variables: `text` is the JSON payload.
 * 变量：`text` 为待内联的 JSON 文本。
 * Integration: Only used when writing the harness artifacts.
 * 接入方式：仅在生成自检台产物时使用。
 * Error Handling: None; it is a pure string rewrite.
 * 错误处理：无，纯字符串改写。
 * Keywords: inline script, escaping, 内联转义
 */
function safeInline(text) {
  return text.replace(/<\/script/gi, '<\\/script');
}

buildHarness().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
