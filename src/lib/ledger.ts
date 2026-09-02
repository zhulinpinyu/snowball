/**
 * ledger —— Snowball v1 领域核心（纯函数模块）。
 *
 * 术语以 CONTEXT.md 为准（Spec 0002 / ADR 0002）：
 * 持仓 = 基金/股票（份额 + 持仓成本价，手维护）；现金账户 = 余额随时改；
 * 记录点 = 一次改动产生的带日期历史条目（upsert 按 同实体+同日期，可删改纠错）；
 * 现价由行情层注入（Quotes），市值 = 份额 × 现价，浮动盈亏 = (现价 − 成本) × 份额。
 * 所有函数均为纯函数：接收 Database，返回新 Database，不修改入参。
 */

export type InstrumentKind = "fund" | "stock"
export type TagKind = "owners" | "platforms"

/** 标的库条目：一只基金/股票（输一次代码、由行情层补名称后入库；多人生成多个持仓共用一条） */
export interface Instrument {
  id: string
  /** 6 位代码 */
  code: string
  name: string
  kind: InstrumentKind
}

/** 持仓：某所属人在某平台持有的一只标的（代码/名称/类型来自标的库，创建时拷贝） */
export interface Position {
  id: string
  /** 6 位标的代码 */
  code: string
  /** 标的名称 */
  name: string
  kind: InstrumentKind
  owner: string
  platform: string
}

/** 现金账户：存款/现金等价物的一个余额入口 */
export interface CashAccount {
  id: string
  name: string
  owner: string
  platform: string
}

/** 持仓记录点：某持仓在某日期的份额与成本（含当时记下的单价，供历史估值） */
export interface PositionPoint {
  id: string
  positionId: string
  /** 日期 YYYY-MM-DD */
  date: string
  /** 份额（基金）/ 股数（股票） */
  shares: number
  /** 持仓成本价（摊薄后，用户维护） */
  costPrice: number
  /** 记录当时取到的现价；行情不可用时为 null，历史估值会跳过并标记 incomplete */
  priceAtRecord: number | null
}

/** 现金记录点：某现金账户在某日期的余额 */
export interface CashPoint {
  id: string
  accountId: string
  date: string
  balance: number
}

export interface Database {
  instruments: Instrument[]
  positions: Position[]
  accounts: CashAccount[]
  positionPoints: PositionPoint[]
  cashPoints: CashPoint[]
  owners: string[]
  platforms: string[]
}

export function emptyDatabase(): Database {
  return {
    instruments: [],
    positions: [],
    accounts: [],
    positionPoints: [],
    cashPoints: [],
    owners: [],
    platforms: [],
  }
}

/** 向标的库添加一只基金/股票；同类型同代码已存在则返回原库（去重） */
export function addInstrument(
  db: Database,
  input: { code: string; name: string; kind: InstrumentKind }
): Database {
  const exists = db.instruments.some((i) => i.kind === input.kind && i.code === input.code)
  if (exists) return db
  const instrument: Instrument = { id: newId(), ...input }
  return { ...db, instruments: [...db.instruments, instrument] }
}

/** 删除标的库条目；仍被持仓引用（同类型同代码）则拒绝 */
export function deleteInstrument(db: Database, instrumentId: string): Database {
  const instrument = db.instruments.find((i) => i.id === instrumentId)
  if (!instrument) return db
  const inUse = db.positions.some(
    (p) => p.kind === instrument.kind && p.code === instrument.code
  )
  if (inUse) {
    throw new Error(`「${instrument.name}」仍被持仓引用，无法从库中删除`)
  }
  return { ...db, instruments: db.instruments.filter((i) => i.id !== instrumentId) }
}

/** 标的库列表（按 类型 → 名称排序） */
export function listInstruments(db: Database): Instrument[] {
  return [...db.instruments].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "fund" ? -1 : 1
    return a.name.localeCompare(b.name, "zh-CN")
  })
}

function newId(): string {
  // randomUUID 仅在安全上下文（https / localhost）可用；
  // 局域网 http 或部分微信内核里没有，降级到时间戳+随机数
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** 新增标签（所属人/平台） */
export function addTag(db: Database, kind: TagKind, label: string): Database {
  if (db[kind].includes(label)) return db
  return { ...db, [kind]: [...db[kind], label] }
}

/** 删除未被引用（持仓/现金账户）的标签；仍被引用则拒绝 */
export function deleteTag(db: Database, kind: TagKind, label: string): Database {
  const referenced =
    kind === "owners"
      ? db.positions.some((p) => p.owner === label) || db.accounts.some((a) => a.owner === label)
      : db.positions.some((p) => p.platform === label) || db.accounts.some((a) => a.platform === label)
  if (referenced) {
    throw new Error(`标签「${label}」仍被持仓或现金账户引用，无法删除`)
  }
  return { ...db, [kind]: db[kind].filter((l) => l !== label) }
}

export interface NewPosition {
  code: string
  name: string
  kind: InstrumentKind
  owner: string
  platform: string
}

/** 添加持仓（名称/类型通常来自行情层）；所属人/平台标签自动入库 */
export function addPosition(db: Database, input: NewPosition): Database {
  const position: Position = { id: newId(), ...input }
  return {
    ...db,
    positions: [...db.positions, position],
    owners: db.owners.includes(input.owner) ? db.owners : [...db.owners, input.owner],
    platforms: db.platforms.includes(input.platform)
      ? db.platforms
      : [...db.platforms, input.platform],
  }
}

/** 删除持仓，其下记录点一并删除 */
export function deletePosition(db: Database, positionId: string): Database {
  return {
    ...db,
    positions: db.positions.filter((p) => p.id !== positionId),
    positionPoints: db.positionPoints.filter((p) => p.positionId !== positionId),
  }
}

export interface NewCashAccount {
  name: string
  owner: string
  platform: string
}

/** 添加现金账户 */
export function addAccount(db: Database, input: NewCashAccount): Database {
  const account: CashAccount = { id: newId(), ...input }
  return {
    ...db,
    accounts: [...db.accounts, account],
    owners: db.owners.includes(input.owner) ? db.owners : [...db.owners, input.owner],
    platforms: db.platforms.includes(input.platform)
      ? db.platforms
      : [...db.platforms, input.platform],
  }
}

/** 删除现金账户，其下记录点一并删除 */
export function deleteAccount(db: Database, accountId: string): Database {
  return {
    ...db,
    accounts: db.accounts.filter((a) => a.id !== accountId),
    cashPoints: db.cashPoints.filter((p) => p.accountId !== accountId),
  }
}

/** 按 (实体, 日期) 查找记录点索引；同一天最多一个点（upsert 语义） */
function findPoint<T extends { date: string }, K extends keyof T>(
  points: T[],
  keyField: K,
  entityId: string,
  date: string
): number {
  return points.findIndex((p) => p[keyField] === entityId && p.date === date)
}

/**
 * 记一笔持仓：把某持仓在 date 的份额/成本（及当时的现价）落为一个记录点。
 * 该持仓该日期已有记录点则原位更新（纠错），否则追加；date 默认可为过去（补记）。
 */
export function recordPosition(
  db: Database,
  positionId: string,
  date: string,
  shares: number,
  costPrice: number,
  priceAtRecord: number | null
): Database {
  const idx = findPoint(db.positionPoints, "positionId", positionId, date)
  if (idx >= 0) {
    const points = [...db.positionPoints]
    points[idx] = { ...points[idx], shares, costPrice, priceAtRecord }
    return { ...db, positionPoints: points }
  }
  const point: PositionPoint = { id: newId(), positionId, date, shares, costPrice, priceAtRecord }
  return { ...db, positionPoints: [...db.positionPoints, point] }
}

/** 记一笔现金：某账户在某日期的余额 */
export function recordCash(db: Database, accountId: string, date: string, balance: number): Database {
  const idx = findPoint(db.cashPoints, "accountId", accountId, date)
  if (idx >= 0) {
    const points = [...db.cashPoints]
    points[idx] = { ...points[idx], balance }
    return { ...db, cashPoints: points }
  }
  const point: CashPoint = { id: newId(), accountId, date, balance }
  return { ...db, cashPoints: [...db.cashPoints, point] }
}

/** 删除某持仓记录点（纠错） */
export function deletePositionPoint(db: Database, pointId: string): Database {
  return { ...db, positionPoints: db.positionPoints.filter((p) => p.id !== pointId) }
}

/** 删除某现金记录点（纠错） */
export function deleteCashPoint(db: Database, pointId: string): Database {
  return { ...db, cashPoints: db.cashPoints.filter((p) => p.id !== pointId) }
}

/** 某持仓日期不超过 limit 的最近一个记录点（as-of 查询） */
export function positionPointAsOf(db: Database, positionId: string, limit: string): PositionPoint | null {
  return db.positionPoints
    .filter((p) => p.positionId === positionId && p.date <= limit)
    .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
}

/** 某持仓日期最新的记录点（当前状态） */
export function latestPositionPoint(db: Database, positionId: string): PositionPoint | null {
  return positionPointAsOf(db, positionId, "\uFFFF")
}

/** 某现金账户日期不超过 limit 的最近一个记录点 */
export function cashPointAsOf(db: Database, accountId: string, limit: string): CashPoint | null {
  return db.cashPoints
    .filter((p) => p.accountId === accountId && p.date <= limit)
    .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
}

export function latestCashPoint(db: Database, accountId: string): CashPoint | null {
  return cashPointAsOf(db, accountId, "\uFFFF")
}

/** 全部记录点日期（升序去重），估值曲线的采样点 */
export function pointDates(db: Database): string[] {
  const dates = new Set<string>()
  for (const p of db.positionPoints) dates.add(p.date)
  for (const p of db.cashPoints) dates.add(p.date)
  return [...dates].sort()
}

export interface AsOfTotal {
  /** 有价的持仓市值 + 现金余额；存在无法定价（priceAtRecord 缺失）的持仓时为部分和 */
  total: number
  /** true = 有持仓因缺价被跳过，total 是部分和 */
  incomplete: boolean
}

/** 某日期的家庭资产：每个持仓取 ≤date 最近一个记录点，按其记录时价格估值；现金取 ≤date 最近余额 */
export function asOfTotal(db: Database, date: string): AsOfTotal {
  let total = 0
  let incomplete = false
  for (const pos of db.positions) {
    const point = positionPointAsOf(db, pos.id, date)
    if (!point) continue
    if (point.priceAtRecord === null) {
      incomplete = true
      continue
    }
    total += point.shares * point.priceAtRecord
  }
  for (const acc of db.accounts) {
    const point = cashPointAsOf(db, acc.id, date)
    if (!point) continue
    total += point.balance
  }
  return { total, incomplete }
}

export interface SeriesPoint {
  date: string
  total: number
  incomplete: boolean
}

/** 估值曲线：以每个记录点日期为采样点，逐日算 as-of 家庭资产（升序） */
export function valuationSeries(db: Database): SeriesPoint[] {
  return pointDates(db).map((date) => ({ date, ...asOfTotal(db, date) }))
}

/** 行情层注入的现价：stale=true 表示行情不可用、用的是上次取值/回退价 */
export interface QuoteState {
  price: number
  /** 行情日期（如净值日期/行情时间戳），未知为 null */
  date: string | null
  stale: boolean
}

export interface LivePositionRow {
  position: Position
  point: PositionPoint
  /** 当前市值 = 份额 × 现价 */
  value: number
  /** 浮动盈亏 = (现价 − 成本) × 份额 */
  pl: number
}

export interface LiveCashRow {
  account: CashAccount
  point: CashPoint
}

export interface LiveSummary {
  positions: LivePositionRow[]
  /** 有持仓记录点但拿不到现价的持仓 id（UI 提示行情未更新） */
  positionsMissingPrice: string[]
  accounts: LiveCashRow[]
  totals: {
    /** 持仓市值（只含有价部分） */
    holdings: number
    cash: number
    assets: number
    /** 持仓浮动盈亏合计（现金不计） */
    pl: number
  }
}

/** 实时汇总：持仓用注入的最新现价，现金用最近余额 */
export function liveSummary(db: Database, quotes: Record<string, QuoteState>): LiveSummary {
  const positions: LivePositionRow[] = []
  const missing: string[] = []
  for (const pos of db.positions) {
    const point = latestPositionPoint(db, pos.id)
    if (!point) continue
    const quote = quotes[pos.id]
    if (!quote) {
      missing.push(pos.id)
      continue
    }
    positions.push({
      position: pos,
      point,
      value: point.shares * quote.price,
      pl: (quote.price - point.costPrice) * point.shares,
    })
  }
  const accounts: LiveCashRow[] = []
  for (const acc of db.accounts) {
    const point = latestCashPoint(db, acc.id)
    if (!point) continue
    accounts.push({ account: acc, point })
  }
  const holdings = positions.reduce((s, r) => s + r.value, 0)
  const cash = accounts.reduce((s, r) => s + r.point.balance, 0)
  const pl = positions.reduce((s, r) => s + r.pl, 0)
  return {
    positions,
    positionsMissingPrice: missing,
    accounts,
    totals: { holdings, cash, assets: holdings + cash, pl },
  }
}

export type BreakdownDimension = "owner" | "platform" | "kind"

export interface ShareSlice {
  label: string
  total: number
}

const KIND_LABEL: Record<InstrumentKind, string> = { fund: "基金", stock: "股票" }
export const CASH_LABEL = "现金"

/**
 * 当前占比：按维度聚合“实时”资产（持仓用注入现价，现金计入其所属维度）。
 * kind 维度下 基金/股票/现金 三大类；owner/platform 下现金账户按其标签归入。
 * 缺价的持仓不计入（调用方应保证 quotes 覆盖全部持仓，见行情层回退）。
 */
export function latestBreakdown(
  db: Database,
  quotes: Record<string, QuoteState>,
  dimension: BreakdownDimension
): ShareSlice[] {
  const totals = new Map<string, number>()
  const add = (label: string, value: number) => {
    if (value <= 0) return
    totals.set(label, (totals.get(label) ?? 0) + value)
  }
  for (const pos of db.positions) {
    const point = latestPositionPoint(db, pos.id)
    const quote = point ? quotes[pos.id] : undefined
    if (!point || !quote) continue
    const value = point.shares * quote.price
    const label =
      dimension === "owner" ? pos.owner : dimension === "platform" ? pos.platform : KIND_LABEL[pos.kind]
    add(label, value)
  }
  for (const acc of db.accounts) {
    const point = latestCashPoint(db, acc.id)
    if (!point) continue
    const label =
      dimension === "owner" ? acc.owner : dimension === "platform" ? acc.platform : CASH_LABEL
    add(label, point.balance)
  }
  return [...totals.entries()]
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total)
}
