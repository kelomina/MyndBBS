/**
 * Post Controller
 * Handles post and comment operations.
 */
import { Response, Request } from 'express';
import { AuthRequest } from '../middleware/auth';

import { communityApplicationService } from '../registry';
import { communityQueryService } from '../queries/community/CommunityQueryService';

/**
 * Callers: []
 * Callees: [communityQueryService.listPosts, json, status]
 * Description: Fetches a paginated list of posts.
 * Keywords: post, list, community, query
 */
export const getPostsList = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const posts = await communityQueryService.listPosts({
      ability: req.ability!,
      category: req.query.category as string,
      sortBy: req.query.sortBy as string,
    });
    res.json(posts);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: 'ERR_FAILED_TO_FETCH_POSTS' });
  }
};

/**
 * Callers: []
 * Callees: [authApplicationService.consumeCaptcha, communityQueryService.getUserLevel, communityApplicationService.createPost, communityQueryService.getPostById, json, status]
 * Description: Creates a new post.
 * Keywords: post, create, community
 */
export const createPost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, content, categoryId, captchaId } = req.body;
    
    if (!title || !content || !categoryId) {
      res.status(400).json({ error: 'ERR_TITLE_CONTENT_AND_CATEGORYID_ARE_REQUIRED' });
      return;
    }

    if (!captchaId) {
      res.status(400).json({ error: 'ERR_CAPTCHA_IS_REQUIRED' });
      return;
    }

    const userLevel = await communityQueryService.getUserLevel(req.user!.userId);
    
    try {
      const result = await communityApplicationService.createPost(
        title, 
        content, 
        categoryId, 
        req.user!.userId, 
        userLevel,
        captchaId
      );
      const postDto = await communityQueryService.getPostById(req.ability!, result.postId);
      if (postDto?.status === 'PENDING') {
        res.status(201).json({ message: 'ERR_PENDING_MODERATION', post: postDto });
        return;
      }
      res.status(201).json({ post: postDto, isModerated: result.isModerated });
    } catch (error: any) {
      const errorCode = typeof error?.message === 'string' && error.message.startsWith('ERR_')
        ? error.message
        : 'ERR_BAD_REQUEST';
      res.status(400).json({ error: errorCode });
      return;
    }
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ error: 'ERR_FAILED_TO_CREATE_POST' });
  }
};

/**
 * Callers: []
 * Callees: [communityQueryService.getPostById, json, status]
 * Description: Fetches details of a specific post.
 * Keywords: post, details, community, query
 */
export const getPostDetails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const postId = req.params.id as string;
    
    const post = await communityQueryService.getPostById(req.ability!, postId);

    if (!post) {
      res.status(403).json({ error: 'ERR_POST_NOT_FOUND_OR_ACCESS_DENIED' });
      return;
    }

    res.json(post);
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({ error: 'ERR_FAILED_TO_FETCH_POST' });
  }
};

/**
 * Callers: []
 * Callees: [communityQueryService.getPostInteractions, json, status]
 * Description: Fetches the interaction status of a specific post for the current user.
 * Keywords: post, interactions, community, query
 */
export const getPostInteractions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const dto = await communityQueryService.getPostInteractions(req.ability!, req.params.id as string, req.user!.userId);
    if (!dto) {
      res.status(403).json({ error: 'ERR_POST_NOT_FOUND_OR_ACCESS_DENIED' });
      return;
    }
    res.json(dto);
  } catch (error) {
    console.error('Error fetching interactions:', error);
    res.status(500).json({ error: 'ERR_FAILED_TO_FETCH_INTERACTION_STATUS' });
  }
};

/**
 * Callers: []
 * Callees: [communityQueryService.getPostById, communityApplicationService.togglePostUpvote, json, status]
 * Description: Toggles an upvote on a specific post.
 * Keywords: post, upvote, toggle, community
 */
export const toggleUpvote = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const postId = req.params.id as string;
    const userId = req.user!.userId;

    const status = await communityApplicationService.togglePostUpvote(req.ability!, postId, userId);
    res.json({ upvoted: status });
  } catch (error: any) {
    console.error('Error toggling upvote:', error);
    if (error.message === 'ERR_POST_NOT_FOUND') {
      res.status(404).json({ error: error.message });
    } else if (error.message?.includes('FORBIDDEN')) {
      res.status(403).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'ERR_FAILED_TO_TOGGLE_UPVOTE' });
    }
  }
};

/**
 * Callers: []
 * Callees: [communityQueryService.getPostById, communityApplicationService.togglePostBookmark, json, status]
 * Description: Toggles a bookmark on a specific post.
 * Keywords: post, bookmark, toggle, community
 */
export const toggleBookmark = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const postId = req.params.id as string;
    const userId = req.user!.userId;

    const status = await communityApplicationService.togglePostBookmark(req.ability!, postId, userId);
    res.json({ bookmarked: status });
  } catch (error: any) {
    console.error('Error toggling bookmark:', error);
    if (error.message === 'ERR_POST_NOT_FOUND') {
      res.status(404).json({ error: error.message });
    } else if (error.message?.includes('FORBIDDEN')) {
      res.status(403).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'ERR_FAILED_TO_TOGGLE_BOOKMARK' });
    }
  }
};

/**
 * Callers: []
 * Callees: [communityQueryService.listPostComments, json, status]
 * Description: Fetches all comments for a specific post.
 * Keywords: post, comments, community, query
 */
export const getComments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const dto = await communityQueryService.listPostComments({
      ability: req.ability!,
      postId: req.params.id as string,
      ...(req.user?.userId ? { currentUserId: req.user.userId } : {}),
    });
    if (!dto) {
      res.status(403).json({ error: 'ERR_POST_NOT_FOUND_OR_ACCESS_DENIED' });
      return;
    }
    res.json(dto);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'ERR_FAILED_TO_FETCH_COMMENTS' });
  }
};

/**
 * Callers: []
 * Callees: [authApplicationService.consumeCaptcha, communityQueryService.getPostById, communityQueryService.getCommentById, communityApplicationService.createComment, communityQueryService.getPostBasicInfo, globalEventBus.publish, communityQueryService.getCommentBasicInfo, json, status]
 * Description: Creates a new comment on a specific post.
 * Keywords: comment, create, post, community
 */
export const createComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const postId = req.params.id as string;
    const { content, parentId, captchaId } = req.body;

    if (!content) {
      res.status(400).json({ error: 'ERR_COMMENT_CONTENT_IS_REQUIRED' });
      return;
    }

    if (!captchaId) {
      res.status(400).json({ error: 'ERR_CAPTCHA_IS_REQUIRED' });
      return;
    }

    try {
      const result = await communityApplicationService.createComment(
        content,
        postId,
        req.user!.userId,
        captchaId,
        parentId || undefined
      );

      const commentDto = await communityQueryService.getCommentById(result.commentId);
      
      if (commentDto?.isPending) {
        res.status(201).json({ message: 'ERR_PENDING_MODERATION', comment: commentDto });
        return;
      }

      res.status(201).json(commentDto);
    } catch (error: any) {
      const errorCode = typeof error?.message === 'string' && error.message.startsWith('ERR_')
        ? error.message
        : 'ERR_BAD_REQUEST';
      res.status(400).json({ error: errorCode });
      return;
    }
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'ERR_FAILED_TO_CREATE_COMMENT' });
  }
};

/**
 * Callers: []
 * Callees: [communityQueryService.getPostWithCategory, subject, can, communityApplicationService.updatePost, communityQueryService.getPostById, json, status]
 * Description: Updates an existing post.
 * Keywords: post, update, community
 */
export const updatePost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const postId = req.params.id as string;
    const { title, content, categoryId } = req.body;
    
    if (!title || !content || !categoryId) {
      res.status(400).json({ error: 'ERR_TITLE_CONTENT_AND_CATEGORYID_ARE_REQUIRED' });
      return;
    }

    const result = await communityApplicationService.updatePost(req.ability!, postId, title, content, categoryId);
    const postDto = await communityQueryService.getPostById(req.ability!, result.postId);
    if (postDto?.status === 'PENDING') {
      res.json({ message: 'ERR_PENDING_MODERATION', post: postDto });
      return;
    }
    res.json(postDto);
  } catch (error: any) {
    console.error('Error updating post:', error);
    if (error.message === 'ERR_POST_NOT_FOUND') {
      res.status(404).json({ error: error.message });
    } else if (error.message?.includes('FORBIDDEN')) {
      res.status(403).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'ERR_FAILED_TO_UPDATE_POST' });
    }
  }
};

/**
 * Callers: []
 * Callees: [communityQueryService.getPostWithCategory, subject, can, communityApplicationService.deletePost, json, status]
 * Description: Deletes an existing post.
 * Keywords: post, delete, community
 */
export const deletePost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const postId = req.params.id as string;
    
    await communityApplicationService.deletePost(req.ability!, postId);
    res.json({ message: 'Post and its comments deleted' });
  } catch (error: any) {
    if (error.message === 'ERR_POST_NOT_FOUND') {
      res.status(404).json({ error: error.message });
    } else if (error.message?.includes('FORBIDDEN')) {
      res.status(403).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'ERR_FAILED_TO_DELETE_POST' });
    }
  }
};

/**
 * Callers: []
 * Callees: [communityQueryService.getCommentWithPost, subject, can, communityApplicationService.updateComment, communityQueryService.getCommentById, json, status]
 * Description: Updates an existing comment.
 * Keywords: comment, update, community
 */
export const updateComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const commentId = req.params.commentId as string;
    const { content } = req.body;
    
    if (!content) {
      res.status(400).json({ error: 'ERR_CONTENT_IS_REQUIRED' });
      return;
    }

    const result = await communityApplicationService.updateComment(req.ability!, commentId, content);
    const commentDto = await communityQueryService.getCommentById(result.commentId);

    if (commentDto?.isPending) {
      res.json({ message: 'ERR_PENDING_MODERATION', comment: commentDto });
      return;
    }

    res.json(commentDto);
  } catch (error: any) {
    if (error.message === 'ERR_COMMENT_NOT_FOUND') {
      res.status(404).json({ error: error.message });
    } else if (error.message?.includes('FORBIDDEN')) {
      res.status(403).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'ERR_FAILED_TO_UPDATE_COMMENT' });
    }
  }
};

/**
 * Callers: []
 * Callees: [communityQueryService.getCommentWithPost, subject, can, communityApplicationService.deleteComment, json, status]
 * Description: Deletes an existing comment.
 * Keywords: comment, delete, community
 */
export const deleteComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const commentId = req.params.commentId as string;
    
    await communityApplicationService.deleteComment(req.ability!, commentId);
    res.json({ message: 'Comment deleted' });
  } catch (error: any) {
    if (error.message === 'ERR_COMMENT_NOT_FOUND') {
      res.status(404).json({ error: error.message });
    } else if (error.message?.includes('FORBIDDEN')) {
      res.status(403).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'ERR_FAILED_TO_DELETE_COMMENT' });
    }
  }
};

/**
 * Callers: []
 * Callees: [communityQueryService.getCommentWithPost, subject, can, communityApplicationService.toggleCommentUpvote, json, status]
 * Description: Toggles an upvote on a specific comment.
 * Keywords: comment, upvote, toggle, community
 */
export const toggleCommentUpvote = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const commentId = req.params.commentId as string;
    const userId = req.user!.userId;

    const status = await communityApplicationService.toggleCommentUpvote(req.ability!, commentId, userId);
    res.json({ upvoted: status });
  } catch (error: any) {
    console.error('Error toggling comment upvote:', error);
    if (error.message === 'ERR_COMMENT_NOT_FOUND' || error.message === 'ERR_POST_NOT_FOUND') {
      res.status(404).json({ error: error.message });
    } else if (error.message?.includes('FORBIDDEN')) {
      res.status(403).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'ERR_FAILED_TO_TOGGLE_COMMENT_UPVOTE' });
    }
  }
};

/**
 * Callers: []
 * Callees: [communityQueryService.getCommentWithPost, subject, can, communityApplicationService.toggleCommentBookmark, json, status]
 * Description: Toggles a bookmark on a specific comment.
 * Keywords: comment, bookmark, toggle, community
 */
export const toggleCommentBookmark = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const commentId = req.params.commentId as string;
    const userId = req.user!.userId;

    const status = await communityApplicationService.toggleCommentBookmark(req.ability!, commentId, userId);
    res.json({ bookmarked: status });
  } catch (error: any) {
    console.error('Error toggling comment bookmark:', error);
    if (error.message === 'ERR_COMMENT_NOT_FOUND' || error.message === 'ERR_POST_NOT_FOUND') {
      res.status(404).json({ error: error.message });
    } else if (error.message?.includes('FORBIDDEN')) {
      res.status(403).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'ERR_FAILED_TO_TOGGLE_COMMENT_BOOKMARK' });
    }
  }
};
