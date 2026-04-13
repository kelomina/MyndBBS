import type { Prisma } from '@prisma/client';

export type PostListItemDTO = Prisma.PostGetPayload<{
  include: {
    author: { select: { id: true; username: true } };
    category: { select: { id: true; name: true; description: true } };
    _count: { select: { comments: true; upvotes: true } };
  };
}>;

export type PostDetailDTO = Prisma.PostGetPayload<{
  include: {
    author: { select: { id: true; username: true } };
    category: { select: { id: true; name: true; description: true } };
    _count: { select: { comments: true; upvotes: true; bookmarks: true } };
  };
}>;

export type PostInteractionDTO = { upvoted: boolean; bookmarked: boolean };

export type CommentListItemDTO = Prisma.CommentGetPayload<{
  include: {
    author: { select: { id: true; username: true } };
    _count: { select: { upvotes: true; bookmarks: true; replies: true } };
  };
}> & { hasUpvoted?: boolean; hasBookmarked?: boolean };

export type CategoryListItemDTO = Prisma.CategoryGetPayload<{}>;

export type ListPostsParams = {
  ability: import('../../lib/casl').AppAbility;
  category?: string;
  sortBy?: string;
  take?: number;
};

export type GetPostParams = {
  ability: import('../../lib/casl').AppAbility;
  postId: string;
};

export type ListPostCommentsParams = {
  ability: import('../../lib/casl').AppAbility;
  postId: string;
  currentUserId?: string;
  take?: number;
};
