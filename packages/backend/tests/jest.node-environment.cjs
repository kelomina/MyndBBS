/*
 * Backend Jest node environment.
 * 后端 Jest node 测试环境。
 *
 * Callers: [packages/backend/jest.config.js]
 * Callees: [Object.getOwnPropertyDescriptor, Object.defineProperty, require]
 * Description: Shadows Node 22's lazy `globalThis.localStorage` getter before
 * Jest snapshots node globals, preventing Jest teardown from triggering the
 * "`--localstorage-file` was provided without a valid path" warning in backend
 * tests that do not use browser storage.
 * 描述：在 Jest 快照 node 全局对象之前遮蔽 Node 22 的延迟
 * `globalThis.localStorage` getter，避免不使用浏览器存储的后端测试在 teardown
 * 阶段触发 “`--localstorage-file` was provided without a valid path” 警告。
 * Variables: `nodeLocalStorageDescriptor` stores the original global property
 * metadata; `JestNodeEnvironment` is Jest's standard node environment.
 * 变量：`nodeLocalStorageDescriptor` 保存原始全局属性元数据；
 * `JestNodeEnvironment` 是 Jest 标准 node 环境。
 * Integration: Configure this module as `testEnvironment` for backend Jest
 * tests.
 * 接入方式：在后端 Jest 配置中将本模块设置为 `testEnvironment`。
 * Error Handling: The shadow is only installed when the descriptor is a
 * configurable getter; other Node versions keep their native behavior.
 * 错误处理：仅当描述符是可配置 getter 时才安装遮蔽属性；其他 Node 版本保留原生行为。
 * Keywords: jest environment, node localStorage, webstorage warning, teardown,
 * test isolation, Jest环境, Node本地存储, WebStorage警告, 测试清理, 测试隔离
 */
const nodeLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

if (
  nodeLocalStorageDescriptor?.configurable === true &&
  nodeLocalStorageDescriptor.get !== undefined
) {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    enumerable: nodeLocalStorageDescriptor.enumerable,
    value: undefined,
    writable: false,
  });
}

const JestNodeEnvironment = require('jest-environment-node').TestEnvironment;

module.exports = JestNodeEnvironment;
