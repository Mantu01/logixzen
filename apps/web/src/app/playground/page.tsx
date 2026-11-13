'use client'

import { useState } from 'react'
import PlaygroundLayout from '@/components/playground/PlaygroundLayout'
import { useSqlStore } from '@/sql/useSqlStore'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

export default function PlaygroundPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [initialSql, setInitialSql] = useState('')
  const initialize = useSqlStore((s) => s.initialize)
  const isInitialized = useSqlStore((s) => s.isInitialized)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const sqlParam = searchParams.get('sql')
    if (sqlParam) {
      setInitialSql(decodeURIComponent(sqlParam))
    }
  }, [searchParams])

  const handleInit = async () => {
    setLoading(true)
    setError(null)
    try {
      await initialize(initialSql || undefined)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-shell">
      <PlaygroundLayout
        initialSql={initialSql}
        onInit={handleInit}
        isLoading={loading}
        error={error}
        isInitialized={isInitialized}
      />
    </div>
  )
}
