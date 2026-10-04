# 随附 Human Verification v2 插件迁移与运维

适用：2026-10-04 冻结契约。本文是待人工审批执行的操作说明，**不是生产执行授权**。随附源码位于 `packages/backend/plugins/human-verification/`；正式运行必须经过签名验证、信任审查、SUPER_ADMIN + sudo 审批和激活，与外部插件没有豁免差别。

## 1. 必须拆成 Stage A / Stage B，不能一次发布

旧 v2 manifest 校验器不认识 `capabilities.humanVerification`。直接发布解耦后的核心会在 provider 尚不可用时阻断受保护业务；禁止用旧算法 fallback、临时关闭校验或自动批准来跨过这个窗口。

1. **准备与备份**：另获部署批准；备份 DB dump、镜像 ID、Compose、插件 release/state/approval/config 和数据卷，记录回滚锚点。不要导出 `.env`、私钥或控制凭证到仓库/报告。
2. **Stage A：仅发布兼容基础设施**：manifest、runtime、control 及必要的后台配置能力认识新 capability；**保留旧 captcha 业务实现、接口和前端**。单独选择并审查这一阶段的变更集，不要把当前已解耦的工作区当成 Stage A 直接部署。验证旧业务可用与平台兼容，不改变实际验证开关。
3. **导出旧策略，离线转换并审核**：按第 2 节只导出三项非秘密 SitePolicy；人工比较新旧开关、强度和题型。不得从完整数据库 dump 或 `.env` 自动提取配置。
4. **签名、批准并激活 provider**：按第 3 节使用受控 signing secret 打包；审查并显式配置签名公钥信任，后台上传精确 artifact/signature，SUPER_ADMIN + sudo 批准精确 release/digest。保存审阅后的插件 config，再显式激活；已经激活的实例须 reload 才使用新保存配置。确认 active/approved/healthy、provider ID、版本、digest/generation 及配置效果。
5. **Stage A 门禁**：旧业务仍正常，provider 已在兼容平台批准并健康运行；在隔离预发布环境验证新桥所需能力、purpose 绑定、过期/重放/故障拒绝。不能只凭一个 health 200 批准切换。
6. **Stage B：另一次部署切换核心/BFF/UI**：满足上一门禁且再次获准后，才发布中立 proof adapter、业务 gate 和插件 UI 的解耦版本。缺 provider、失活、存储或配置异常必须 fail closed，不回退旧验证码。完成注册/发帖/评论/好友申请及读限流解锁的端到端验收。

本说明和转换工具均不上传、不保存后台配置、不修改 trust store、不自动批准/激活/切换开关，也不执行任何生产操作。

## 2. 旧配置导出与离线转换

### 2.1 真实存储键与输入范围

`SitePolicy` 模型为 `key` / JSON `value` / `updatedAt`。

| 实际 SitePolicy.key | 转换目标 | 说明 |
| --- | --- | --- |
| `captcha_protection` | `enabled`、四个 `surfaces` | 保留人工明确配置的 true/false |
| **`captcha_federal`** | `federal` | 旧 `/admin/protection/federal` 的实际存储键，不是 `federal_protection` |
| `rate_limit_unlock` | 仅 `captchaStrength` → `sliderStrength` | 读限流策略其余字段仍由核心控制，不搬入插件 |

工具接受人工导出的 `federal_protection` 别名；不得与 `captcha_federal` 同时出现，重复/歧义输入直接报错。旧 `kinds.sliderEnabled/geometryEnabled/powEnabled` 分别转为 `federal.kinds.slider/geometry/pow`。其余联邦字段保留；旧记录缺 `strictTimeoutSec` 时显式补 15。

**只在获授权的导出环境由运维执行以下只读 SQL**，优先使用脱敏备份；本工具不连接数据库。将单个 JSON 结果另存为 UTF-8 `legacy-policy.json`，不要附带 psql 表头：

```sql
SELECT json_build_object(
  'captcha_protection', (SELECT "value" FROM "SitePolicy" WHERE "key" = 'captcha_protection'),
  'captcha_federal', (SELECT "value" FROM "SitePolicy" WHERE "key" = 'captcha_federal'),
  'rate_limit_unlock', (SELECT "value" FROM "SitePolicy" WHERE "key" = 'rate_limit_unlock')
);
```

也支持仅选中上述三项的 `[{"key":"…","value":{…},"updatedAt":"…"}]`；`value` 必须是 JSON 对象或明确的 `null`，不是二次 JSON 编码字符串。后台 GET 包装响应不能直接当 SitePolicy value 输入。

三个策略槽位都必须出现。运维确认行不存在时明确传 `null`（数组形式也须显式补该行），工具才输出保护默认：业务总开关/四入口 true，sliderStrength=low，联邦三题型启用、默认 slider、powBits=16、geometryLevel=1、timeoutSec=10、strictTimeoutSec=15。**默认值只写入候选 JSON，需人工审核，不代表允许自动改线上开关。** 非 null 但残缺/非法的记录会拒绝，不模仿旧解析器静默修复；数字字符串、未知字段、三题型全关也拒绝，即使 `federal.enabled=false` 亦如此。

### 2.2 工具命令（PowerShell，仓库根目录）

```powershell
node "scripts/export-human-verification-config.mjs" --help
node "scripts/export-human-verification-config.mjs" --input "legacy-policy.json" --out "human-verification-config.json"
# 或通过 stdin，结果写 stdout，不保存或激活任何插件：
Get-Content -LiteralPath "legacy-policy.json" -Raw | node "scripts/export-human-verification-config.mjs"
```

- Node 内置模块即可；不导入插件代码，不读取任何环境变量/`.env`，不访问网络或数据库。
- 输入上限 64 KiB；文件必须为 `.json`，拒绝 `.env` 路径及解析后指向 `.env` 的符号链接；支持 UTF-8 BOM。
- `--out` 只新建文件，父目录须存在，已存在则失败，不覆盖文件。成功 stdout 为纯插件 config（使用 `--out` 时 stdout 留空）。错误只打印固定错误码，exit 1，不回显输入或敏感路径。
- 输出是**配置对象本身**，供后台配置编辑器填写，不包含 HTTP `{config: ...}` 包装，也不包含 secret、token、审批或生效指令。
- `rate_limit_unlock.enabled/publicReadMax/windowSec/exemptionMinutes/exemptionScope/loginRelaxed` 验证后不输出，保留核心原值。旧 `captchaStrength` 在核心只作 deprecated ignored 兼容元数据，今后算法强度仅通过插件设置。
- 四业务入口使用 slider；只有 `rateLimitUnlock` 使用联邦题型选择。显式 `federal.enabled=false` 选择 slider，不是故障回退。业务总开关/入口关闭不豁免 `rateLimitUnlock` proof；迁移总开关不得与读限流总开关混淆。

## 3. 按实际打包 CLI 签名

当前工具：`scripts/package-plugin-release.mjs`，参数为 `--source`、`--out`、`--key-id`，可选 `--key-file`、`--id`、`--version`。不指定 `--key-file` 时读取 CI 注入的 `PLUGIN_SIGNING_KEY`。没有 `--auto-trust` 或 `--activate`；打包不会审批、安装或启用。

**以下仅在已批准的受控 CI/signing 环境执行**，不是本地生成密钥步骤：

```powershell
# PLUGIN_SIGNING_KEY 由受保护且 masked 的 CI/deployment secret 注入；禁止 echo。
$manifest = Get-Content -LiteralPath "packages/backend/plugins/human-verification/manifest.json" -Raw | ConvertFrom-Json
node "scripts/package-plugin-release.mjs" --source "packages/backend/plugins/human-verification" --out "release-artifacts/human-verification" --key-id "$($manifest.signatureKeyId)" --id "$($manifest.id)" --version "$($manifest.version)"
```

也可由部署 secret store 安全挂载私钥文件，使用 `--key-file "<挂载的私钥文件路径>"` 替代环境变量；私钥必须在仓库及 source/artifact 目录之外，不写入命令参数值、日志、报告或插件包。只允许传文件路径，绝不能把 PEM 内容传入 argv。签名 job 仅授予可信发布分支及明确审核人，不授予 PR 或插件运行时代码。不要把服务端 runtime/control token 当作签名密钥。

打包使用 Ed25519，要求 manifest 的 `signatureKeyId`、id/version 与参数相符、`entrySha256` 与入口文件相符；不会代为更新 manifest。先按发布流程确认 UI/代码和 manifest 是已审核的最终版本。产物为 `<id>-<version>.tar.gz`、`.tar.gz.sig` 和 `.tar.gz.sha256`；输出必须在源码目录外且不得覆盖已有同版本产物。

签名成功不代表自动信任或审批成功。公钥指纹/trust key ID 要由运维独立核对并按批准流程部署，不能因为仓库“自带”或 manifest 声称某 key ID 就自动加入信任。随后使用平台后台的 SUPER_ADMIN + sudo 流程上传、批准精确版本与 digest、配置、激活并验健康。详见同目录 `README.md`，不要手工改 active symlink/approval 文件绕过后台。

## 4. 配置生效、故障恢复与退休数据

### 配置保存不等于生效

后台 `/admin/plugins` 保存配置只持久化候选配置。**对已运行 provider，保存后必须显式 reload**；新配置验证/启动失败时停止切换并检查健康与日志，不能宣称新配置已生效。未激活的 provider 则须显式 activate。记录当前版本、digest、generation 与审核后的非秘密配置摘要；reload/restart 导致 generation 变化，旧 challenge/proof 不应被继续接受。不要通过“先关闭保护”修复不可用。

### 恢复 Redis 快照前必须撤销旧 proof 世代

恢复历史 Redis 可能重新带回已消费记录。获授权的恢复步骤必须是：

1. 暂停受保护业务流量，冻结发题/验题/消费，保留回滚备份；不要在旧 epoch core 仍处理流量时恢复。
2. **在恢复 Redis 前 rotate `HUMAN_VERIFICATION_PROOF_EPOCH` 为新的、从未用过的非秘密值，并重启全部 core 实例**，确认所有节点采用同一新值，旧节点已退出。不能只 reload 插件，不能只重启一台 core。
3. 确认全部 core 已使用新 epoch 重启后，保持流量关闭再恢复 Redis；恢复期间如需再次重启，仍沿用同一新值。任何旧 epoch 进程都不得访问恢复后的库；不能完成全部节点切换时暂停恢复，而非豁免此门禁。
4. 确认 provider 健康、Redis 可写/原子消费可用、旧快照中的 challenge/proof 拒绝、全新验证链路通过，才恢复流量；不要把 epoch 改回旧值。

该撤销机制针对新中立 challenge/proof，不宣称任意全量安全状态回滚仍具一次性保证，也不代表撤销已有独立签名的读限流 unlock token。相关 token/豁免恢复风险应另按安全恢复流程审查。

### 数据与接口退役

`CaptchaChallenge` 旧表以及旧 captcha/federal SitePolicy 行保留用于审计/人工迁移；不自动 DROP、不清表，不把旧 verified challenge ID 或 redeem token 转为新 proof。`rate_limit_unlock` 非算法字段仍为核心有效策略。Stage B 后 `/api/v1/auth/captcha*` 和旧后台 `/admin/protection/captcha`、`/admin/protection/federal` API 退休，用户走新的中立桥与插件配置；业务参数 `captchaId` 暂作 opaque proof 兼容别名。

失败时停止放量，使用预先审阅且相互匹配的 Stage A 核心/前端镜像或已批准插件版本进行人工回滚；插件回滚也须 SUPER_ADMIN + sudo、精确 digest 与健康门禁。不为回滚自动降低信任、不重开旧 proof、不改数据库表。生产构建/发布/备份仍遵循项目既有 GHCR 与部署规则，本文不授权服务器临时构建或任何自动生产修改。

## 6. 定向本地验证入口

仓库根目录执行 `powershell -NoProfile -File scripts/smoke-human-verification.ps1`（PowerShell 7 也可直接执行脚本）。该脚本仅运行后端构建、签名插件子进程/HTTP/中立凭证冒烟、四业务门禁和前端类型/契约检查，日志写入独立 reports 目录；不执行数据库迁移或生产操作，不把 fixture 存储当作真实 Redis 持久化验证。完整浏览器交互另用前端 humanVerification.browser.smoke.mjs，仍与真实生产链路验收分开。
