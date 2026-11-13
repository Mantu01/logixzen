import { QuestionDetailContent } from '@/features/learn/QuestionDetailContent'

export default async function QuestionPage({
  params,
}: {
  params: Promise<{ topicId: string; questionId: string }>
}) {
  const { topicId, questionId } = await params
  return <QuestionDetailContent topicId={topicId} questionId={questionId} />
}
