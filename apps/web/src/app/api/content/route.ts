import { NextResponse } from 'next/server'
import { loadDatasets, loadTopics } from '@logixzen/shared/content/loaders'

export async function GET(): Promise<NextResponse> {
  try {
    const datasets = loadDatasets()
    const topics = loadTopics()
    return NextResponse.json({ datasets, topics })
  } catch (error: unknown) {
    const message: string = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Failed to load content', details: message },
      { status: 500 }
    )
  }
}
