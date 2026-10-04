# MyndBBS v2 插件签名与交付（不等于已部署）

插件开发协议、配置/事件与 iframe 通道见 [AUTHORING.md](AUTHORING.md)。本地定向验收入口为 `E:/Project/HTML/MyndBBS/scripts/smoke-plugin-platform.ps1`。

冻结契约：`.agents/contracts/plugin-platform-v2/`。本流程只有一个控制面：

```text
受保护 CI / 离线签名器 → tar.gz + tar.gz.sig + tar.gz.sha256
  → 后台上传（隔离区 / 校验）→ SUPER_ADMIN + sudo 审批精确 version/digest
  → SUPER_ADMIN + sudo 激活 → supervisor 建候选容器、健康检查、切换
```

`ADMIN` 只读。有效签名不等于审批。重传、回滚、reload 都不得跳过后台授权。
**Hot Release 的 plugin 模式无 deploy job，无 SSH、Docker 激活或旧健康检查路径**；
即使输入 `deploy=true`，也只发布 artifact。frontend/core 模式不因本变更调整发布流程。
`scripts/install-plugin-release.sh` 是故意返回 **64** 的拒绝入口，不得用于自动重试或绕过审批。

## 1. 密钥边界

| 配置 | 谁持有 | 规则 |
| --- | --- | --- |
| `PLUGIN_SIGNING_KEY` | 受保护 `plugin-signing` CI environment 或离线签名器 | Ed25519 PKCS#8 PEM 私钥；不写镜像、应用 .env、日志或仓库 |
| `PLUGIN_SIGNING_KEY_ID` | CI environment 的公开 variable | 与 `manifest.signatureKeyId`、信任文件键名完全一致 |
| `plugin-trust-keys.json` | supervisor 只读挂载；worker 只读公钥 | `{"keys":{"key-id":"-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n"}}`，必须是 Ed25519 SPKI 公钥 |
| `PLUGIN_CONTROL_TOKEN` | backend + supervisor | 独立随机值，至少 32 字符；runtime 永不获得 |
| `PLUGIN_RUNTIME_SECRET` | **仅 supervisor** 的专用 env file | 独立随机值，至少 32 字符；HMAC 派生每插件 event/proxy token，绝不共享管理员 reload 凭证 |
| `PLUGIN_CONFIG_ENCRYPTION_KEY` | backend | 独立 32 字节 base64 或 64 位 hex；备份数据库时保管对应密钥 |

`packages/backend/.env.example` 保留原变量并追加插件变量；仓库没有根 `.env.example`。
`PLUGIN_CONTROL_ENV_FILE` 默认为 `/opt/myndbbs/secrets/plugin-control.env`，只存
`PLUGIN_RUNTIME_SECRET=<独立随机值>`。**该文件不是 backend 所挂载的 `/opt/myndbbs/.env`**。
不要把 runtime master secret 放入 backend 的 `.env`（即使没有显式 environment 映射，文件挂载也会泄漏）。
不要把该文件设为全项目 `env_file`，不要把它挂到 worker。生产文件仅宿主管理员可读（目录 0700、文件 0600）。

GitHub environment `plugin-signing` 应限制可信发布分支并配置 required reviewers。
签名 secret 只授予签名 job，不授予 Docker Publish、部署 job、PR 或插件自身构建脚本。
CLI 只读取静态打包目录，**不会执行插件入口或 npm lifecycle**；依赖须在无签名私钥的构建步骤先编译/打包为自包含文件。
私钥不允许作为 CLI 参数值；本地仅传 `--key-file` 路径，CI 通过 masked secret 环境变量传递。
不要 `set -x`、输出环境变量、`docker inspect` 全量 Env 或 `docker compose config` 的已展开密钥。

公钥加入信任文件是独立的运维信任变更，必须经人工审核。CLI 自验只证明包与当前私钥一致，
**不证明该 key ID 已获生产信任**。不能自动把每次产出的公钥加入线上 trust store。
轮换时先审核加入新公钥/ID、切换签名器；保留回滚版本需要的旧公钥。吊销时先停用受影响插件，
再处理信任项和所有受影响版本；仅删公钥不保证已经运行的进程自动停止。加密密钥轮换需另行迁移已存配置，不能直接换值。

## 2. 精确签名协议与可复现包

使用 `scripts/plugin-v2.mjs` 的 `validateManifest`、`canonicalize`、
`signingPayload(archiveSha256, manifest)` 和严格 Ed25519 `verifySignature`，并用
`plugin-archive.mjs.verifyArchive` 在写产物前做同源验收。签名明文是 **UTF-8**：

```text
MYNDBBS_PLUGIN_V2\n<archive 的小写 64 位 SHA-256>\n<递归按 key 排序的紧凑 JSON>\n
```

这里 `\n` 表示单字节 LF，不是反斜杠加 n。数组保留顺序，保留末尾 LF，无 BOM。
签名覆盖最终 gzip 的 SHA-256 和 manifest，不是只签 entry 或原始 manifest 文本。
`.sig` 是 **64 字节 binary**，不是 hex/base64/PEM；`.sha256` 是
`<digest><两个空格><tar.gz 文件名><LF>`。`signatureKeyId` 本身也在签名中。

包内根目录包含 `manifest.json`、manifest 声明的 entry 以及需要的静态模块/UI。
CLI 固定 USTAR（只含 regular files、0644、uid/gid/mtime=0、路径排序、两个结束块）和 gzip OS=255，
不包含宿主时间与用户信息；同一 Node/zlib 版本下相同文件产生相同 bytes/signature。
为避免跨版本压缩器差异，重现发布包应固定 CI Node 版本与运行环境。
拒绝软/硬链接、特殊文件、大小写冲突路径、相对穿越、保留元数据、`.env*`、私钥后缀和 `node_modules`；
路径最多 100 字节，最多 4096 个遍历条目，解包总 tar ≤64 MiB，压缩包 ≤20 MiB。
CLI 不替你修改 `entrySha256`、`signatureKeyId` 或版本，错误就失败；输出存在时也拒绝覆盖。
空目录不会打包，插件应自包含，不得依赖包内空可写目录。

归档兼容性：当前 archive parser 仅接受受限 **USTAR regular files / directories**，
拒绝 PAX（包括扩展头/global header）与 GNU longlink/longname、链接和特殊文件。
本 CLI 自行生成 regular-file USTAR，不调用系统 `tar`，因此不依赖 GNU tar/bsdtar 的默认格式。
**不要用默认 `tar -czf` 替代 CLI 打包步骤**；第三方制包器必须显式采用受限 USTAR 并通过同源 archive verifier，
遇到超长路径应重命名或调整产物目录，不得用 PAX/GNU 扩展绕过。重新打包会改变 archive digest，必须重新签名。

## 3. Windows PowerShell 离线示例（不需要 Docker）

`ops/plugins/example/manifest.json` 与 `entry.mjs` 是可打包 fixture；入口值为 `42`，无数据库或 UI。
示例 key ID 仅用于本地，不包含预置信任或私钥。`.gitattributes` 固定 fixture LF，避免 CRLF 改变 entry hash。
下面生成的是一次性测试密钥，保存在临时目录，**不打印密钥**；正式密钥由组织密钥保管流程供应。

```powershell
Set-Location E:/Project/HTML/MyndBBS
$env:PLUGIN_EXAMPLE_OUT = Join-Path $env:TEMP ('myndbbs-example-' + [guid]::NewGuid())
node --input-type=module -e "import{generateKeyPairSync}from'node:crypto';import{mkdirSync,writeFileSync}from'node:fs';import path from'node:path';const d=process.env.PLUGIN_EXAMPLE_OUT;mkdirSync(d,{recursive:true});const k=generateKeyPairSync('ed25519');writeFileSync(path.join(d,'signing.pem'),k.privateKey.export({type:'pkcs8',format:'pem'}),{mode:0o600,flag:'wx'});writeFileSync(path.join(d,'trust.json'),JSON.stringify({keys:{'local-example-2026':k.publicKey.export({type:'spki',format:'pem'})}}),{flag:'wx'});"
if ($LASTEXITCODE -ne 0) { throw 'example key generation failed' }
node scripts/package-plugin-release.mjs --source ops/plugins/example --out "$env:PLUGIN_EXAMPLE_OUT/artifacts" --key-file "$env:PLUGIN_EXAMPLE_OUT/signing.pem" --key-id local-example-2026 --id example-counter --version 1.0.0
if ($LASTEXITCODE -ne 0) { throw 'package failed' }
Get-ChildItem "$env:PLUGIN_EXAMPLE_OUT/artifacts" | Select-Object Name,Length
node ops/plugins/smoke-package.mjs
if ($LASTEXITCODE -ne 0) { throw 'offline smoke failed' }
```

Windows 上 POSIX mode 不能代替 ACL；密钥目录应使用只允许当前账户访问的 ACL，结束后按组织策略删除测试私钥。
smoke 测试的 Ed25519/RSA/Ed448 私钥只在内存，临时目录只留静态测试源码/公钥可验证产物，不写私钥。
例包路径为 `example-counter-1.0.0.tar.gz`、`.tar.gz.sig`、`.tar.gz.sha256`。
实际发布源码放 `packages/backend/plugins/<plugin_id>`，更新 manifest 对应 key ID 和 entry hash；
Hot Release 输入 `release_type=plugin`、`plugin_id`，可选 `plugin_version` 用于一致性检查。
从 artifact 下载 **三个原始文件**，不要把 GitHub 外层 zip 或文本编码后的签名上传为插件。
后台当前若用 SHA-256 输入框而非 sidecar 文件选择器，将 `.sha256` 首列填入该框，并保留 sidecar 审计证据。

### 上传代理体积门禁（仅文档/模板，未修改生产）

上传链路是浏览器 **multipart/form-data → OpenResty → Next.js BFF
`/api/admin/plugins/releases` → backend → supervisor**。artifact `.tar.gz` 上限为
**20 MiB = 20,971,520 字节**；这是 archive 文件的上限，不是整个 multipart 请求的上限。
请求体还包含 binary signature、字段、boundary 与 part headers，因此代理 `client_max_body_size`
必须 **严格大于 20 MiB**，推荐该上传 location 配置 **`24m`**（25,165,824 字节）。
不能将代理设为 `20m` 并声称能接受恰好 20 MiB 的文件。

按项目提供的生产基线，本站 server 默认 **`12m`**，未单独放宽插件上传路径时，
合法的大包会先被 OpenResty 拒绝，尚未进入 BFF/应用校验；不能把这个结果诊断为签名验证失败。
代理拒绝典型为 **413 / text/html**，须与 BFF/应用 JSON 错误区分。
已有 `/api/submissions/` 的 `24m` 仅覆盖期刊投稿，不覆盖 `/api/admin/plugins/releases`。
本轮没有读取服务器实况，生产 `12m` 取自项目基线而非本次线上验证。

参考片段：`ops/plugins/openresty-plugin-upload.conf.example`。必须审阅实际 vhost 与 location 优先级，
将配置落在匹配 **BFF 上传 URL** 的 location 中，仍反代 **3100 前端**，不改为直连 3001 后端。
模板仅是仓库参考，**修改模板不会改变线上**；不得整份替换 vhost 或误覆盖现有安全头、日志、超时等策略。

**Gate：未批准生产部署，禁止修改/reload 线上配置。** 未来另获批准后，先备份真实 vhost、记录 `.env`
哈希和数据卷不受影响，再做最小 location 修改，在实际 1Panel OpenResty 容器内 `-t` 通过后才允许 reload。
之后须从外部验证核心健康/关键路径，以及带登录态的 20 MiB 上传能到达应用、超限包被应用拒绝；
是否成功入隔离区还取决于合法 USTAR、可信签名和 manifest，上传成功也不等于审批/激活。
失败时恢复备份 vhost、语法检查后 reload；不得触及 `.env` 或数据卷。
本轮不执行上述操作，亦不声称完成代理边界或生产健康验收。

## 4. 拓扑、路径和 opt-in

```text
backend ── default 应用网络 ── supervisor (唯一 docker.sock 持有者)
                                 │
                      internal plugin-runtime 网络
                                 │
                    candidate / active plugin workers
```

- backend 不接 plugin-runtime，无 Docker socket；仅只读挂载 plugin release root 供 manifest 读取。
- PostgreSQL、Redis、Meilisearch、frontend 只留在应用网络；worker 不得加入该网络、host 网络、发布端口或额外挂载宿主文件。
- supervisor 接应用网 + internal runtime 网，以带控制 token 的 `/v1/plugins/:id/proxy` 转发业务请求。
  runtime 看得到双网 supervisor 的 runtime IP，**隔离网不能代替控制 API 身份验证**；
  所有 `/v1` 控制调用必须严格认证 ≥32 字符 control token，绝不能接受 per-plugin token 或匿名请求。
  两个网的桥接/转发权限也不能授予 runtime；动态容器的 cap-drop、no-new-privileges/read-only/resource limit 由 supervisor 落实。
- worker 只获得自身派生的 event/proxy token，不得获得 runtime master、全局 control token 或 admin reload token。
  同网插件能看到相互 IP，因此每插件 token 必须校验并区分用途，不依赖 DNS/网络隐藏作为授权。
- `PLUGIN_ROOT=/opt/myndbbs/plugins` 是 **supervisor 内部路径**；`PLUGIN_DOCKER_ROOT=${PLUGIN_HOST_DIR}` 是 **daemon 宿主绝对路径**。
  backend、supervisor 必须使用同一个 `PLUGIN_HOST_DIR`，不能一个用 `./plugins`、另一个用 `/opt/myndbbs/plugins`。
  公钥也同理：`PLUGIN_DOCKER_TRUST_KEYS_FILE=${PLUGIN_TRUST_KEYS_HOST_FILE}` 单独指明 worker 公钥 bind 的 daemon 路径。
  本地 Docker 客户端的 Windows 路径不等于远端 Linux daemon 的 bind 路径。
- supervisor 没有宿主 published port；远程控制只能经后台。trust bind 使用 `create_host_path: false`，不能把缺失公钥文件自动创建为目录。
- 默认不启动 `profiles: [plugins]` 的 supervisor；endpoint/token/encryption key 默认空，未启用平台的安装不因缺插件 secret 而失败。
  显式开启 profile 后，缺 supervisor env file 或 token 应失败关闭，不生成默认凭证。
- `docker-compose.rolling.example.yml` **复用 base project 的唯一 supervisor**，不会启动第二个控制进程争用同一状态目录。
  蓝绿 backend 只接已有 `myndbbs_default`；core CI 仍部署原两个颜色服务，不自动启用插件。
- `PLUGIN_INFRA_IMAGE_TAG` 同时固定 supervisor/runtime 的兼容版本；正式启用建议使用 CI 的不可变 `sha-<commit>` 标签，
  不依赖可漂移的 latest。Docker Publish 只构建基础设施镜像，不包含私钥或激活 artifact。

## 5. 启用前与回滚清单（本轮未执行）

**任何生产变更都要另获批准。** 启用前完整备份数据库 dump、镜像 ID、Compose、插件 release/state/approval、uploads 等数据卷；
受控保管 `.env` 与配置加密密钥，记录 `.env` 哈希与数据卷清单，确认不覆盖/重置原数据。
先准备 host plugin 目录、经审核的 trust file、独立 supervisor secret file，再设 backend control token/URL 和 encryption key。
`ensure-hot-update-base.sh <root> <新的override路径>` 只生成 override，不写 `.env`、trust、allowlist、release/state，
不覆盖既有文件、不运行 Docker。只适用于 base Compose，必须先人工审阅生成 diff；不再由 CI 自动调用。
其输出同时依赖 base Compose 提供镜像/默认 opt-in 规则。不要把生成文件误认为已安装或已启动。

启用 `plugins` profile 前，在有 Docker 的隔离环境验证配置与网络；本 Windows 工作区无 Docker，不能把静态检查写成网络验收。
签名信任、生效 migrations、SUPER_ADMIN sudo、后台上传/审批/激活/回滚均需有状态环境专项验收。
未来部署后必须验证：核心 `/api/health`、关键业务回归、公网外部可达性、插件 `/healthz`、鉴权代理响应、
未授权控制请求失败、runtime 到 DB/Redis 不可达、容器没有控制/master token；将不含凭证的命令/输出摘要记入 HANDOVER。
服务器 hairpin 失败不代表公网失败，公网检查从外部运行。

**插件回滚**：通过后台选已验证、已审批的精确版本和 digest，由 SUPER_ADMIN + sudo 发起 supervisor rollback，
确认 entry/config 相容、health 成功再切换；失败应保留旧活跃版本。不要手改 symlink/state 或运行旧安装脚本。
**基础设施回滚**：用备份的镜像 ID/不可变标签与 Compose 配置恢复 supervisor/runtime（不恢复被覆盖的 latest 推断版本）；
冻结新激活请求并逐个确认当前 worker，保证 master secret/控制协议相容。仅在数据迁移确需恢复且另经批准时恢复 DB，
不能用旧 dump 盲盖上线后的业务数据。保留 `.env`、trust、插件目录和数据卷，禁止 `down -v`。
