import { describe, it, expect, beforeEach } from "vitest"
import { emptyDatabase, addSnapshot } from "./snapshot-library"
import { saveDatabase, loadDatabase, STORAGE_KEY } from "./storage"

function fakeLocalStorage(): Storage {
  let store: Record<string, string> = {}
  return {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = v
    },
    removeItem: (k: string) => {
      delete store[k]
    },
    clear: () => {
      store = {}
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length
    },
  }
}

let ls: Storage

describe("localStorage 持久化", () => {
  beforeEach(() => {
    ls = fakeLocalStorage()
    ls.removeItem(STORAGE_KEY)
  })

  it("保存后再加载，得到相同的数据（往返一致）", () => {
    let db = emptyDatabase()
    db = addSnapshot(db, "2025-08-01")

    saveDatabase(ls, db)
    const loaded = loadDatabase(ls)

    expect(loaded).toEqual(db)
  })

  it("localStorage 为空时加载，得到空库而非报错", () => {
    expect(loadDatabase(ls)).toEqual(emptyDatabase())
  })
})
