import { describe, it, expect } from "vitest"
import {
  emptyDatabase,
  addSnapshot,
  addHolding,
  deleteSnapshot,
  deleteHolding,
  updateHolding,
  updateSnapshot,
  addTag,
  deleteTag,
  listSnapshots,
  holdingsOf,
  totalAssetsSeries,
  snapshotSummaries,
  sharesByDimension,
  instrumentSeries,
  listInstruments,
  type Database,
} from "./snapshot-library"

function dbWithAugustSnapshot(): Database {
  let db = emptyDatabase()
  db = addSnapshot(db, "2025-08-01")
  return db
}

describe("快照", () => {
  it("新建快照后，快照列表按日期倒序显示（最新在前）", () => {
    let db = emptyDatabase()
    db = addSnapshot(db, "2025-07-01")
    db = addSnapshot(db, "2025-08-01")

    const dates = listSnapshots(db).map((s) => s.date)
    expect(dates).toEqual(["2025-08-01", "2025-07-01"])
  })

  it("删除快照时，其下的持仓记录一并删除", () => {
    let db = dbWithAugustSnapshot()
    const snapshot = listSnapshots(db)[0]
    db = addHolding(db, snapshot.id, {
      name: "沪深300指数A",
      code: "000961",
      assetType: "基金",
      owner: "我",
      platform: "支付宝",
      marketValue: 12000,
      cumulativeGain: 800,
    })

    db = deleteSnapshot(db, snapshot.id)

    expect(listSnapshots(db)).toHaveLength(0)
    expect(holdingsOf(db, snapshot.id)).toHaveLength(0)
  })
})

describe("持仓记录", () => {
  it("向快照添加持仓后，能按快照取回该持仓", () => {
    let db = dbWithAugustSnapshot()
    const snapshot = listSnapshots(db)[0]

    db = addHolding(db, snapshot.id, {
      name: "中证500ETF联接",
      code: "110020",
      assetType: "基金",
      owner: "老婆",
      platform: "微信",
      marketValue: 5300,
      cumulativeGain: -120,
    })

    const holdings = holdingsOf(db, snapshot.id)
    expect(holdings).toHaveLength(1)
    expect(holdings[0]).toMatchObject({
      name: "中证500ETF联接",
      code: "110020",
      owner: "老婆",
      platform: "微信",
      marketValue: 5300,
      cumulativeGain: -120,
    })
  })

  it("修改持仓的市值与累计收益后，取回的是新数字（抄错可改）", () => {
    let db = dbWithAugustSnapshot()
    const snapshot = listSnapshots(db)[0]
    db = addHolding(db, snapshot.id, {
      name: "贵州茅台",
      code: "600519",
      assetType: "股票",
      owner: "我",
      platform: "雪球",
      marketValue: 20000,
      cumulativeGain: 2000,
    })
    const holding = holdingsOf(db, snapshot.id)[0]

    db = updateHolding(db, holding.id, { marketValue: 21000, cumulativeGain: 3000 })

    expect(holdingsOf(db, snapshot.id)[0]).toMatchObject({
      marketValue: 21000,
      cumulativeGain: 3000,
    })
  })
})

describe("标签", () => {
  it("新增标签后可列出；删除未被引用的标签成功", () => {
    let db = emptyDatabase()
    db = addTag(db, "owners", "我")
    db = addTag(db, "platforms", "支付宝")

    expect(db.owners).toEqual(["我"])
    expect(db.platforms).toEqual(["支付宝"])

    db = deleteTag(db, "platforms", "支付宝")
    expect(db.platforms).toEqual([])
  })

  it("删除仍被持仓引用的标签被拒绝", () => {
    let db = dbWithAugustSnapshot()
    const snapshot = listSnapshots(db)[0]
    db = addTag(db, "owners", "我")
    db = addHolding(db, snapshot.id, {
      name: "沪深300指数A",
      code: "000961",
      assetType: "基金",
      owner: "我",
      platform: "支付宝",
      marketValue: 12000,
      cumulativeGain: 800,
    })

    expect(() => deleteTag(db, "owners", "我")).toThrow(/引用/)
  })
})

describe("快照日期修改", () => {
  it("修改快照日期后，列表按新日期排序", () => {
    let db = emptyDatabase()
    db = addSnapshot(db, "2025-07-01")
    db = addSnapshot(db, "2025-09-01")
    const july = listSnapshots(db).find((s) => s.date === "2025-07-01")!

    db = updateSnapshot(db, july.id, "2025-08-15")

    expect(listSnapshots(db).map((s) => s.date)).toEqual(["2025-09-01", "2025-08-15"])
  })
})

describe("删除单条持仓", () => {
  it("删除持仓后，快照仍在但持仓少一条", () => {
    let db = dbWithAugustSnapshot()
    const snapshot = listSnapshots(db)[0]
    db = addHolding(db, snapshot.id, {
      name: "沪深300指数A",
      code: "000961",
      assetType: "基金",
      owner: "我",
      platform: "支付宝",
      marketValue: 12000,
      cumulativeGain: 800,
    })
    const holding = holdingsOf(db, snapshot.id)[0]

    db = deleteHolding(db, holding.id)

    expect(listSnapshots(db)).toHaveLength(1)
    expect(holdingsOf(db, snapshot.id)).toHaveLength(0)
  })
})

describe("总资产趋势", () => {
  function seedTwoMonths() {
    let db = emptyDatabase()
    let july = addSnapshot(db, "2025-07-01")
    const julySnap = listSnapshots(july)[0]
    july = addHolding(july, julySnap.id, {
      name: "沪深300指数A", code: "000961", assetType: "基金", owner: "我",
      platform: "支付宝", marketValue: 10000, cumulativeGain: 500,
    })
    july = addHolding(july, julySnap.id, {
      name: "贵州茅台", code: "600519", assetType: "股票", owner: "老婆",
      platform: "雪球", marketValue: 5000, cumulativeGain: -200,
    })
    let august = addSnapshot(july, "2025-08-01")
    const augSnap = listSnapshots(august).find((s) => s.date === "2025-08-01")!
    august = addHolding(august, augSnap.id, {
      name: "沪深300指数A", code: "000961", assetType: "基金", owner: "我",
      platform: "支付宝", marketValue: 11000, cumulativeGain: 900,
    })
    august = addHolding(august, augSnap.id, {
      name: "贵州茅台", code: "600519", assetType: "股票", owner: "老婆",
      platform: "雪球", marketValue: 5500, cumulativeGain: 100,
    })
    return august
  }

  it("总资产序列按日期升序，总额为各持仓市值之和", () => {
    const series = totalAssetsSeries(seedTwoMonths())
    expect(series).toEqual([
      { snapshotId: expect.any(String), date: "2025-07-01", total: 15000 },
      { snapshotId: expect.any(String), date: "2025-08-01", total: 16500 },
    ])
  })

  it("快照列表带较上期的涨跌额：第一期无涨跌，第二期 +1500", () => {
    const summaries = snapshotSummaries(seedTwoMonths())
    expect(summaries[0]).toMatchObject({ date: "2025-08-01", total: 16500, delta: 1500 })
    expect(summaries[1]).toMatchObject({ date: "2025-07-01", total: 15000, delta: null })
  })

  it("空快照也出现在趋势里，总额为 0", () => {
    let db = emptyDatabase()
    db = addSnapshot(db, "2025-07-01")
    expect(totalAssetsSeries(db)).toEqual([
      { snapshotId: expect.any(String), date: "2025-07-01", total: 0 },
    ])
  })
})

describe("占比聚合", () => {
  function seeded(): Database {
    let db = emptyDatabase()
    db = addSnapshot(db, "2025-07-01")
    const july = listSnapshots(db)[0]
    db = addHolding(db, july.id, {
      name: "沪深300指数A", code: "000961", assetType: "基金", owner: "我",
      platform: "支付宝", marketValue: 10000, cumulativeGain: 500,
    })
    db = addHolding(db, july.id, {
      name: "贵州茅台", code: "600519", assetType: "股票", owner: "老婆",
      platform: "雪球", marketValue: 5000, cumulativeGain: -200,
    })
    db = addSnapshot(db, "2025-08-01")
    const august = listSnapshots(db).find((s) => s.date === "2025-08-01")!
    db = addHolding(db, august.id, {
      name: "沪深300指数A", code: "000961", assetType: "基金", owner: "我",
      platform: "支付宝", marketValue: 12000, cumulativeGain: 900,
    })
    return db
  }

  it("默认取最新快照，按维度汇总市值，降序排列", () => {
    expect(sharesByDimension(seeded(), "owner")).toEqual([{ label: "我", total: 12000 }])
    expect(sharesByDimension(seeded(), "assetType")).toEqual([{ label: "基金", total: 12000 }])
  })

  it("指定快照时按该快照聚合；同维度多持仓合并求和", () => {
    const db = seeded()
    const july = listSnapshots(db).find((s) => s.date === "2025-07-01")!
    expect(sharesByDimension(db, "owner", july.id)).toEqual([
      { label: "我", total: 10000 },
      { label: "老婆", total: 5000 },
    ])
    expect(sharesByDimension(db, "platform", july.id)).toEqual([
      { label: "支付宝", total: 10000 },
      { label: "雪球", total: 5000 },
    ])
  })
})

describe("标的走势", () => {
  function seeded(): Database {
    let db = emptyDatabase()
    db = addSnapshot(db, "2025-07-01")
    const july = listSnapshots(db)[0]
    db = addHolding(db, july.id, {
      name: "沪深300指数A", code: "000961", assetType: "基金", owner: "我",
      platform: "支付宝", marketValue: 10000, cumulativeGain: 500,
    })
    // 同一只基金在另一个平台、另一个人名下：按代码归并求和
    db = addHolding(db, july.id, {
      name: "沪深300指数A", code: "000961", assetType: "基金", owner: "老婆",
      platform: "微信", marketValue: 2000, cumulativeGain: -100,
    })
    db = addSnapshot(db, "2025-08-01")
    const august = listSnapshots(db).find((s) => s.date === "2025-08-01")!
    db = addHolding(db, august.id, {
      name: "沪深300指数A", code: "000961", assetType: "基金", owner: "我",
      platform: "支付宝", marketValue: 11000, cumulativeGain: 900,
    })
    return db
  }

  it("同一代码跨平台跨人归并，按快照日期升序求和", () => {
    expect(instrumentSeries(seeded(), "000961")).toEqual([
      { date: "2025-07-01", marketValue: 12000, cumulativeGain: 400 },
      { date: "2025-08-01", marketValue: 11000, cumulativeGain: 900 },
    ])
  })

  it("标的列表去重，名称取最近一次出现的", () => {
    expect(listInstruments(seeded())).toEqual([{ code: "000961", name: "沪深300指数A" }])
  })

  it("没有代码的持仓按名称归并", () => {
    let db = emptyDatabase()
    db = addSnapshot(db, "2025-07-01")
    const july = listSnapshots(db)[0]
    db = addHolding(db, july.id, {
      name: "银行存款", code: "", assetType: "存款", owner: "我",
      platform: "支付宝", marketValue: 3000, cumulativeGain: 0,
    })
    expect(instrumentSeries(db, "银行存款")).toEqual([
      { date: "2025-07-01", marketValue: 3000, cumulativeGain: 0 },
    ])
    expect(listInstruments(db)).toEqual([{ code: "", name: "银行存款" }])
  })
})

describe("非安全上下文", () => {
  it("没有 crypto.randomUUID（局域网 http / 部分微信内核）时，创建快照不抛异常", () => {
    const original = Object.getOwnPropertyDescriptor(crypto, "randomUUID")
    Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true })

    try {
      let db = emptyDatabase()
      expect(() => {
        db = addSnapshot(db, "2025-08-01")
      }).not.toThrow()
      expect(listSnapshots(db)).toHaveLength(1)
    } finally {
      if (original) Object.defineProperty(crypto, "randomUUID", original)
    }
  })
})
