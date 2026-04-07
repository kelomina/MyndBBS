"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePostStatus = exports.getPosts = exports.deleteCategory = exports.createCategory = exports.getCategories = exports.updateUserStatus = exports.updateUserRole = exports.getUsers = void 0;
const db_1 = require("../db");
// Users
const getUsers = async (req, res) => {
    const users = await db_1.prisma.user.findMany({
        select: { id: true, username: true, email: true, role: true, status: true, createdAt: true }
    });
    res.json(users);
};
exports.getUsers = getUsers;
const updateUserRole = async (req, res) => {
    const id = req.params.id;
    const { role } = req.body;
    if (!['USER', 'ADMIN', 'MODERATOR'].includes(role)) {
        res.status(400).json({ error: 'Invalid role' });
        return;
    }
    const user = await db_1.prisma.user.update({ where: { id }, data: { role } });
    res.json({ message: 'Role updated', user: { id: user.id, role: user.role } });
};
exports.updateUserRole = updateUserRole;
const updateUserStatus = async (req, res) => {
    const id = req.params.id;
    const { status } = req.body;
    if (!['ACTIVE', 'BANNED', 'PENDING'].includes(status)) {
        res.status(400).json({ error: 'Invalid status' });
        return;
    }
    const user = await db_1.prisma.user.update({ where: { id }, data: { status } });
    res.json({ message: 'Status updated', user: { id: user.id, status: user.status } });
};
exports.updateUserStatus = updateUserStatus;
// Categories
const getCategories = async (req, res) => {
    const categories = await db_1.prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });
    res.json(categories);
};
exports.getCategories = getCategories;
const createCategory = async (req, res) => {
    const { name, description, sortOrder } = req.body;
    const category = await db_1.prisma.category.create({
        data: { name, description, sortOrder: sortOrder || 0 }
    });
    res.status(201).json(category);
};
exports.createCategory = createCategory;
const deleteCategory = async (req, res) => {
    const id = req.params.id;
    await db_1.prisma.category.delete({ where: { id } });
    res.json({ message: 'Category deleted' });
};
exports.deleteCategory = deleteCategory;
// Posts
const getPosts = async (req, res) => {
    const posts = await db_1.prisma.post.findMany({
        include: { author: { select: { username: true } }, category: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }
    });
    res.json(posts);
};
exports.getPosts = getPosts;
const updatePostStatus = async (req, res) => {
    const id = req.params.id;
    const { status } = req.body;
    if (!['PUBLISHED', 'HIDDEN', 'PINNED'].includes(status)) {
        res.status(400).json({ error: 'Invalid status' });
        return;
    }
    const post = await db_1.prisma.post.update({ where: { id }, data: { status } });
    res.json({ message: 'Post status updated', post });
};
exports.updatePostStatus = updatePostStatus;
//# sourceMappingURL=admin.js.map