import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

describe('post editor image upload support', () => {
  it('keeps uploaded image extensions so markdown images render inline', async () => {
    const uploadControllerPath = path.join(process.cwd(), 'src', 'controllers', 'upload.ts');
    const uploadRoutePath = path.join(process.cwd(), 'src', 'routes', 'upload.ts');
    const systemServicePath = path.join(process.cwd(), 'src', 'application', 'system', 'SystemApplicationService.ts');
    const indexPath = path.join(process.cwd(), 'src', 'index.ts');

    const [uploadController, uploadRoute, systemService, indexSource] = await Promise.all([
      fs.readFile(uploadControllerPath, 'utf-8'),
      fs.readFile(uploadRoutePath, 'utf-8'),
      fs.readFile(systemServicePath, 'utf-8'),
      fs.readFile(indexPath, 'utf-8'),
    ]);

    assert.match(uploadController, /path\.extname\(req\.file\.originalname\)/);
    assert.match(uploadRoute, /0x52,\s*0x49,\s*0x46,\s*0x46,\s*null,\s*null,\s*null,\s*null,\s*0x57,\s*0x45,\s*0x42,\s*0x50/);
    assert.match(systemService, /public async uploadAttachment\(content: Buffer, ext: string = 'enc'\)/);
    assert.match(systemService, /const filename = `\$\{uuidv4\(\)\}\.\$\{safeExt\}`/);
    assert.match(indexSource, /isInlineMessageImage/);
    assert.match(indexSource, /Content-Disposition', 'inline'/);
  });
});
