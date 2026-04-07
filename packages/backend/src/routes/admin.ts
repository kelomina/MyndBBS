import { Router } from 'express';
import { requireAuth, requireAdmin, requireSuperAdmin } from '../middleware/auth';
import {
  getUsers, updateUserRole, updateUserStatus,
  getCategories, createCategory, deleteCategory,
  assignCategoryModerator, removeCategoryModerator,
  getPosts, updatePostStatus
} from '../controllers/admin';

const router: Router = Router();

router.use(requireAuth);

// Super Admin only routes (User Management & Category Structure)
router.get('/users', requireSuperAdmin, getUsers);
router.patch('/users/:id/role', requireSuperAdmin, updateUserRole);
router.patch('/users/:id/status', requireSuperAdmin, updateUserStatus);
router.post('/categories', requireSuperAdmin, createCategory);
router.delete('/categories/:id', requireSuperAdmin, deleteCategory);
router.post('/categories/:categoryId/moderators/:userId', requireSuperAdmin, assignCategoryModerator);
router.delete('/categories/:categoryId/moderators/:userId', requireSuperAdmin, removeCategoryModerator);

// Moderator & Admin routes (Content Management)
router.get('/categories', requireAdmin, getCategories);
router.get('/posts', requireAdmin, getPosts);
router.patch('/posts/:id/status', requireAdmin, updatePostStatus);

export default router;
