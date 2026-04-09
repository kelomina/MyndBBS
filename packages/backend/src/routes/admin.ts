import { Router } from 'express';
import { requireAuth, requireAbility } from '../middleware/auth';
import {
  getUsers, updateUserRole, updateUserStatus,
  getCategories, createCategory, updateCategory, deleteCategory,
  assignCategoryModerator, removeCategoryModerator,
  getPosts, updatePostStatus,
  getDeletedPosts, getDeletedComments, restorePost, hardDeletePost, restoreComment, hardDeleteComment,
  getDbConfig, updateDbConfig
} from '../controllers/admin';

const router: Router = Router();

router.use(requireAuth);

// User Management routes
router.get('/users', requireAbility('manage', 'User'), getUsers);
router.patch('/users/:id/role', requireAbility('manage', 'User'), updateUserRole);
router.patch('/users/:id/status', requireAbility('manage', 'User'), updateUserStatus);

// Category Structure routes
router.post('/categories', requireAbility('manage', 'Category'), createCategory);
router.put('/categories/:id', requireAbility('manage', 'Category'), updateCategory);
router.delete('/categories/:id', requireAbility('manage', 'Category'), deleteCategory);
router.post('/categories/:categoryId/moderators/:userId', requireAbility('manage', 'Category'), assignCategoryModerator);
router.delete('/categories/:categoryId/moderators/:userId', requireAbility('manage', 'Category'), removeCategoryModerator);

// Content Management routes
router.get('/categories', requireAbility('read', 'AdminPanel'), getCategories);
router.get('/posts', requireAbility('read', 'AdminPanel'), getPosts);
router.patch('/posts/:id/status', requireAbility('update_status', 'Post'), updatePostStatus);

// Recycle Bin routes
router.get('/recycle/posts', requireAbility('read', 'AdminPanel'), getDeletedPosts);
router.get('/recycle/comments', requireAbility('read', 'AdminPanel'), getDeletedComments);
router.post('/recycle/posts/:id/restore', requireAbility('read', 'AdminPanel'), restorePost);
router.delete('/recycle/posts/:id', requireAbility('read', 'AdminPanel'), hardDeletePost);
router.post('/recycle/comments/:id/restore', requireAbility('read', 'AdminPanel'), restoreComment);
router.delete('/recycle/comments/:id', requireAbility('read', 'AdminPanel'), hardDeleteComment);

// Database Config routes (SUPER_ADMIN only)
router.get('/db-config', getDbConfig);
router.post('/db-config', updateDbConfig);

export default router;
