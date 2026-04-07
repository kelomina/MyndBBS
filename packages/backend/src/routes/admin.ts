import { Router } from 'express';
import { requireAuth, requireAbility } from '../middleware/auth';
import {
  getUsers, updateUserRole, updateUserStatus,
  getCategories, createCategory, deleteCategory,
  assignCategoryModerator, removeCategoryModerator,
  getPosts, updatePostStatus
} from '../controllers/admin';

const router: Router = Router();

router.use(requireAuth);

// User Management routes
router.get('/users', requireAbility('manage', 'User'), getUsers);
router.patch('/users/:id/role', requireAbility('manage', 'User'), updateUserRole);
router.patch('/users/:id/status', requireAbility('manage', 'User'), updateUserStatus);

// Category Structure routes
router.post('/categories', requireAbility('manage', 'Category'), createCategory);
router.delete('/categories/:id', requireAbility('manage', 'Category'), deleteCategory);
router.post('/categories/:categoryId/moderators/:userId', requireAbility('manage', 'Category'), assignCategoryModerator);
router.delete('/categories/:categoryId/moderators/:userId', requireAbility('manage', 'Category'), removeCategoryModerator);

// Content Management routes
router.get('/categories', requireAbility('read', 'AdminPanel'), getCategories);
router.get('/posts', requireAbility('read', 'AdminPanel'), getPosts);
router.patch('/posts/:id/status', requireAbility('update_status', 'Post'), updatePostStatus);

export default router;
