'use client'

import { useEffect } from 'react'

/** 生产环境注册 /sw.js（仅满足 PWA 可安装判定，无离线缓存逻辑） */
export function SWRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/api/pwa/sw').catch((err) => {
      console.error('[SWRegister] failed:', err)
    })
  }, [])

  return null
}
