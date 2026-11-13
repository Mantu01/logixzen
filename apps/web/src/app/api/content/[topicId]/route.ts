import { NextResponse } from 'next/server'
import { loadQuestions } from '@logixzen/shared/content/loaders'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ topicId: string }> }
): Promise<NextResponse> {
  const { topicId } = await params

  try {
    const questions = loadQuestions(topicId)
    return NextResponse.json(questions)
  } catch (error: unknown) {
    const message: string = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Failed to load questions', details: message, topicId },
      { status: 500 }
    )
  }
}
