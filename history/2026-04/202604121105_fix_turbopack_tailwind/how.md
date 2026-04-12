# 技术设计方案

## 方案选型
引入向下兼容的 `tailwind.config.ts` 并在 CSS 中通过 `@config` 指令加载配置。

## 架构变更
1. **新建配置文件**:
   - 在 `packages/frontend/tailwind.config.ts` 中创建一个兼容的 Tailwind 配置文件。
   - 使用 Node 的 `require` 或者 ES6 `import` 引入 `@tailwindcss/typography` 插件，将其放入 `plugins` 数组。

2. **修改 CSS 引入方式**:
   - 打开 `packages/frontend/src/app/globals.css`。
   - 将失效的 `@plugin "@tailwindcss/typography";` 移除。
   - 替换为 `@config "../../tailwind.config.ts";`，让 Tailwind v4 读取该配置文件。

## 安全与性能评估
- **安全性**: 该修改仅改变了编译时的插件加载方式，对应用运行时的安全性没有影响。
- **性能**: 不影响打包后的 CSS 文件大小和客户端加载性能。