import { fork } from 'node:child_process'
import { access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const host = fileURLToPath(new URL('./plugin-host.mjs', import.meta.url))
export class PluginSupervisor {
  #children = new Map()
  async reload(manifestPath, port) {
    await access(manifestPath)
    const child = fork(host, [path.resolve(manifestPath), String(port)], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] })
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('ERR_PLUGIN_START_TIMEOUT')), 10000)
      child.once('message', (message) => { if (message?.type === 'ready') { clearTimeout(timer); resolve() } })
      child.once('error', reject)
      child.once('exit', (code) => { if (code !== 0) reject(new Error('ERR_PLUGIN_START_FAILED')) })
    }).catch(async (error) => { child.kill('SIGKILL'); throw error })
    const previous = this.#children.get(manifestPath)
    this.#children.set(manifestPath, child)
    if (previous && previous.connected) previous.kill('SIGTERM')
    return child.pid
  }
  async stop(manifestPath) {
    const child = this.#children.get(manifestPath)
    if (!child) return
    child.kill('SIGTERM'); this.#children.delete(manifestPath)
  }
}
