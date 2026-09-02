import { useState } from "react"
import { type Database } from "./ledger"
import { loadDatabase, saveDatabase } from "./storage"

/**
 * 应用数据源：首次渲染即从 localStorage 读取库（惰性初始化，避免挂载后二次渲染），
 * 任何变更通过纯函数生成新库后写回。
 */
export function useDatabase() {
  const [db, setDb] = useState<Database>(() => loadDatabase(window.localStorage))

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
