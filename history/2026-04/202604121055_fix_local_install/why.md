# 修复本地环境依赖未安装问题

## 背景与目的
上一轮我们在 `main` 分支的 `package.json` 中加入了 `@tailwindcss/typography` 依赖，并在 `globals.css` 中引入了该插件。
当您在本地 Windows 机器（E 盘）拉取代码并直接运行 `pnpm run dev` 时，由于本地并没有安装该新加入的包，导致 Next.js/Turbopack 在编译 CSS 时找不到对应模块，抛出了 `Can't resolve '@tailwindcss/typography'` 的错误。

## 目标与价值
通过指示在本地环境正确执行 `pnpm install` 来同步依赖，使新引入的排版插件顺利生效，并解除构建错误。