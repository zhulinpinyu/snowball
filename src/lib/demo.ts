/**
 * demo —— 仅用于本地预览的演示数据生成器（生产构建不会包含：只被根目录 demo.html 引用）。
 *
 * 复现用户的场景：季度末 2026-06-30 手工记过一次，之后每天有行情估值快照；
 * 中途（2026-08-10）加仓并动了一次现金，用来展示「人工点优先」和「涨跌含现金变动」。
 */
import {
  addAccount,
  addInstrument,
  addPosition,
  emptyDatabase,
  recordCash,
  recordPosition,
  recordValuationPoint,
  valuationPointAsOf,
  type Database,
} from "./ledger"

/** 确定性伪随机（种子固定 → 每次生成的演示数据一样，方便截图/复现） */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** 交易日（跳过周末） */
function* tradingDays(from: string, to: string): Generator<string> {
  const d = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  while (d <= end) {
    const day = d.getDay()
    if (day !== 0 && day !== 6) yield localDate(d)
    d.setDate(d.getDate() + 1)
  }
}

function round(n: number, digits: number): number {
  const f = 10 ** digits
  return Math.round(n * f) / f
}

export function seedDemoDatabase(): Database {
  let db = emptyDatabase()
  db = addInstrument(db, { code: "000961", name: "天弘沪深300ETF联接A", kind: "fund" })
  db = addInstrument(db, { code: "600519", name: "贵州茅台", kind: "stock" })
  db = addPosition(db, {
    code: "000961",
    name: "天弘沪深300ETF联接A",
    kind: "fund",
    owner: "我",
    platform: "支付宝",
  })
  db = addPosition(db, {
    code: "600519",
    name: "贵州茅台",
    kind: "stock",
    owner: "老婆",
    platform: "雪球",
  })
  db = addAccount(db, { name: "招行活期", owner: "我", platform: "招商银行" })
  db = addAccount(db, { name: "余额宝", owner: "我", platform: "支付宝" })

  const [fund, stock] = db.positions
  const [bank, yuebao] = db.accounts

  // 季度末手工记一笔：只有这一个采样点的旧状态
  db = recordPosition(db, fund.id, "2026-06-30", 12345.67, 1.28, 1.35)
  db = recordPosition(db, stock.id, "2026-06-30", 100, 1520, 1600)
  db = recordCash(db, bank.id, "2026-06-30", 20000)
  db = recordCash(db, yuebao.id, "2026-06-30", 50000)

  // 之后每个交易日自动落估值快照（随机游走，略偏上行）
  const rand = mulberry32(20260920)
  let fundPrice = 1.35
  let stockPrice = 1600
  for (const date of tradingDays("2026-07-01", "2026-09-18")) {
    fundPrice *= 1 + (rand() - 0.45) * 0.018
    stockPrice *= 1 + (rand() - 0.5) * 0.05
    db = recordValuationPoint(db, fund.id, date, round(fundPrice, 4))
    db = recordValuationPoint(db, stock.id, date, round(stockPrice, 2))
  }

  // 中途一次人工改动：加仓 + 活期转出 5000（用于展示人工点优先 / 涨跌含现金）
  const priceOnChange = valuationPointAsOf(db, fund.id, "2026-08-10")?.price ?? null
  db = recordPosition(db, fund.id, "2026-08-10", 13345.67, 1.3, priceOnChange)
  db = recordCash(db, bank.id, "2026-08-10", 15000)

  return db
}
