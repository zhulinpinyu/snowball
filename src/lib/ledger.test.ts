import { describe, expect, it } from "vitest"
import {
  emptyDatabase,
  addInstrument,
  deleteInstrument,
  listInstruments,
  addPosition,
  addAccount,
  deletePosition,
  deleteAccount,
  recordPosition,
  recordCash,
  deletePositionPoint,
  deleteCashPoint,
  deleteTag,
  latestPositionPoint,
  latestCashPoint,
  asOfTotal,
  valuationSeries,
  liveSummary,
  latestBreakdown,
  type Database,
  type QuoteState,
} from "./ledger"

/** 一只基金持仓 + 两只现金账户，2026-08-01 记过一笔 */
function seed(): Database {
  let db = emptyDatabase()
  db = addPosition(db, {
    code: "000961",
    name: "天弘沪深300ETF联接A",
    kind: "fund",
    owner: "我",
    platform: "支付宝",
  })
  const posId = db.positions[0].id
  db = recordPosition(db, posId, "2026-08-01", 1000, 1.2, 1.5)
  db = addAccount(db, { name: "招行活期", owner: "我", platform: "招商银行" })
  db = recordCash(db, db.accounts[0].id, "2026-08-01", 20000)
  return db
}

function quote(price: number, stale = false): QuoteState {
  return { price, date: "2026-09-02", stale }
}

describe("持仓与现金账户 CRUD", () => {
  it("添加持仓时自动把所属人/平台并入标签列表", () => {
    const db = seed()
    expect(db.owners).toContain("我")
    expect(db.platforms).toContain("支付宝")
    expect(db.platforms).toContain("招商银行")
  })

  it("删除持仓连带删除其记录点；不影响现金账户", () => {
    let db = seed()
    const posId = db.positions[0].id
    db = deletePosition(db, posId)
    expect(db.positions).toHaveLength(0)
    expect(db.positionPoints).toHaveLength(0)
    expect(db.accounts).toHaveLength(1)
    expect(db.cashPoints).toHaveLength(1)
  })

  it("删除现金账户连带删除其记录点", () => {
    let db = seed()
    const accId = db.accounts[0].id
    db = deleteAccount(db, accId)
    expect(db.accounts).toHaveLength(0)
    expect(db.cashPoints).toHaveLength(0)
  })

  it("被持仓/账户引用的标签不可删除，解引用后可删", () => {
    let db = seed()
    expect(() => deleteTag(db, "platforms", "支付宝")).toThrow(/引用/)
    const posId = db.positions[0].id
    db = deletePosition(db, posId)
    db = deleteTag(db, "platforms", "支付宝")
    expect(db.platforms).not.toContain("支付宝")
  })
})

describe("记录点（同实体同日期的 upsert）", () => {
  it("记两笔不同日期 → 两个点；当前状态取最新日期", () => {
    let db = seed()
    const posId = db.positions[0].id
    db = recordPosition(db, posId, "2026-09-01", 1200, 1.25, 1.6)
    expect(db.positionPoints).toHaveLength(2)
    const latest = latestPositionPoint(db, posId)
    expect(latest).toMatchObject({ date: "2026-09-01", shares: 1200, costPrice: 1.25 })
  })

  it("同一天再记 → 原位更新不新增点（纠错语义）", () => {
    let db = seed()
    const posId = db.positions[0].id
    const firstPointId = db.positionPoints[0].id
    db = recordPosition(db, posId, "2026-08-01", 900, 1.3, 1.55)
    expect(db.positionPoints).toHaveLength(1)
    expect(db.positionPoints[0].id).toBe(firstPointId)
    expect(db.positionPoints[0]).toMatchObject({ shares: 900, costPrice: 1.3 })
  })

  it("补记更早日期不覆盖较新的当前状态", () => {
    let db = seed()
    const posId = db.positions[0].id
    db = recordPosition(db, posId, "2026-09-01", 1200, 1.25, 1.6)
    db = recordPosition(db, posId, "2026-07-01", 500, 1.1, 1.2)
    const latest = latestPositionPoint(db, posId)
    expect(latest?.date).toBe("2026-09-01")
  })

  it("现金记录点同样 upsert；删除点后回退到上一状态", () => {
    let db = seed()
    const accId = db.accounts[0].id
    db = recordCash(db, accId, "2026-09-01", 18000)
    expect(db.cashPoints).toHaveLength(2)
    db = deleteCashPoint(db, db.cashPoints.find((p) => p.date === "2026-09-01")!.id)
    expect(latestCashPoint(db, accId)?.balance).toBe(20000)
  })

  it("删除持仓记录点后，当前状态回退到更早一点", () => {
    let db = seed()
    const posId = db.positions[0].id
    db = recordPosition(db, posId, "2026-09-01", 1200, 1.25, 1.6)
    const sepPoint = db.positionPoints.find((p) => p.date === "2026-09-01")!
    db = deletePositionPoint(db, sepPoint.id)
    expect(latestPositionPoint(db, posId)?.date).toBe("2026-08-01")
  })
})

describe("as-of 估值与曲线", () => {
  it("单日家庭资产 = 持仓 份额×记录价 + 现金余额", () => {
    const db = seed()
    const { total, incomplete } = asOfTotal(db, "2026-08-01")
    expect(total).toBe(1000 * 1.5 + 20000)
    expect(incomplete).toBe(false)
  })

  it("插值：中间日期取不晚于该日期的最近记录点", () => {
    let db = seed()
    const posId = db.positions[0].id
    const accId = db.accounts[0].id
    db = recordPosition(db, posId, "2026-09-01", 1200, 1.25, 1.6)
    db = recordCash(db, accId, "2026-09-01", 18000)
    const mid = asOfTotal(db, "2026-08-15")
    expect(mid.total).toBe(1000 * 1.5 + 20000)
  })

  it("某持仓记录点缺价（priceAtRecord=null）→ 标记 incomplete 且不计入", () => {
    let db = seed()
    const posId = db.positions[0].id
    db = recordPosition(db, posId, "2026-09-01", 1200, 1.25, null)
    const { total, incomplete } = asOfTotal(db, "2026-09-01")
    expect(total).toBe(20000)
    expect(incomplete).toBe(true)
  })

  it("估值曲线按日期升序，含 现金/持仓 变化", () => {
    let db = seed()
    const posId = db.positions[0].id
    const accId = db.accounts[0].id
    db = recordPosition(db, posId, "2026-09-01", 1200, 1.25, 1.6)
    db = recordCash(db, accId, "2026-09-01", 18000)
    const series = valuationSeries(db)
    expect(series.map((p) => p.date)).toEqual(["2026-08-01", "2026-09-01"])
    expect(series[0].total).toBe(1000 * 1.5 + 20000)
    expect(series[1].total).toBe(1200 * 1.6 + 18000)
  })
})

describe("实时汇总（注入行情）", () => {
  it("市值=份额×现价；浮动盈亏=(现价−成本)×份额；总资产含现金", () => {
    let db = seed()
    const posId = db.positions[0].id
    db = recordPosition(db, posId, "2026-09-01", 1200, 1.25, 1.6)
    const sum = liveSummary(db, { [posId]: quote(1.7) })
    expect(sum.totals.holdings).toBe(1200 * 1.7)
    expect(sum.totals.cash).toBe(20000)
    expect(sum.totals.assets).toBe(1200 * 1.7 + 20000)
    expect(sum.totals.pl).toBe((1.7 - 1.25) * 1200)
    expect(sum.positions[0].value).toBe(1200 * 1.7)
  })

  it("有持仓记录点但缺行情 → 计入 missing，不进合计", () => {
    const db = seed()
    const sum = liveSummary(db, {})
    expect(sum.positionsMissingPrice).toEqual([db.positions[0].id])
    expect(sum.totals.holdings).toBe(0)
    expect(sum.totals.cash).toBe(20000)
  })

  it("没有记录点的持仓不参与汇总", () => {
    let db = seed()
    db = addPosition(db, {
      code: "600519",
      name: "贵州茅台",
      kind: "stock",
      owner: "我",
      platform: "雪球",
    })
    const sum = liveSummary(db, { [db.positions[0].id]: quote(1.7) })
    expect(sum.positions).toHaveLength(1)
  })
})

describe("占比聚合", () => {
  it("按所属人/平台/类型聚合，现金按账户标签归入；类型分 基金/股票/现金", () => {
    let db = seed()
    const fundId = db.positions[0].id
    db = recordPosition(db, fundId, "2026-09-01", 1200, 1.25, 1.6)
    db = addPosition(db, {
      code: "600519",
      name: "贵州茅台",
      kind: "stock",
      owner: "老婆",
      platform: "雪球",
    })
    const stockId = db.positions[1].id
    db = recordPosition(db, stockId, "2026-09-01", 100, 1500, 1600)
    const quotes = { [fundId]: quote(1.7), [stockId]: quote(1700) }

    const byOwner = latestBreakdown(db, quotes, "owner")
    expect(byOwner.find((s) => s.label === "我")?.total).toBe(1200 * 1.7 + 20000)
    expect(byOwner.find((s) => s.label === "老婆")?.total).toBe(100 * 1700)

    const byKind = latestBreakdown(db, quotes, "kind")
    expect(byKind).toEqual([
      { label: "股票", total: 170000 },
      { label: "现金", total: 20000 },
      { label: "基金", total: 2040 },
    ])

    const byPlatform = latestBreakdown(db, quotes, "platform")
    expect(byPlatform.find((s) => s.label === "招商银行")?.total).toBe(20000)
  })
})

describe("标的库", () => {
  it("添加去重：同类型同代码只保留一条", () => {
    let db = emptyDatabase()
    db = addInstrument(db, { code: "000961", name: "天弘沪深300ETF联接A", kind: "fund" })
    db = addInstrument(db, { code: "000961", name: "天弘沪深300ETF联接A", kind: "fund" })
    expect(db.instruments).toHaveLength(1)
  })

  it("同一代码可分别作为基金与股票入库（如 000001）", () => {
    let db = emptyDatabase()
    db = addInstrument(db, { code: "000001", name: "华夏成长", kind: "fund" })
    db = addInstrument(db, { code: "000001", name: "平安银行", kind: "stock" })
    expect(db.instruments).toHaveLength(2)
  })

  it("被持仓引用的标的不可删；解引用后可删", () => {
    let db = emptyDatabase()
    db = addInstrument(db, { code: "000961", name: "某基金", kind: "fund" })
    const instId = db.instruments[0].id
    db = addPosition(db, { code: "000961", name: "某基金", kind: "fund", owner: "我", platform: "支付宝" })
    expect(() => deleteInstrument(db, instId)).toThrow(/引用/)
    db = deletePosition(db, db.positions[0].id)
    db = deleteInstrument(db, instId)
    expect(db.instruments).toHaveLength(0)
  })

  it("listInstruments 按 基金→股票、名称排序", () => {
    let db = emptyDatabase()
    db = addInstrument(db, { code: "600519", name: "贵州茅台", kind: "stock" })
    db = addInstrument(db, { code: "000961", name: "天弘沪深300ETF联接A", kind: "fund" })
    db = addInstrument(db, { code: "510300", name: "沪深300ETF", kind: "stock" })
    const listed = listInstruments(db)
    expect(listed.map((i) => i.kind)).toEqual(["fund", "stock", "stock"])
    expect(listed[0].name).toBe("天弘沪深300ETF联接A")
  })
})
