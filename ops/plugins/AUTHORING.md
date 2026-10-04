# 编写 v2 插件

本协议与部署签名指南 README.md 配套。插件代码只在独立容器运行，不获得数据库、Redis、Docker socket、核心 Cookie、session id 或原始 Authorization。插件是经审核的扩展，并非核心进程模块。

## 1. 最小运行时契约

入口默认导出一个对象：

~~~js
export default {
  async activate(context) {
    this.config = context.getConfig() // 解密后的本插件配置快照；不要日志打印 secret
    context.registerHealthCheck(async () => {
      // 快速 readiness 检查；失败就 throw，新版本不会被切换为 ACTIVE
    })
  },
  async handle(request) {
    // request = { method, path, headers, body }; 仅收到脱敏身份头，不含浏览器凭据
    return { status: 200, body: { count: this.config.count ?? 42 } }
  },
  async handleEvent(envelope) {
    // 在插件自己的持久存储/事务中按 eventId 或 idempotencyKey 去重，再执行副作用。
    // 处理成功才返回；失败 throw 会触发重试。不得假设 exactly-once。
  },
  async deactivate() {},
}
~~~

声明 routes 必须实现 handle，声明 events 必须实现 handleEvent。UI 文件由 host 静态服务，无需把 UI 路径再声明为业务 route。宿主提供只读快照 context.config 与返回副本的 context.getConfig()；后台保存配置不会向运行中的插件推送，需经 sudo 重载/重新激活生效。

业务返回只作为 application/json 发送；插件不能设置核心域 Cookie、重定向或 HTML 响应头。v2 不开放核心服务对象、任意核心 API、数据库迁移或进程内动态加载。

## 2. Manifest 示例

~~~json
{
  "id": "example-counter",
  "displayName": "示例计数器",
  "description": "只读后台统计示例",
  "version": "1.0.0",
  "apiVersion": 2,
  "entry": "entry.mjs",
  "entrySha256": "替换为入口文件的小写64位SHA256",
  "signatureKeyId": "release-key-1",
  "capabilities": {
    "routes": [{ "path": "/stats", "methods": ["GET"], "auth": "admin" }],
    "events": [{ "name": "PostApprovedEvent", "version": 1 }],
    "ui": [{ "slot": "admin.detail", "path": "ui/detail.html" }],
    "config": {
      "schema": {
        "type": "object",
        "properties": {
          "count": { "type": "integer", "minimum": 0, "maximum": 1000 },
          "apiKey": { "type": "string", "maxLength": 512 }
        },
        "additionalProperties": false
      },
      "secretPaths": ["/apiKey"]
    }
  }
}
~~~

- 仅 apiVersion 2；id 是小写 slug；版本是 semver；入口/包内文件为安全相对路径。
- 业务路由支持精确路径和末尾 /*；不支持参数表达式。/__ 前缀为宿主保留。
- auth 是 authenticated（默认）、admin 或 super_admin。无匿名能力。
- 可声明事件名称以 PluginEventCatalog.ts 的核心注册项为准，DTO 只含显式允许的标识和少量元数据。PostApprovedEvent v1 包含 postId、authorId，不含文章正文/标题、邮箱、审核原因等原始对象。
- 配置 schema 只接受 type/properties/required/additionalProperties/items/enum、数字范围、字符串/数组长度、title/description/default；禁止 $ref、组合规则、正则 pattern 和可执行行为。default 不会自动写入配置。
- secretPaths 使用 JSON Pointer，首版仅允许明确声明的字符串属性；不支持数组 secret 或重叠路径。
- 读取 secret 返回掩码；更新时省略（或原样掩码）保留，null 删除。若目标 schema 要求该字段必填，删除会因 schema 校验失败而拒绝。
- 包内 UI 必须是自包含 .html（不大于 256 KiB）。内联 JS/CSS 可用，外链脚本、请求、表单、子 frame 等被 CSP 禁止。将资源预先打包为内联内容或 data 图片。

## 3. 后台 iframe 通道

slot 只有 admin.sidebar、admin.dashboard、admin.detail。核心先认证读取 /api/plugins/:id/__ui/<manifest-path>，再用 srcDoc + sandbox=allow-scripts 载入；没有 allow-same-origin，也不共享 Cookie。

插件 UI 使用以下握手，只能请求自身 manifest 中明确列出的**精确 GET 路径**，首版不开放写入、跨插件、查询参数或任意核心 API：

~~~html
<p id="result">等待连接</p>
<script>
window.addEventListener('message', function initialize(event) {
  if (event.source !== parent || event.data?.type !== 'myndbbs:plugin:init' || !event.ports[0]) return
  window.removeEventListener('message', initialize)
  const { nonce } = event.data
  const port = event.ports[0]
  port.onmessage = ({ data }) => {
    if (data?.type !== 'myndbbs:plugin:response' || data.nonce !== nonce || data.id !== 'initial-stats') return
    document.getElementById('result').textContent = data.error || JSON.stringify(data.data)
  }
  port.start()
  port.postMessage({ type: 'myndbbs:plugin:request', nonce, id: 'initial-stats', method: 'GET', path: '/stats' })
})
</script>
~~~

通道有并发、次数、响应大小限制，卸载会关闭两个端口。不要依赖核心 DOM、localStorage、Cookie、自动跳转或不经通道的网络访问。插件自身负责内容国际化；核心后台支持中英文。

## 4. 事件与可靠性边界

信封为 eventId、eventName、schemaVersion、occurredAt、idempotencyKey、payload。核心独立 Redis Streams consumer group 只在 delivery 持久化后 ACK；DB outbox 提供重试、lease 回收、失败/死信计数。普通重试指数退避 2 至 300 秒，第 10 次失败进入死信。

这是至少一次投递：宿主仅对同进程内重复事件做有界去重优化；重启、超时、ACK 丢失可导致重复。插件应把去重记录和副作用在自己的持久存储中原子提交。当前容器文件系统只读且未提供持久可写卷；若插件需要可持久副作用存储/外部服务，必须另行设计审核的能力，不得自行突破网络或宿主权限。

首次后台上传进入 quarantine，签名有效也不能运行。审批与激活都要求 SUPER_ADMIN + sudo。CI 只发布签名产物，不自动部署；参见 README.md。
