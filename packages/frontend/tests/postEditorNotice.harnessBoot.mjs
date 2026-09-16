/**
 * Callers: [postEditorNotice.renderHarness.mjs, the browser via <script src="./boot.js">]
 * Callees: [react, react-dom/client, harness:posteditor]
 * Description: Browser bootstrap for the PostEditor image-notice harness. It mounts the real
 *   component, replaces the upload fetch with a record-and-respond stub, and exposes
 *   `globalThis.harness` so a driver (or a human in DevTools) can pick files and read live DOM
 *   state for the four notice states.
 * 描述：自检台的浏览器引导脚本。挂载**真实**组件，把上传 fetch 换成「记录并应答」的桩，并把
 *   `globalThis.harness` 暴露出来，让驱动脚本（或人工 DevTools）能真实选文件、读四态 DOM。
 * Variables: query params `locale` (zh|en), `theme` (light|dark), `width` (stage px).
 * 变量：query 参数 `locale`（zh|en）、`theme`（light|dark）、`width`（舞台宽度 px）。
 * Integration: Inlined verbatim by the builder; must stay free of ESM syntax and Node globals.
 * 接入方式：由构建脚本原样内联，禁止使用 ESM 语法与 Node 全局。
 * Error Handling: Unknown module ids throw at require time; a missing #stage aborts with a text node.
 * 错误处理：未知模块 id 在 require 时抛错；缺少 #stage 时以文本节点报错。
 * Keywords: render harness, boot, notice states, 自检台, 四态取证
 */
(function harnessBoot() {
  const g = globalThis;
  const doc = g.document;
  const sources = g.__HARNESS_SOURCES__ || {};
  const dicts = g.__HARNESS_DICTS__ || { zh: {}, en: {} };
  const cache = {};

  function harnessRequire(id) {
    if (cache[id]) return cache[id].exports;
    const src = sources[id];
    if (typeof src !== 'string') throw new Error('harness: unknown module ' + id);
    const mod = { exports: {} };
    cache[id] = mod;
    const proc = { env: { NODE_ENV: 'production' } };
    new Function('module', 'exports', 'require', 'process', src)(mod, mod.exports, harnessRequire, proc);
    return mod.exports;
  }

  const React = harnessRequire('react');
  const client = harnessRequire('react-dom/client');
  const editorModule = harnessRequire('harness:posteditor');
  const shared = harnessRequire('harness:shared');

  const params = new g.URLSearchParams(g.location.search);
  const locale = params.get('locale') === 'en' ? 'en' : 'zh';
  const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
  const stageWidth = Number(params.get('width') || 0) || 960;

  const harness = {
    locale,
    theme,
    runId: params.get('runId') || '',
    maxBytes: shared.POST_ATTACHMENT_MAX_BYTES,
    fetchLog: [],
    mode: 'ok',
    content: '',
    pending: null,
    picks: [],
    ready: false,
  };
  g.harness = harness;

  const HTML_413 =
    '<html><head><title>413 Request Entity Too Large</title></head><body bgcolor="white:center">' +
    '<center><h1>413 Request Entity Too Large</h1></center><hr><center>openresty</center></body></html>';

  g.fetch = function harnessFetch() {
    if (harness.mode === 'hang') {
      return new Promise((resolve) => {
        harness.pending = resolve;
      });
    }
    if (harness.mode === 'networkError') {
      return Promise.reject(new TypeError('Failed to fetch'));
    }
    if (harness.mode === 'json413') {
      return Promise.resolve(
        new g.Response(JSON.stringify({ error: 'LIMIT_FILE_SIZE' }), {
          status: 413,
          headers: { 'content-type': 'application/json' },
        }),
      );
    }
    if (harness.mode === 'html413') {
      return Promise.resolve(new g.Response(HTML_413, { status: 413, headers: { 'content-type': 'text/html' } }));
    }
    if (harness.mode === 'err500') {
      return Promise.resolve(
        new g.Response(JSON.stringify({ error: 'ERR_INTERNAL_SERVER_ERROR' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        }),
      );
    }
    return Promise.resolve(
      new g.Response(JSON.stringify({ url: '/uploads/posts/harness-user/harness-shot.png' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    );
  };

  function Shell() {
    const [content, setContent] = React.useState('');
    const [title, setTitle] = React.useState('附件上限自检');
    const [categoryId, setCategoryId] = React.useState('');
    React.useEffect(() => {
      harness.content = content;
    }, [content]);
    const categories = [{ id: 'c1', name: 'tech', description: '' }];
    return React.createElement(editorModule.PostEditor, {
      dict: dicts[locale],
      title,
      setTitle,
      content,
      setContent,
      categoryId,
      setCategoryId,
      categories,
    });
  }

  const stage = doc.getElementById('stage');
  if (!stage) {
    if (doc.body) doc.body.textContent = 'harness: #stage missing';
    return;
  }
  stage.style.maxWidth = stageWidth + 'px';
  stage.style.margin = '0 auto';
  doc.documentElement.className = theme === 'dark' ? 'dark' : '';
  doc.documentElement.lang = locale;
  client.createRoot(stage).render(React.createElement(Shell));

  function imageButton() {
    const buttons = Array.prototype.slice.call(doc.querySelectorAll('button'));
    return buttons.find(function byImageLabel(b) {
      const label = b.getAttribute('aria-label') || '';
      return /image|图片/i.test(label);
    });
  }

  harness.pickFile = function pickFile(bytes, options) {
    const opts = options || {};
    const input = doc.querySelector('input[type=file]');
    if (!input) return { error: 'no file input' };
    const file = new g.File([new g.Uint8Array(bytes)], opts.name || 'screenshot-proof.png', {
      type: opts.type || 'image/png',
    });
    const transfer = new g.DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    const valueBefore = input.value;
    input.dispatchEvent(new g.Event('change', { bubbles: true }));
    const pick = { bytes: file.size, valueBefore, valueAfterDispatch: input.value, mode: harness.mode };
    pick.type = file.type;
    harness.picks.push(pick);
    return pick;
  };

  // Escape hatch for drivers: fires the component's own onChange props handler directly,
  // bypassing React's root listener. Kept separate so a normal pick is never double-fired.
  // 驱动备用入口：直接调组件的 onChange props，绕过 React 根监听。独立方法，避免重复触发。
  harness.pickFileViaProps = function pickFileViaProps(bytes, options) {
    const opts = options || {};
    const input = doc.querySelector('input[type=file]');
    const propsKey = Object.keys(input).find(function byProps(k) {
      return k.indexOf('__reactProps$') === 0;
    });
    if (!propsKey) return { error: 'no react props handle' };
    const file = new g.File([new g.Uint8Array(bytes)], opts.name || 'screenshot-proof.png', {
      type: opts.type || 'image/png',
    });
    const transfer = new g.DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input[propsKey].onChange({
      target: input,
      currentTarget: input,
      preventDefault() {},
      stopPropagation() {},
    });
    return { bytes: file.size, valueAfter: input.value };
  };

  harness.release = function release() {
    const resolve = harness.pending;
    harness.pending = null;
    if (resolve) resolve();
  };

  harness.state = function state() {
    const alertBar = doc.querySelector('[role="alert"]');
    const statusBar = doc.querySelector('[role="status"]');
    const bar = alertBar || statusBar;
    const button = imageButton();
    const input = doc.querySelector('input[type=file]');
    const rect = bar ? bar.getBoundingClientRect() : null;
    const styles = bar ? g.getComputedStyle(bar) : null;
    const contrast = bar ? measureContrast(bar, styles) : null;
    return {
      notice: alertBar ? 'alert' : statusBar ? 'status' : 'none',
      noticeText: bar ? bar.textContent.trim() : null,
      barRect: rect
        ? { top: Math.round(rect.top), left: Math.round(rect.left), width: Math.round(rect.width), height: Math.round(rect.height) }
        : null,
      barStyle: styles ? styles.backgroundColor + ' | ' + styles.color : null,
      contrast,
      viewport: { innerWidth: g.innerWidth, innerHeight: g.innerHeight, dpr: g.devicePixelRatio },
      buttonDisabled: button ? button.disabled : null,
      buttonTitle: button ? button.getAttribute('title') : null,
      buttonAriaLabel: button ? button.getAttribute('aria-label') : null,
      inputValue: input ? input.value : null,
      fetchCalls: harness.fetchLog.map(function mapCall(call) {
        return call.method + ' ' + call.url;
      }),
      picks: harness.picks.slice(),
      content: harness.content,
      alertCount: doc.querySelectorAll('#stage [role="alert"]').length,
      statusCount: doc.querySelectorAll('#stage [role="status"]').length,
      horizontalOverflow: doc.documentElement.scrollWidth > doc.documentElement.clientWidth,
      scrollWidth: doc.documentElement.scrollWidth,
      clientWidth: doc.documentElement.clientWidth,
      toolbarBottom: (function toolbarBottom() {
        const toolbar = doc.querySelector('#stage .bg-background\\/50');
        if (!toolbar) return null;
        const r = toolbar.getBoundingClientRect();
        return { bottom: Math.round(r.bottom), height: Math.round(r.height) };
      })(),
      barTop: rect ? Math.round(rect.top) : null,
    };
  };

  /**
   * Callers: [harness.state]
   * Callees: [parseColor, relativeLuminance]
   * Description: Computes the WCAG 2.1 contrast ratio of the notice text against its composited
   *   background, because the bars sit on alpha layers (`bg-background/50`, `bg-red-900/20`) that
   *   only resolve after compositing over the card (DESIGN §2.4 / §7.4-4).
   * 描述：计算提示条文字与「合成后」背景的 WCAG 2.1 对比度。条底色是半透明层（`bg-background/50`、
   *   `bg-red-900/20`），必须叠在卡片实色上才是用户真正看到的颜色（DESIGN §2.4 / §7.4-4）。
   * Variables: `node` is the bar element; `styles` its computed style.
   * 变量：`node` 为提示条元素，`styles` 为其计算样式。
   * Integration: Evidence only; it never changes rendering.
   * 接入方式：仅取证，不改变任何渲染。
   * Error Handling: Returns null when either colour cannot be parsed.
   * 错误处理：任一颜色无法解析时返回 null。
   * Keywords: contrast, WCAG, accessibility, 对比度复算
   */
  function measureContrast(node, styles) {
    const fg = parseColor(styles.color);
    // Collect the stack first, then composite bottom-up: walking top-down and blending as you go
    // would drop the translucent layer that sits on top.
    // 先收集层叠再自下而上合成：自上而下一边走一边混色会把最上的半透明层丢掉。
    const layers = [];
    for (let current = node; current; current = current.parentElement) {
      const layer = parseColor(g.getComputedStyle(current).backgroundColor);
      if (!layer || layer.a === 0) continue;
      layers.push(layer);
      if (layer.a >= 1) break;
    }
    if (!fg || !layers.length) return null;
    let bg = layers[layers.length - 1];
    if (bg.a < 1) bg = blend({ r: 255, g: 255, b: 255, a: 1 }, bg);
    for (let index = layers.length - 2; index >= 0; index -= 1) {
      bg = blend(bg, layers[index]);
    }
    const first = relativeLuminance(fg);
    const second = relativeLuminance(bg);
    const lighter = Math.max(first, second);
    const darker = Math.min(first, second);
    return {
      ratio: Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2)),
      foreground: styles.color,
      background: `rgb(${Math.round(bg.r)} ${Math.round(bg.g)} ${Math.round(bg.b)})`,
      aaNormalPass: (lighter + 0.05) / (darker + 0.05) >= 4.5,
    };
  }

  function blend(under, over) {
    return {
      r: over.r * over.a + under.r * (1 - over.a),
      g: over.g * over.a + under.g * (1 - over.a),
      b: over.b * over.a + under.b * (1 - over.a),
      a: 1,
    };
  }

  function parseColor(value) {
    const match = /(rgba?|oklch|oklab)\(([^)]+)\)/.exec(value || '');
    if (!match) return null;
    const [fn, inner] = [match[1], match[2]];
    const alphaSplit = inner.split('/');
    const numbers = alphaSplit[0]
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((token) => (token.endsWith('%') ? Number(token.slice(0, -1)) / 100 : Number(token)));
    if (numbers.length < 3 || numbers.slice(0, 3).some(Number.isNaN)) return null;
    const alpha = alphaSplit[1] === undefined ? 1 : parseAlpha(alphaSplit[1]);
    if (fn === 'rgb') {
      return { r: numbers[0], g: numbers[1], b: numbers[2], a: alpha };
    }
    const rgb = fn === 'oklch' ? oklchToRgb(numbers) : oklabToRgb([numbers[0], numbers[1], numbers[2]]);
    return { r: rgb[0], g: rgb[1], b: rgb[2], a: alpha };
  }

  function parseAlpha(token) {
    const trimmed = (token || '').trim();
    if (trimmed.endsWith('%')) return Number(trimmed.slice(0, -1)) / 100;
    const value = Number(trimmed);
    return Number.isNaN(value) ? 1 : Math.min(1, Math.max(0, value));
  }

  /**
   * Callers: [parseColor]
   * Callees: [oklabToRgb]
   * Description: Converts `oklch(L C H)` to sRGB 0-255 via its oklab form, because Tailwind v4
   *   tokens compute to oklch and a contrast claim that ignores that would be wrong.
   * 描述：把 `oklch(L C H)` 经 oklab 转成 0-255 sRGB。Tailwind v4 的 token 计算值就是 oklch，
   *   忽略这点会让对比度结论失真。
   * Variables: `[l, c, h]` are lightness, chroma and hue in degrees.
   * 变量：`[l, c, h]` 为明度、彩度与色相（度）。
   * Integration: Evidence math only, used by `measureContrast`.
   * 接入方式：仅取证计算，供 `measureContrast` 使用。
   * Error Handling: Out-of-gamut channels clamp to 0-255.
   * 错误处理：越界通道钳到 0-255。
   * Keywords: oklch, srgb, color space, 色彩空间
   */
  function oklchToRgb([l, c, h]) {
    const radians = (h * Math.PI) / 180;
    return oklabToRgb([l, c * Math.cos(radians), c * Math.sin(radians)]);
  }

  /**
   * Callers: [oklchToRgb, parseColor]
   * Callees: []
   * Description: Ottosson oklab to linear sRGB to gamma-encoded sRGB, the same transform the
   *   browser applies before compositing, so the ratio matches what a pixel sampler would read.
   * 描述：按 Ottosson 的 oklab→线性 sRGB→伽马 sRGB 转换，与浏览器合成前的变换一致，
   *   因此比值等同于取像素读到的结果。
   * Variables: `[l, a, b]` are the oklab channels.
   * 变量：`[l, a, b]` 为 oklab 三通道。
   * Integration: Evidence math only.
   * 接入方式：仅取证计算。
   * Error Handling: Clamps each channel; never throws on out-of-gamut input.
   * 错误处理：逐通道钳位，越界不抛错。
   * Keywords: oklab, wcag, contrast input, 对比度换算
   */
  function oklabToRgb([l, a, b]) {
    const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = l - 0.1055613458 * a - 0.063854136 * b;
    const s_ = l - 0.0894841775 * a - 1.291485548 * b;
    const lin = [l_ ** 3, m_ ** 3, s_ ** 3];
    const matrix = [
      [4.0767416624, -3.3077115913, 0.2309699292],
      [-1.2684380046, 2.6097574011, -0.3413193965],
      [-0.0041960863, -0.7034186147, 1.707614701],
    ];
    return matrix.map((row) => {
      const value = row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2];
      const encoded = value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;
      return Math.min(255, Math.max(0, Math.round(encoded * 255)));
    });
  }

  function relativeLuminance(color) {
    const channel = (value) => {
      const c = value / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
  }

  /**
   * Callers: [boot timers, driver scripts]
   * Callees: [harness.state]
   * Description: Writes the live DOM probe as JSON into `#probe` so a headless screenshot run can
   *   dump the same evidence it rendered, and keeps the on-screen log in sync.
   * 描述：把实时 DOM 状态以 JSON 写入 `#probe`，让 headless 截图运行能同时 dump 出同一份证据。
   * Variables: none; reads `globalThis.harness`.
   * 变量：无，仅读取 `globalThis.harness`。
   * Integration: Invoked after each auto action and on a 120ms interval while the page lives.
   * 接入方式：自动动作之后与页面存活期间每 120ms 调用一次。
   * Error Handling: Silently skips when the probe node is absent.
   * 错误处理：找不到探针节点时静默跳过。
   * Keywords: probe, evidence, dump, 取证探针
   */
  function writeProbe() {
    const probe = doc.getElementById('probe');
    if (!probe) return;
    const s = harness.state();
    probe.textContent = 'HARNESS_PROBE ' + JSON.stringify(s, null, 2);
  }

  function runAutoAction() {
    const action = params.get('action');
    if (!action) {
      writeProbe();
      return;
    }
    if (params.get('mode')) harness.mode = params.get('mode');
    const bytes = Number(params.get('bytes') || 0) || harness.maxBytes + 1;
    const type = params.get('type') || 'image/png';
    if (action === 'pick') {
      harness.pickFile(bytes, { type });
    } else if (action === 'pickTwice') {
      harness.pickFile(bytes, { type });
      harness.pickFile(bytes, { type });
    } else if (action === 'boundary') {
      harness.pickFile(harness.maxBytes - 1, { type });
      harness.pickFile(harness.maxBytes, { type });
    } else if (action === 'oversizeThenOk') {
      harness.pickFile(harness.maxBytes + 1, { type });
      harness.pickFile(harness.maxBytes, { type });
    } else {
      harness.pickFile(bytes, { type });
    }
    writeProbe();
    g.setTimeout(writeProbe, 60);
  }

  /**
   * Callers: [runAutoAction, boot when no action is requested]
   * Callees: [writeProbe]
   * Description: Writes the probe once more and raises `harness.ready`, the single signal the CDP
   *   driver waits for before it reads state and screenshots.
   * 描述：再写一次探针并置起 `harness.ready`，这是 CDP 驱动读状态与截图前唯一等待的信号。
   * Variables: none.
   * 变量：无。
   * Integration: Replaces the old `--virtual-time-budget` guesswork (DESIGN §7.2 D4).
   * 接入方式：取代原先 `--virtual-time-budget` 的猜测式等待（DESIGN §7.2 D4）。
   * Error Handling: Idempotent; a second call only refreshes the probe.
   * 错误处理：幂等，重复调用只刷新探针。
   * Keywords: ready flag, settle signal, 就绪标记
   */
  function markReady() {
    writeProbe();
    harness.ready = true;
  }

  g.setInterval(writeProbe, 120);
  g.setTimeout(function bootAction() {
    runAutoAction();
    g.setTimeout(markReady, 120);
  }, 30);
})();
