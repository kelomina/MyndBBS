import fs from 'fs/promises';
import path from 'path';

describe('SearchIndexer Meilisearch client loading', () => {
  it('supports the current meilisearch package export name', async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), 'src', 'infrastructure', 'search', 'SearchIndexer.ts'),
      'utf-8',
    );

    expect(source).toContain('meilisearchModule.MeiliSearch ?? meilisearchModule.Meilisearch');
    expect(source).toContain("throw new Error('ERR_MEILISEARCH_CLIENT_UNAVAILABLE')");
  });
});
