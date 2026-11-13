import { DialectNotesContent } from '@/features/dialect-notes/DialectNotesContent'

export default async function DialectNotesPage({
  searchParams,
}: {
  searchParams: Promise<{ note?: string }>
}) {
  const { note } = await searchParams
  return <DialectNotesContent noteId={note} />
}
