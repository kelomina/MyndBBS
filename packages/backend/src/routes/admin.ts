import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import {
  getUsers, updateUserRole, updateUserStatus,
  getCategories, createCategory, deleteCategory,
  getPosts, updatePostStatus
} from '../controllers/admin';

const router: Router = Router();

// Protect all admin routes
router.use(requireAuth);
router.use(requireAdmin);

// Users
router.get('/users', getUsers);
router.patch('/users/:id/role', updateUserRole);
router.patch('/users/:id/status', updateUserStatus);

// Categories
router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.delete('/categories/:id', deleteCategory);

// Posts
router.get('/posts', getPosts);
router.patch('/posts/:id/status', updatePostStatus);

export default router;
