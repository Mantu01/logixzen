let sqlJsPromise: Promise<import('sql.js').SqlJsStatic> | null = null

export async function loadSqlWasm(): Promise<import('sql.js').SqlJsStatic> {
  if (sqlJsPromise !== null) return sqlJsPromise

  sqlJsPromise = (async (): Promise<import('sql.js').SqlJsStatic> => {
    const initSqlJsModule = await import('sql.js')
    const SQL = await initSqlJsModule.default

    await SQL()

    return SQL as unknown as import('sql.js').SqlJsStatic
  })()

  return sqlJsPromise
}
