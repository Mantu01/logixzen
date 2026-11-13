import { translateError } from './ErrorTranslator'

describe('translateError', () => {
  test('should translate no such table error with suggestion', () => {
    const msg = translateError('no such table: users')
    expect(msg).toContain('Table not found')
    expect(msg).toContain('users')
  })

  test('should translate no such column error with suggestion', () => {
    const msg = translateError('no such column: age')
    expect(msg).toContain('Column not found')
    expect(msg).toContain('age')
  })

  test('should translate ambiguous column name', () => {
    const msg = translateError('ambiguous column name: id')
    expect(msg).toBe('Multiple tables have this column. Use "table.column" syntax.')
  })

  test('should translate constraint failed', () => {
    const msg = translateError('constraint failed')
    expect(msg).toBe('Data violates a rule (e.g., duplicate primary key).')
  })

  test('should translate syntax error with token', () => {
    const msg = translateError('near "FRO": syntax error')
    expect(msg).toBe('Syntax error near the highlighted token.')
  })

  test('should return original message for unknown errors', () => {
    const msg = translateError('some unknown database error')
    expect(msg).toBe('some unknown database error')
  })

  test('should handle case insensitive patterns', () => {
    const msg = translateError('NO SUCH TABLE: MyTable')
    expect(msg).toContain('MyTable')
  })
})
