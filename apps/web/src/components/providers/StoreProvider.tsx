'use client'

import { useEffect } from 'react'
import { initStores } from '@/stores'

export function StoreProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initStores()
  }, [])

  return <>{children}</>
}
