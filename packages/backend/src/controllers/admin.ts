import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Users
export const getUsers = async (req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, email: true, role: true, status: true, createdAt: true }
  });
  res.json(users);
};

export const updateUserRole = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const { role } = req.body;
  if (!['USER', 'ADMIN', 'MODERATOR'].includes(role)) {
    res.status(400).json({ error: 'Invalid role' });
    return;
  }
  const user = await prisma.user.update({ where: { id }, data: { role } });
  res.json({ message: 'Role updated', user: { id: user.id, role: user.role } });
};

export const updateUserStatus = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const { status } = req.body;
  if (!['ACTIVE', 'BANNED', 'PENDING'].includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }
  const user = await prisma.user.update({ where: { id }, data: { status } });
  res.json({ message: 'Status updated', user: { id: user.id, status: user.status } });
};

// Categories
export const getCategories = async (req: Request, res: Response) => {
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });
  res.json(categories);
};

export const createCategory = async (req: Request, res: Response) => {
  const { name, description, sortOrder } = req.body;
  const category = await prisma.category.create({
    data: { name, description, sortOrder: sortOrder || 0 }
  });
  res.status(201).json(category);
};

export const deleteCategory = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  await prisma.category.delete({ where: { id } });
  res.json({ message: 'Category deleted' });
};

// Posts
export const getPosts = async (req: Request, res: Response) => {
  const posts = await prisma.post.findMany({
    include: { author: { select: { username: true } }, category: { select: { name: true } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json(posts);
};

export const updatePostStatus = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const { status } = req.body;
  if (!['PUBLISHED', 'HIDDEN', 'PINNED'].includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }
  const post = await prisma.post.update({ where: { id }, data: { status } });
  res.json({ message: 'Post status updated', post });
};
