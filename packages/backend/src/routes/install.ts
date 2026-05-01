/**
 * 路由模块：Install
 *
 * 函数作用：
 *   系统安装向导 API 路由，包括环境配置和管理员创建。
 *
 * Purpose:
 *   System installation wizard API routes including environment setup and admin creation.
 *
 * 路由前缀 / Route prefix:
 *   /install
 *
 * 中文关键词：
 *   安装，配置，环境，管理员创建
 * English keywords:
 *   install, setup, environment, admin creation
 */
import { Router } from 'express';
import { getTailwindScript, getInstallHtml, setupEnv, setupAdmin } from '../controllers/install';

const router: Router = Router();

router.get('/tailwind.js', getTailwindScript);
router.get('/', getInstallHtml);
router.post('/api/env', setupEnv);
router.post('/api/admin', setupAdmin);

export default router;
