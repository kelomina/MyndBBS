import type { PostListItemDTO } from '../src/queries/community/dto';

describe('community dto types', () => {
  it('PostListItemDTO has stable fields', () => {
    const x: PostListItemDTO = {
      id: 'p1',
      title: 't',
      createdAt: new Date(),
      status: 'PUBLISHED' as any,
      author: { id: 'u1', username: 'u' },
      category: { id: 'c1', name: 'c', description: null },
      _count: { comments: 0, upvotes: 0 },
    };
    expect(x.author.username).toBe('u');
  });
});
