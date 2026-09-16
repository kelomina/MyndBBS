/**
 * 测试模块：帖子正文插图上传上限（10 MiB 含边界）与既有 500 缺陷回归
 *
 * 函数作用：
 *   验证 FREEZE R2（10485759/10485760 通过、10485761 拒）、
 *   R4（413 响应体恰为 {"error":"LIMIT_FILE_SIZE"} 且不带 message）、
 *   R8/M1（大写扩展名可用且落盘为小写）、R8/M2（bmp/tif 由 500 变 400）。
 * 分层策略（主持人裁决 R10）：
 *   精确字节矩阵在**中间件层**执行——从生产 router 的 layer 栈里取出真实构造的构件
 *   （含 limits 与 fileFilter 的 multer 实例、validateMagicBytes、帖子处理器），
 *   以内存 Readable 充当请求流直调，因此：
 *     1) 不需要清桶钩子，也不改 uploadLimiter（R10 红线）；
 *     2) 不依赖数据库与 Redis（只替换 registry 接线，storagePort 仍是真实适配器）；
 *     3) 不受本机 loopback 大报文停滞影响（见末尾环境注记）。
 *   错误->状态码映射复用生产纯函数 getErrorCodeFromUnknown / getStatusCodeForErrorCode，
 *   响应体复用生产 i18nErrorTranslationMiddleware 包装，故 413/400 形状与线上一致。
 *
 * 环境注记（2026-09-16 本机实测）：
 *   经 127.0.0.1 的 HTTP 请求体超过约 1.4 MB 后写入停滞（fetch 与 http.request 表现一致，低 CPU、非忙等），
 *   而同一份 10 MiB 报文在进程内交予 busboy 解析仅需约 6 ms。故边界用例刻意不走 socket，
 *   HTTP 层用例请 QA 在可用链路上执行；该停滞属宿主环境问题，不属本期产品缺陷。
 *
 * 中文关键词：
 *   上传，帖子插图，10MB，边界，413，LIMIT_FILE_SIZE，multer，fileFilter，中间件层
 */
import { Readable } from 'node:stream';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { POST_ATTACHMENT_MAX_BYTES } from '@myndbbs/shared';
import { getErrorCodeFromUnknown, getStatusCodeForErrorCode } from '../src/lib/httpErrors';
import { i18nErrorTranslationMiddleware } from '../src/middleware/i18nErrorTranslation';

// registry 是组合根（Prisma/Redis 接线）。这里只替换接线本身：storagePort 用真实
// LocalFileStorageAdapter（上传根目录经 UPLOAD_DIR 指向临时目录），
// 以免把「适配器的扩展名白名单语义」测成 mock 的自我实现。
jest.mock('../src/registry', () => {
  const adapterModule = require('../src/infrastructure/services/system/LocalFileStorageAdapter');
  return {
    storagePort: new adapterModule.LocalFileStorageAdapter(),
    systemApplicationService: { uploadAttachment: jest.fn() },
  };
});

// 鉴权与限流替身：生产链顺序由真实 router 提供，本用例只旁路这两环
// （R10：禁改 uploadLimiter、禁为测试新增清桶钩子）。
jest.mock('../src/lib/rateLimit', () => ({
  uploadLimiter: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../src/middleware/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { userId: '6f1d3c2e-8a5b-4a1f-9c2d-7e0b1a2c3d4e' };
    next();
  },
  requireAuthHidden: (_req: any, _res: any, next: any) => next(),
}));

import uploadRoutes from '../src/routes/upload';

const POST_IMAGE_PATH = '/post-image';
const MOCK_USER_ID = '6f1d3c2e-8a5b-4a1f-9c2d-7e0b1a2c3d4e';
const BOUNDARY = '----MyndBBSPostImageLimitBoundary0123456789';
const CHUNK_BYTES = 65536;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const BMP_MAGIC = Buffer.from([0x42, 0x4d]);
const TIFF_MAGIC = Buffer.from([0x49, 0x49, 0x2a, 0x00]);

type Handle = ((...args: any[]) => unknown) & { name?: string };
type RouterLayer = { route?: { path: string; stack: Array<{ handle: Handle }> } };
type ChainResult = { status: number; body: Record<string, unknown> | null };

/**
 * 函数作用：按名字从生产 router 的 layer 栈取出帖子插图路由的真实构件。
 * 取不到即抛错，顺带守卫「中间件链顺序与函数名未被悄悄改动」。
 */
function routeHandles(routePath: string): Handle[] {
  const stack = (uploadRoutes as unknown as { stack: RouterLayer[] }).stack;
  const layer = stack.find((candidate) => candidate.route?.path === routePath);
  if (!layer?.route) {
    throw new Error(`route layer not found: ${routePath}`);
  }
  return layer.route.stack.map((entry) => entry.handle);
}

function pickHandle(handles: Handle[], name: string): Handle {
  const found = handles.find((candidate) => candidate.name === name);
  if (!found) {
    throw new Error(`middleware not found in production route: ${name}`);
  }
  return found;
}

/** 前导魔数 + 0x20 填充，使文件字节数精确等于 total（busboy 的 fileSize 只计这部分）。 */
function imageContent(magic: Buffer, total: number): Buffer {
  const buffer = Buffer.alloc(total, 0x20);
  magic.copy(buffer, 0);
  return buffer;
}

/** 手工拼 multipart 请求体，字节布局完全可控（不依赖 FormData/Blob 的实现细节）。 */
function multipartBody(filename: string, mimeType: string, content: Buffer): Buffer {
  const head = Buffer.from(
    `--${BOUNDARY}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${BOUNDARY}--\r\n`);
  return Buffer.concat([head, content, tail]);
}
function chunkedReadable(body: Buffer): Readable {
  const chunks: Buffer[] = [];
  for (let offset = 0; offset < body.length; offset += CHUNK_BYTES) {
    chunks.push(body.subarray(offset, Math.min(offset + CHUNK_BYTES, body.length)));
  }
  return Readable.from(chunks);
}

/** res 替身：只需 status/json，外加「响应已写出」信号（生产有的中间件直接响应而不 next）。 */
function createResponse(): { res: any; result: Promise<ChainResult> } {
  let statusCode = 200;
  let settled = false;
  let resolveResult!: (value: ChainResult) => void;
  const result = new Promise<ChainResult>((resolve) => {
    resolveResult = resolve;
  });
  const respond = (body: unknown) => {
    if (settled) return;
    settled = true;
    resolveResult({ status: statusCode, body: (body ?? null) as Record<string, unknown> | null });
  };
  const res: any = {
    get responded(): boolean {
      return settled;
    },
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(body: unknown) {
      respond(body);
      return res;
    },
    setHeader() {
      return res;
    },
    end(body?: unknown) {
      if (body !== undefined) respond(body);
      return res;
    },
  };
  return { res, result };
}

/**
 * 函数作用：按生产顺序驱动一条中间件链并返回最终响应。
 * 语义对齐 express：next(err) 交给全局错误处理（这里复用生产的两个纯映射函数）；
 * 中间件直接 res.json 而不 next（validateMagicBytes 即如此）视为链终止。
 */
async function runChain(handles: Handle[], req: any): Promise<ChainResult> {
  const { res, result } = createResponse();
  // 生产 index.ts:51 在路由之前全局注册该中间件，故先包装 res.json 再进链。
  i18nErrorTranslationMiddleware(req, res, () => undefined);

  for (const handle of handles) {
    if (res.responded) break;
    try {
      await new Promise<void>((resolve, reject) => {
        let settledStep = false;
        const finishOk = () => {
          if (settledStep) return;
          settledStep = true;
          resolve();
        };
        const finishErr = (err: unknown) => {
          if (settledStep) return;
          settledStep = true;
          reject(err instanceof Error ? err : new Error(String(err)));
        };
        const next = (err?: unknown) => (err ? finishErr(err) : finishOk());
        let returned: unknown;
        try {
          returned = handle(req, res, next);
        } catch (err) {
          return finishErr(err);
        }
        if (returned && typeof (returned as Promise<unknown>).then === 'function') {
          (returned as Promise<unknown>).then(finishOk, finishErr);
        }
        if (res.responded) finishOk();
      });
    } catch (err) {
      const errorCode = getErrorCodeFromUnknown(err);
      res.status(getStatusCodeForErrorCode(errorCode)).json({ error: errorCode });
      break;
    }
  }

  return result;
}

describe('post image upload limit chain (FREEZE R2 inclusive 10 MiB)', () => {
  let uploadRoot: string;
  let chainHandles: Handle[];

  beforeAll(() => {
    const handles = routeHandles(POST_IMAGE_PATH);
    // 只取体积/内容/落盘三段真实构件；requireAuth 与 uploadLimiter 由 mock 旁路（不在本用例断言范围）。
    const terminal = handles[handles.length - 1];
    if (!terminal) {
      throw new Error('post image handler missing from route stack');
    }
    chainHandles = [pickHandle(handles, 'multerMiddleware'), pickHandle(handles, 'validateMagicBytes'), terminal];
  });

  beforeEach(async () => {
    uploadRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'myndbbs-post-image-'));
    process.env.UPLOAD_DIR = uploadRoot;
  });

  afterEach(async () => {
    delete process.env.UPLOAD_DIR;
    await fs.rm(uploadRoot, { recursive: true, force: true });
  });

  async function send(args: {
    filename: string;
    mimeType: string;
    content: Buffer;
  }): Promise<ChainResult & { wireBytes: number }> {
    const wire = multipartBody(args.filename, args.mimeType, args.content);
    const req: any = chunkedReadable(wire);
    req.headers = {
      'content-type': `multipart/form-data; boundary=${BOUNDARY}`,
      'content-length': String(wire.length),
    };
    req.user = { userId: MOCK_USER_ID };
    req.t = (key: string) => (key === 'ERR_FILE_TYPE_NOT_ALLOWED' ? '文件类型不允许' : key);
    const result = await runChain(chainHandles, req);
    return { ...result, wireBytes: wire.length };
  }

  it('locks the shared single source of truth at 10 MiB', () => {
    expect(POST_ATTACHMENT_MAX_BYTES).toBe(10485760);
  });

  it('accepts one byte below the cap (10485759)', async () => {
    const result = await send({
      filename: 'below.png',
      mimeType: 'image/png',
      content: imageContent(PNG_MAGIC, POST_ATTACHMENT_MAX_BYTES - 1),
    });
    expect(result.status).toBe(201);
    expect(typeof result.body?.url).toBe('string');
  });

  it('accepts exactly the cap (10485760) although the multipart wire body is larger', async () => {
    const result = await send({
      filename: 'exact.png',
      mimeType: 'image/png',
      content: imageContent(PNG_MAGIC, POST_ATTACHMENT_MAX_BYTES),
    });
    // R2 判别用例：缺 POST_ATTACHMENT_MAX_BYTES + 1 的收敛点换算，本条必红。
    expect(result.status).toBe(201);
    // busboy 的 fileSize 只计文件字节，不含边界与部件头开销（R9 计量口径）。
    expect(result.wireBytes).toBeGreaterThan(POST_ATTACHMENT_MAX_BYTES);
  });

  it('rejects one byte above the cap (10485761) with a bare LIMIT_FILE_SIZE 413', async () => {
    const result = await send({
      filename: 'above.png',
      mimeType: 'image/png',
      content: imageContent(PNG_MAGIC, POST_ATTACHMENT_MAX_BYTES + 1),
    });
    expect(result.status).toBe(413);
    // R4 冻结：响应体恰为 {"error":"LIMIT_FILE_SIZE"}；i18n 中间件只译 ERR_ 前缀，故无 message。
    expect(result.body).toEqual({ error: 'LIMIT_FILE_SIZE' });
    expect(result.body).not.toHaveProperty('message');
  });

  it('reports the type error ahead of the size error for an oversized non-image (precedence P1)', async () => {
    const result = await send({
      filename: 'oversized.exe',
      mimeType: 'application/octet-stream',
      content: imageContent(PNG_MAGIC, POST_ATTACHMENT_MAX_BYTES + 64),
    });
    expect(result.status).toBe(400);
    expect(result.body?.error).toBe('ERR_FILE_TYPE_NOT_ALLOWED');
  });

  it('accepts an uppercase extension image and stores it lowercased (R8 / M1)', async () => {
    const result = await send({
      filename: 'IMG_0001.JPG',
      mimeType: 'image/jpeg',
      content: imageContent(JPEG_MAGIC, 4096),
    });
    // 回归锚点：修 M1 之前，本请求会因适配器白名单不认 'JPG' 而落 500。
    expect(result.status).toBe(201);
    const url = result.body?.url;
    expect(typeof url).toBe('string');
    if (typeof url === 'string') {
      expect(url).toMatch(new RegExp(`^/uploads/posts/${MOCK_USER_ID}/[0-9a-fA-F-]+\\.jpg$`));
      const stored = await fs.stat(path.join(uploadRoot, url.replace(/^\/uploads\//, '')));
      expect(stored.size).toBe(4096);
    }
  });

  it('answers 400 ERR_FILE_TYPE_NOT_ALLOWED for bmp instead of 500 (R8 / M2)', async () => {
    const result = await send({
      filename: 'legacy.bmp',
      mimeType: 'image/bmp',
      content: imageContent(BMP_MAGIC, 4096),
    });
    expect(result.status).toBe(400);
    expect(result.body?.error).toBe('ERR_FILE_TYPE_NOT_ALLOWED');
    expect(result.body?.message).toBe('文件类型不允许');
  });

  it('answers 400 ERR_FILE_TYPE_NOT_ALLOWED for tiff instead of 500 (R8 / M2)', async () => {
    const result = await send({
      filename: 'legacy.tif',
      mimeType: 'image/tiff',
      content: imageContent(TIFF_MAGIC, 4096),
    });
    expect(result.status).toBe(400);
    expect(result.body?.error).toBe('ERR_FILE_TYPE_NOT_ALLOWED');
  });

  it('still rejects forged mime content with 400', async () => {
    const result = await send({
      filename: 'forged.png',
      mimeType: 'image/png',
      content: imageContent(JPEG_MAGIC, 2048),
    });
    expect(result.status).toBe(400);
    expect(result.body?.error).toBe('ERR_FILE_CONTENT_TYPE_MISMATCH');
  });

  it('answers 400 ERR_NO_FILE when the body carries no file part', async () => {
    const wire = Buffer.from('{"not":"multipart"}');
    const req: any = chunkedReadable(wire);
    req.headers = { 'content-type': 'application/json', 'content-length': String(wire.length) };
    req.user = { userId: MOCK_USER_ID };
    const result = await runChain(chainHandles, req);
    expect(result.status).toBe(400);
    expect(result.body?.error).toBe('ERR_NO_FILE');
  });

  it('keeps 500 reserved for real storage failures (upper bound of the M2 fallback)', async () => {
    const handles = routeHandles(POST_IMAGE_PATH);
    const chain = [
      pickHandle(handles, 'multerMiddleware'),
      pickHandle(handles, 'validateMagicBytes'),
      (async () => {
        throw new Error('ENOSPC: no space left on device');
      }) as Handle,
    ];
    const wire = multipartBody('disk.png', 'image/png', imageContent(PNG_MAGIC, 2048));
    const req: any = chunkedReadable(wire);
    req.headers = {
      'content-type': `multipart/form-data; boundary=${BOUNDARY}`,
      'content-length': String(wire.length),
    };
    req.user = { userId: MOCK_USER_ID };
    const result = await runChain(chain, req);
    // 非 ERR_ 前缀的真故障仍必须 500，防止 M2 回落被写宽。
    expect(result.status).toBe(500);
  });
});

describe('post image limit source guards (FREEZE R2/R3 convergence)', () => {
  it('keeps the +1 busboy compensation in exactly one place and drops the stale 5 MiB literal', async () => {
    const source = await fs.readFile(path.join(process.cwd(), 'src', 'routes', 'upload.ts'), 'utf-8');
    expect(source).not.toMatch(/5\s*\*\s*1024\s*\*\s*1024/);
    expect(source.match(/POST_ATTACHMENT_MAX_BYTES\s*\+\s*1/g)?.length).toBe(1);
    expect(source.match(/fileSize:/g)?.length).toBe(2);
    // 私信路由的 10 MiB 字面量必须原样保留（R3：本期私信零改动）。
    expect(source.match(/limits:\s*\{\s*fileSize:\s*10\s*\*\s*1024\s*\*\s*1024\s*\}/g)?.length).toBe(1);
  });
});

describe('upload error code to status mapping (QA plan U04, freeze B3 guard)', () => {
  it('maps the upload domain codes exactly as frozen', () => {
    expect(getStatusCodeForErrorCode('LIMIT_FILE_SIZE')).toBe(413);
    expect(getStatusCodeForErrorCode('ERR_FILE_TYPE_NOT_ALLOWED')).toBe(400);
    expect(getStatusCodeForErrorCode('ERR_FILE_CONTENT_TYPE_MISMATCH')).toBe(400);
    expect(getStatusCodeForErrorCode('ERR_INVALID_FILE_EXTENSION')).toBe(400);
    expect(getStatusCodeForErrorCode('ERR_NOT_FOUND')).toBe(404);
    expect(getStatusCodeForErrorCode('ERR_UNAUTHORIZED_MISSING_SESSION')).toBe(401);
    // ERR_NO_FILE 在映射器里没有任何分支命中（真值 500）；线上的 400 来自路由与控制器
    // 显式的 res.status(400).json(...)（routes/upload.ts、controllers/upload.ts）。
    // 本条把该非对称钉成事实，防止有人以为「换个码就能靠全局映射器出 400」。
    expect(getStatusCodeForErrorCode('ERR_NO_FILE')).toBe(500);
  });

  it('documents why the rename to ERR_FILE_TOO_LARGE is forbidden without a mapper change (R4)', () => {
    // 本条是机器化的陷阱告示牌：自定义超限码若不显式加映射，会静默落到 :56 的 500 兜底。
    // 一旦将来有人给 httpErrors 加了新分支，本断言会变红，强制其回到契约层重新冻结。
    expect(getStatusCodeForErrorCode('ERR_FILE_TOO_LARGE')).toBe(500);
    expect(getStatusCodeForErrorCode('ERR_UNKNOWN_THING')).toBe(500);
    // 其它 multer LIMIT_* 走 400（本期帖子链只实际触发 LIMIT_FILE_SIZE）。
    expect(getStatusCodeForErrorCode('LIMIT_UNEXPECTED_FILE')).toBe(400);
  });

  it('preserves the code carried by multer and fileFilter errors unchanged', () => {
    const multerStyle = Object.assign(new Error('File too large'), { code: 'LIMIT_FILE_SIZE' });
    expect(getErrorCodeFromUnknown(multerStyle)).toBe('LIMIT_FILE_SIZE');
    expect(getErrorCodeFromUnknown(new Error('ERR_FILE_TYPE_NOT_ALLOWED'))).toBe('ERR_FILE_TYPE_NOT_ALLOWED');
    expect(getErrorCodeFromUnknown('ERR_FILE_CONTENT_TYPE_MISMATCH')).toBe('ERR_FILE_CONTENT_TYPE_MISMATCH');
    expect(getErrorCodeFromUnknown(new Error('boom'))).toBe('ERR_INTERNAL_SERVER_ERROR');
  });
});
