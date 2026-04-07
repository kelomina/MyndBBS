"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const admin_1 = require("../controllers/admin");
const router = (0, express_1.Router)();
// Protect all admin routes
router.use(auth_1.requireAuth);
router.use(auth_1.requireAdmin);
// Users
router.get('/users', admin_1.getUsers);
router.patch('/users/:id/role', admin_1.updateUserRole);
router.patch('/users/:id/status', admin_1.updateUserStatus);
// Categories
router.get('/categories', admin_1.getCategories);
router.post('/categories', admin_1.createCategory);
router.delete('/categories/:id', admin_1.deleteCategory);
// Posts
router.get('/posts', admin_1.getPosts);
router.patch('/posts/:id/status', admin_1.updatePostStatus);
exports.default = router;
//# sourceMappingURL=admin.js.map