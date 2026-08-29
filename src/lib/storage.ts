import { emptyDatabase, type Database } from "./snapshot-library"

export const STORAGE_KEY = "snowball:database"

/** 数据形状是否为一个合法的库 */
export function isValidDatabase(value: unknown): value is Database {
  if (typeof value !== "object" || value === null) return false
  const v = value as Record<string, unknown>
  return (
    Array.isArray(v.snapshots) &&
    Array.isArray(v.holdings) &&
    Array.isArray(v.owners) &&
    Array.isArray(v.platforms) &&
    Array.isArray(v.assetTypes)
  )
}

/** 将整个库保存到 localStorage（单键存储） */
export function saveDatabase(ls: Storage, db: Database): void {
  ls.setItem(STORAGE_KEY, JSON.stringify(db))
}

/** 从 localStorage 加载库；键不存在或数据损坏时返回空库 */
export function loadDatabase(ls: Storage): Database {
  const raw = ls.getItem(STORAGE_KEY)
  if (!raw) return emptyDatabase()
  try {
    const parsed: unknown = JSON.parse(raw)
    if (isValidDatabase(parsed)) {
      return parsed
    }
  } catch {
    // 数据损坏则回到空库
  }
  return emptyDatabase()
}
