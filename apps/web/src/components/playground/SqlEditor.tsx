import { SqlEditor } from '@/components/editor/SqlEditor'
import type { SqlEditorProps } from '@/components/editor/SqlEditor'

export { SqlEditor }
export type { SqlEditorProps }

export function PlaygroundSqlEditor(props: SqlEditorProps): React.ReactElement {
  return <SqlEditor {...props} />
}
