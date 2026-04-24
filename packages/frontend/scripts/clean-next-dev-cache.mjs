import { rm } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Callers: [cleanNextDevCache, tests/nextBuildCache.test.mjs]
 * Callees: [resolve]
 * Description: Resolves the Next.js development cache directory that can contain stale generated type validators.
 * 描述：解析可能包含过期生成类型校验文件的 Next.js 开发缓存目录。
 * Variables: `projectRoot` is the frontend package root; the returned path points at `.next/dev`.
 * 变量：`projectRoot` 是前端包根目录；返回路径指向 `.next/dev`。
 * Integration: Use this helper before deleting Next.js generated development cache files.
 * 接入方式：删除 Next.js 生成的开发缓存文件前调用本函数。
 * Error Handling: Path resolution itself does not touch the filesystem, so filesystem errors are handled by callers.
 * 错误处理：路径解析本身不访问文件系统，文件系统错误由调用方处理。
 * Keywords: next cache, dev types, validator, build preflight, path resolve, Next缓存, 开发类型, 校验文件, 构建预检, 路径解析
 */
export function resolveNextDevCachePath(projectRoot = process.cwd()) {
  return resolve(projectRoot, '.next', 'dev');
}

/**
 * Callers: [cleanNextDevCache, tests/nextBuildCache.test.mjs]
 * Callees: [resolve, relative, isAbsolute]
 * Description: Checks whether a target path stays within the intended project root before recursive deletion.
 * 描述：在递归删除前检查目标路径是否仍位于预期项目根目录内。
 * Variables: `projectRoot` is the allowed root; `targetPath` is the deletion candidate; `relativePath` is the target path relative to the root.
 * 变量：`projectRoot` 是允许的根目录；`targetPath` 是待删除候选路径；`relativePath` 是目标相对根目录的路径。
 * Integration: Call this guard before removing generated directories.
 * 接入方式：删除生成目录前调用本保护函数。
 * Error Handling: Returns `false` for sibling or absolute escape paths so callers can reject unsafe deletion.
 * 错误处理：对同级逃逸路径或绝对逃逸路径返回 `false`，调用方据此拒绝不安全删除。
 * Keywords: safe delete, workspace guard, recursive removal, path escape, project root, 安全删除, 工作区保护, 递归删除, 路径逃逸, 项目根目录
 */
export function isPathInsideProject(projectRoot, targetPath) {
  const resolvedRoot = resolve(projectRoot);
  const resolvedTarget = resolve(targetPath);
  const relativePath = relative(resolvedRoot, resolvedTarget);

  return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath));
}

/**
 * Callers: [package.json prebuild, tests/nextBuildCache.test.mjs]
 * Callees: [resolveNextDevCachePath, isPathInsideProject, rm]
 * Description: Removes stale Next.js development cache before production builds so `.next/dev/types` cannot poison type checking.
 * 描述：生产构建前删除过期的 Next.js 开发缓存，避免 `.next/dev/types` 污染类型检查。
 * Variables: `projectRoot` is the frontend package root; `devCachePath` is the generated cache directory being removed.
 * 变量：`projectRoot` 是前端包根目录；`devCachePath` 是将被删除的生成缓存目录。
 * Integration: Wire this function through the frontend `prebuild` lifecycle script.
 * 接入方式：通过前端 `prebuild` 生命周期脚本接入本函数。
 * Error Handling: Throws `ERR_UNSAFE_NEXT_CACHE_PATH` if path validation fails; missing cache directories are ignored.
 * 错误处理：路径校验失败时抛出 `ERR_UNSAFE_NEXT_CACHE_PATH`；缓存目录不存在时忽略。
 * Keywords: prebuild cleanup, next dev cache, typecheck, generated files, stale validator, 构建前清理, Next开发缓存, 类型检查, 生成文件, 过期校验
 */
export async function cleanNextDevCache(projectRoot = process.cwd()) {
  const devCachePath = resolveNextDevCachePath(projectRoot);

  if (!isPathInsideProject(projectRoot, devCachePath)) {
    throw new Error('ERR_UNSAFE_NEXT_CACHE_PATH');
  }

  await rm(devCachePath, { recursive: true, force: true });
  return devCachePath;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await cleanNextDevCache();
}
