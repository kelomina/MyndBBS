/**
 * 中间件模块：Validation
 *
 * 函数作用：
 *   基于 Zod schema 的请求体验证中间件工厂。
 * Purpose:
 *   Zod schema-based request body validation middleware factory.
 *
 * 中文关键词：
 *   校验，Zod，请求体验证，中间件
 * English keywords:
 *   validation, Zod, request body, middleware
 */
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Callers: [routes]
 * Callees: [ZodSchema.safeParse]
 * Description: Express middleware that validates `req.body` against the provided Zod schema, returning a 400 error with field-level details on failure.
 * 描述：Express 中间件，根据传入的 Zod schema 校验 `req.body`，校验失败时返回 400 错误及字段级详情。
 * Variables: `schema` 表示目标路由的 Zod 校验模式；`result` 表示 safeParse 的结果。
 * 变量：`schema` 是目标路由的 Zod 校验模式；`result` 是 safeParse 的返回值。
 * Integration: Apply this middleware before the controller handler on routes that accept JSON bodies.
 * 接入方式：在需要接收 JSON 请求体的路由上、控制器处理器之前应用此中间件。
 * Error Handling: On validation failure, responds immediately with `400` and field-level errors. Validated (and potentially transformed) data replaces `req.body`.
 * 错误处理：校验失败时立即返回 `400` 及字段级错误信息。校验通过后，转换后的数据会替换 `req.body`。
 * Side effects: Replaces `req.body` with the validated and coerced output from safeParse.
 * 副作用：用 safeParse 校验并转换后的输出替换 `req.body`。
 * Keywords: validation, zod, middleware, request body, schema, 校验, 中间件, 请求体, 模式
 */
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const zodError = result.error as ZodError;
      const fieldErrors: Record<string, string[]> = {};

      for (const issue of zodError.issues) {
        const path = issue.path.join('.') || '_root';
        if (!fieldErrors[path]) {
          fieldErrors[path] = [];
        }
        fieldErrors[path]!.push(issue.message);
      }

      res.status(400).json({
        error: 'ERR_VALIDATION_FAILED',
        details: fieldErrors,
      });
      return;
    }

    req.body = result.data;
    next();
  };
}
