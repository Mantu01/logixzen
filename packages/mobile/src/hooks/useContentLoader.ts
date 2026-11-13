import { useState, useCallback } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Text } from 'react-native-paper'
import { loadAllDatasets, loadTopics } from '@logixzen/shared/content'
import type { Dataset, Topic } from '@logixzen/shared/content'

interface ContentState {
  datasets: Dataset[]
  topics: Topic[]
  isLoading: boolean
  error: string | null
  loaded: boolean
  load: () => Promise<void>
}

let _state: ContentState | null = null

async function initializeContent(): Promise<ContentState> {
  if (_state !== null) return _state

  const datasets = await loadAllDatasets()
  const topics = await loadTopics()

  _state = {
    datasets,
    topics,
    isLoading: false,
    error: null,
    loaded: datasets.length > 0 && topics.length > 0,
    load: async () => {},
  }
  return _state
}

export function useContentLoader() {
  const [state, setState] = useState<ContentState>({
    datasets: [],
    topics: [],
    isLoading: true,
    error: null,
    loaded: false,
    load: async () => {},
  })

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    try {
      const result = await initializeContent()
      setState(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setState((prev) => ({ ...prev, isLoading: false, error: message, loaded: false }))
    }
  }, [])

  return { ...state, load }
}

export { initializeContent }
