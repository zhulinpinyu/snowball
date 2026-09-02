import { describe, it, expect, beforeEach } from "vitest"
import { emptyDatabase, addInstrument, addPosition, recordPosition } from "./ledger"
import {
  saveDatabase,
  loadDatabase,
  STORAGE_KEY,
  isValidDatabase,
  migrateLegacyV2,
} from "./storage"

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

describe("localStorage 持久化（含标的库）", () => {
  beforeEach(() => {
    ls = fakeLocalStorage()
    ls.removeItem(STORAGE_KEY)
  })

  it("保存后再加载，得到相同的数据（往返一致）", () => {
    let db = emptyDatabase()
    db = addInstrument(db, { code: "000961", name: "天弘沪深300ETF联接A", kind: "fund" })
    db = addPosition(db, {
      code: "000961",
      name: "天弘沪深300ETF联接A",
      kind: "fund",
      owner: "我",
      platform: "支付宝",
    })
    db = recordPosition(db, db.positions[0].id, "2026-08-01", 1000, 1.2, 1.5)
    db = addInstrument(db, { code: "600519", name: "贵州茅台", kind: "stock" })
    db = addPosition(db, {
      code: "600519",
      name: "贵州茅台",
      kind: "stock",
      owner: "老婆",
      platform: "雪球",
    })

    saveDatabase(ls, db)
    const loaded = loadDatabase(ls)
    expect(loaded).toEqual(db)
    expect(loaded.instruments).toHaveLength(2)
  })

  it("localStorage 为空时加载，得到空库而非报错", () => {
    expect(loadDatabase(ls)).toEqual(emptyDatabase())
  })

  it("更早 MVP 原型结构（snapshots/holdings）被判无效 → 空库", () => {
    ls.setItem(
      STORAGE_KEY,
      JSON.stringify({
        snapshots: [{ id: "s1", date: "2026-01-01" }],
        holdings: [],
        owners: [],
        platforms: [],
        assetTypes: [],
      })
    )
    expect(loadDatabase(ls)).toEqual(emptyDatabase())
  })

  it("旧形状（无 instruments 字段）自动迁移：由持仓重建标的库并去重", () => {
    const legacy = {
      positions: [
        { id: "p1", code: "000961", name: "天弘沪深300ETF联接A", kind: "fund", owner: "我", platform: "支付宝" },
        { id: "p2", code: "000961", name: "天弘沪深300ETF联接A", kind: "fund", owner: "老婆", platform: "天天基金" },
        { id: "p3", code: "600519", name: "贵州茅台", kind: "stock", owner: "我", platform: "雪球" },
      ],
      accounts: [],
      positionPoints: [],
      cashPoints: [],
      owners: ["我", "老婆"],
      platforms: ["支付宝", "天天基金", "雪球"],
    }
    ls.setItem(STORAGE_KEY, JSON.stringify(legacy))
    const loaded = loadDatabase(ls)
    expect(loaded.instruments).toHaveLength(2)
    expect(loaded.positions).toHaveLength(3)
    expect(loaded.instruments[0]).toMatchObject({ code: "000961", kind: "fund" })
  })

  it("migrateLegacyV2 直接可用", () => {
    const migrated = migrateLegacyV2({
      positions: [{ id: "p1", code: "000961", name: "某基金", kind: "fund", owner: "我", platform: "支付宝" }],
      accounts: [],
      positionPoints: [],
      cashPoints: [],
      owners: ["我"],
      platforms: ["支付宝"],
    })
    expect(migrated.instruments).toEqual([
      { id: "inst-1", code: "000961", name: "某基金", kind: "fund" },
    ])
    expect(isValidDatabase(migrated)).toBe(true)
  })

  it("损坏的 JSON 加载为空库", () => {
    ls.setItem(STORAGE_KEY, "{oops")
    expect(loadDatabase(ls)).toEqual(emptyDatabase())
  })
})

describe("深度校验", () => {
  it("字段缺失/类型错误 → 判无效（拒绝导入），即使顶层是数组", () => {
    const bad = {
      instruments: [],
      positions: [{ id: "p1", code: "000961", name: "某基金", kind: "fund" }], // 缺 owner/platform
      accounts: [],
      positionPoints: [],
      cashPoints: [],
      owners: [],
      platforms: [],
    }
    expect(isValidDatabase(bad)).toBe(false)
    const badKind = {
      instruments: [{ id: "i1", code: "x", name: "n", kind: "gold" }],
      positions: [],
      accounts: [],
      positionPoints: [],
      cashPoints: [],
      owners: [],
      platforms: [],
    }
    expect(isValidDatabase(badKind)).toBe(false)
  })

  it("完全合法的库（含标的库）判有效", () => {
    const ok = {
      instruments: [{ id: "i1", code: "000961", name: "某基金", kind: "fund" }],
      positions: [{ id: "p1", code: "000961", name: "某基金", kind: "fund", owner: "我", platform: "支付宝" }],
      positionPoints: [{ id: "pp", positionId: "p1", date: "2026-08-01", shares: 100, costPrice: 1, priceAtRecord: 1.5 }],
      cashPoints: [],
      accounts: [],
      owners: ["我"],
      platforms: ["支付宝"],
    }
    expect(isValidDatabase(ok)).toBe(true)
  })
})
