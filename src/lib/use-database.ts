import { useEffect, useState } from "react"
import { emptyDatabase, type Database } from "./snapshot-library"
import { loadDatabase, saveDatabase } from "./storage"

/**
 * 应用数据源：加载 localStorage 中的库，任何变更通过纯函数生成新库后写回。
 */
export function useDatabase() {
  const [db, setDb] = useState<Database>(emptyDatabase())

  useEffect(() => {
    setDb(loadDatabase(window.localStorage))
  }, [])

  const update = (fn: (db: Database) => Database) => {
    setDb((current) => {
      const next = fn(current)
      saveDatabase(window.localStorage, next)
      return next
    })
  }

  /** 整体替换（导入 JSON 用） */
  const replace = (next: Database) => {
    saveDatabase(window.localStorage, next)
    setDb(next)
  }

  return { db, update, replace }
}
