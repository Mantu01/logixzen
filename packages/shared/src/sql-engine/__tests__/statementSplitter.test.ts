import { splitStatements } from '../statementSplitter'

describe('splitStatements', () => {
  test('should split single statement', () => {
    const result = splitStatements('SELECT * FROM users;')
    expect(result).toHaveLength(1)
    expect(result[0].sql).toBe('SELECT * FROM users')
    expect(result[0].index).toBe(0)
  })

  test('should split multiple statements', () => {
    const sql = 'SELECT * FROM a; INSERT INTO b VALUES (1);'
    const result = splitStatements(sql)
    expect(result).toHaveLength(2)
    expect(result[0].sql).toBe('SELECT * FROM a')
    expect(result[1].sql).toBe('INSERT INTO b VALUES (1)')
  })

  test('should handle semicolon inside single quotes', () => {
    const sql = "SELECT * FROM t WHERE name='a;b';"
    const result = splitStatements(sql)
    expect(result).toHaveLength(1)
    expect(result[0].sql).toBe("SELECT * FROM t WHERE name='a;b'")
  })

  test('should handle semicolon inside double quotes', () => {
    const sql = 'SELECT * FROM t WHERE name="a;b";'
    const result = splitStatements(sql)
    expect(result).toHaveLength(1)
    expect(result[0].sql).toBe('SELECT * FROM t WHERE name="a;b"')
  })

  test('should skip line comments', () => {
    const sql = 'SELECT * FROM users; -- comment\nINSERT INTO logs VALUES (1);'
    const result = splitStatements(sql)
    expect(result).toHaveLength(2)
  })

  test('should skip block comments', () => {
    const sql = 'SELECT /* comment */ * FROM users;'
    const result = splitStatements(sql)
    expect(result).toHaveLength(1)
    expect(result[0].sql).toBe('SELECT /* comment */ * FROM users')
  })

  test('should not split inside transaction', () => {
    const sql = 'BEGIN; INSERT INTO t VALUES (1); COMMIT;'
    const result = splitStatements(sql)
    expect(result).toHaveLength(1)
    expect(result[0].sql).toBe('BEGIN; INSERT INTO t VALUES (1); COMMIT')
  })

  test('should handle escaped single quotes', () => {
    const sql = "SELECT * FROM t WHERE name='a''b';"
    const result = splitStatements(sql)
    expect(result).toHaveLength(1)
    expect(result[0].sql).toBe("SELECT * FROM t WHERE name='a''b'")
  })

  test('should ignore empty statements', () => {
    const sql = 'SELECT * FROM a;;INSERT INTO b VALUES (1);'
    const result = splitStatements(sql)
    expect(result).toHaveLength(2)
  })

  test('should preserve statement order and indices', () => {
    const sql = 'SELECT 1; SELECT 2; SELECT 3;'
    const result = splitStatements(sql)
    expect(result[0].index).toBe(0)
    expect(result[1].index).toBe(1)
    expect(result[2].index).toBe(2)
  })

  test('should handle dollar-quoted strings in PostgreSQL', () => {
    const sql = 'CREATE FUNCTION f() RETURNS int AS $$ BEGIN RETURN 1; END; $$ LANGUAGE plpgsql; SELECT f();'
    const result = splitStatements(sql)
    expect(result).toHaveLength(2)
  })

  test('should handle backtick and bracket identifiers with semicolons', () => {
    const sql = 'SELECT `col;a` FROM [tbl;1]; SELECT 2;'
    const result = splitStatements(sql)
    expect(result).toHaveLength(2)
  })

  test('should keep trigger BEGIN END blocks as one statement', () => {
    const sql = 'CREATE TRIGGER t AFTER INSERT ON a BEGIN INSERT INTO b VALUES (1); UPDATE a SET x = 1; END; SELECT 1;'
    const result = splitStatements(sql)
    expect(result).toHaveLength(2)
  })
})
