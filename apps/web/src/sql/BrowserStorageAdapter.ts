export interface BrowserStorageItem<T> {
  value: T
  expiresAt: number | null
}

export class BrowserStorageAdapter {
  private readonly prefix: string

  constructor(prefix = 'logixzen_') {
    this.prefix = prefix
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const itemStr = localStorage.getItem(`${this.prefix}${key}`)
      if (itemStr === null) return null
      const item: BrowserStorageItem<T> = JSON.parse(itemStr)
      if (item.expiresAt !== null && Date.now() > item.expiresAt) {
        await this.remove(key)
        return null
      }
      return item.value
    } catch {
      return null
    }
  }

  async set<T>(key: string, value: T, expiresInSeconds?: number): Promise<void> {
    const item: BrowserStorageItem<T> = {
      value,
      expiresAt: expiresInSeconds !== undefined ? Date.now() + expiresInSeconds * 1000 : null,
    }
    localStorage.setItem(`${this.prefix}${key}`, JSON.stringify(item))
  }

  async remove(key: string): Promise<void> {
    localStorage.removeItem(`${this.prefix}${key}`)
  }

  async getAll(): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key !== null && key.startsWith(this.prefix)) {
        const actualKey = key.slice(this.prefix.length)
        try {
          const itemStr = localStorage.getItem(key)
          if (itemStr !== null) {
            const item: BrowserStorageItem<unknown> = JSON.parse(itemStr)
            if (item.expiresAt === null || Date.now() <= item.expiresAt) {
              result[actualKey] = item.value
            }
          }
        } catch {
          // Skip corrupted entries
        }
      }
    }
    return result
  }

  async clear(): Promise<void> {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key !== null && key.startsWith(this.prefix)) keysToRemove.push(key)
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key))
  }
}
