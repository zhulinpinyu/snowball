import { emptyDatabase, type Database } from "./snapshot-library"

export const STORAGE_KEY = "snowball:database"

/** 将整个库保存到 localStorage（单键存储） */
export function saveDatabase(ls: Storage, db: Database): void {
  ls.setItem(STORAGE_KEY, JSON.stringify(db))
}

/** 从 localStorage 加载库；键不存在或数据损坏时返回空库 */
export function loadDatabase(ls: Storage): Database {
  const raw = ls.getItem(STORAGE_KEY)
  if (!raw) return emptyDatabase()
  try {
    const parsed = JSON.parse(raw)
    if (
      Array.isArray(parsed.snapshots) &&
      Array.isArray(parsed.holdings) &&
      Array.isArray(parsed.owners) &&
      Array.isArray(parsed.platforms) &&
      Array.isArray(parsed.assetTypes)
    ) {
      return parsed as Database
    }
  } catch {
    // 数据损坏则回到空库
  }
  return emptyDatabase()
}
