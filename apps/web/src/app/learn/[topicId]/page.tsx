import { QuestionListContent } from '@/features/learn/QuestionListContent'

export default async function LearnTopicPage({
  params,
}: {
  params: Promise<{ topicId: string }>
}) {
  const { topicId } = await params
  return <QuestionListContent topicId={topicId} />
}
