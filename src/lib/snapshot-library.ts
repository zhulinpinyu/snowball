/**
 * 快照库 —— Snowball 的领域核心（纯函数模块）。
 *
 * 领域概念见 CONTEXT.md：快照、持仓记录、标的、所属人、平台、资产类型、累计收益。
 * 所有函数均为纯函数：接收 Database，返回新的 Database，不修改入参。
 */

export type TagKind = "owners" | "platforms" | "assetTypes"

/** 标签类别 → 持仓记录字段名 */
export const TAG_KIND_TO_HOLDING_FIELD: Record<TagKind, "owner" | "platform" | "assetType"> = {
  owners: "owner",
  platforms: "platform",
  assetTypes: "assetType",
}

export interface Snapshot {
  id: string
  /** 快照日期，格式 YYYY-MM-DD */
  date: string
}

/** 标的代码：基金 6 位代码、股票代码等，仅作唯一标识，不用于拉取行情（ADR 0001） */
export interface Holding {
  id: string
  snapshotId: string
  /** 标的名称 */
  name: string
  /** 标的代码 */
  code: string
  /** 资产类型标签，如 基金/股票 */
  assetType: string
  /** 所属人标签 */
  owner: string
  /** 平台标签，如 支付宝/微信/雪球 */
  platform: string
  /** 当前市值（元），从所属 App 抄录 */
  marketValue: number
  /** 累计收益（元），从所属 App 抄录，正为赚负为亏 */
  cumulativeGain: number
}

export type NewHolding = Omit<Holding, "id" | "snapshotId">

export interface Database {
  snapshots: Snapshot[]
  holdings: Holding[]
  owners: string[]
  platforms: string[]
  assetTypes: string[]
}

export function emptyDatabase(): Database {
  return {
    snapshots: [],
    holdings: [],
    owners: [],
    platforms: [],
    assetTypes: [],
  }
}

function newId(): string {
  // randomUUID 仅在安全上下文（https / localhost）可用；
  // 局域网 http 或部分微信内核里没有，降级到时间戳+随机数
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** 新建一张快照（一个日期），返回新库 */
export function addSnapshot(db: Database, date: string): Database {
  return { ...db, snapshots: [...db.snapshots, { id: newId(), date }] }
}

/** 修改快照日期 */
export function updateSnapshot(db: Database, snapshotId: string, date: string): Database {
  return {
    ...db,
    snapshots: db.snapshots.map((s) => (s.id === snapshotId ? { ...s, date } : s)),
  }
}

/** 删除快照时，其下持仓记录一并删除 */
export function deleteSnapshot(db: Database, snapshotId: string): Database {
  return {
    ...db,
    snapshots: db.snapshots.filter((s) => s.id !== snapshotId),
    holdings: db.holdings.filter((h) => h.snapshotId !== snapshotId),
  }
}

/** 快照列表，按日期倒序（最新在前） */
export function listSnapshots(db: Database): Snapshot[] {
  return [...db.snapshots].sort((a, b) => b.date.localeCompare(a.date))
}

/** 向某张快照添加一条持仓记录 */
export function addHolding(db: Database, snapshotId: string, holding: NewHolding): Database {
  return {
    ...db,
    holdings: [...db.holdings, { ...holding, id: newId(), snapshotId }],
  }
}

/** 修改持仓记录（部分字段），用于事后修正抄录数字 */
export function updateHolding(
  db: Database,
  holdingId: string,
  patch: Partial<Omit<Holding, "id" | "snapshotId">>
): Database {
  return {
    ...db,
    holdings: db.holdings.map((h) => (h.id === holdingId ? { ...h, ...patch } : h)),
  }
}

/** 删除一条持仓记录 */
export function deleteHolding(db: Database, holdingId: string): Database {
  return { ...db, holdings: db.holdings.filter((h) => h.id !== holdingId) }
}

/** 取某张快照下的全部持仓 */
export function holdingsOf(db: Database, snapshotId: string): Holding[] {
  return db.holdings.filter((h) => h.snapshotId === snapshotId)
}

/** 新增标签（所属人/平台/资产类型） */
export function addTag(db: Database, kind: TagKind, label: string): Database {
  if (db[kind].includes(label)) return db
  return { ...db, [kind]: [...db[kind], label] }
}

/** 删除未被持仓引用的标签；仍被引用则拒绝 */
export function deleteTag(db: Database, kind: TagKind, label: string): Database {
  const field = TAG_KIND_TO_HOLDING_FIELD[kind]
  const inUse = db.holdings.some((h) => h[field] === label)
  if (inUse) {
    throw new Error(`标签「${label}」仍被持仓记录引用，无法删除`)
  }
  return { ...db, [kind]: db[kind].filter((l) => l !== label) }
}

export interface TotalAssetsPoint {
  snapshotId: string
  date: string
  total: number
}

/** 家庭总资产序列：按快照日期升序，总额为各持仓市值之和 */
export function totalAssetsSeries(db: Database): TotalAssetsPoint[] {
  return [...db.snapshots]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => ({
      snapshotId: s.id,
      date: s.date,
      total: db.holdings
        .filter((h) => h.snapshotId === s.id)
        .reduce((sum, h) => sum + h.marketValue, 0),
    }))
}

export interface SnapshotSummary extends TotalAssetsPoint {
  /** 较上一期快照的总资产涨跌额；第一期无涨跌 */
  delta: number | null
}

/** 快照摘要列表（最新在前），含每期总额与较上期涨跌 */
export function snapshotSummaries(db: Database): SnapshotSummary[] {
  const series = totalAssetsSeries(db)
  return [...series]
    .reverse()
    .map((point, i) => {
      const prev = series.length - 1 - i - 1
      return { ...point, delta: prev >= 0 ? point.total - series[prev].total : null }
    })
}

export type BreakdownDimension = "owner" | "platform" | "assetType"

export interface ShareSlice {
  label: string
  total: number
}

/** 占比聚合：某快照内按维度汇总持仓市值，降序；不指定快照则取最新一张 */
export function sharesByDimension(
  db: Database,
  dimension: BreakdownDimension,
  snapshotId?: string
): ShareSlice[] {
  const target =
    snapshotId ?? [...db.snapshots].sort((a, b) => b.date.localeCompare(a.date))[0]?.id
  if (!target) return []
  const totals = new Map<string, number>()
  for (const h of db.holdings) {
    if (h.snapshotId !== target) continue
    totals.set(h[dimension], (totals.get(h[dimension]) ?? 0) + h.marketValue)
  }
  return [...totals.entries()]
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total)
}

export interface InstrumentPoint {
  date: string
  marketValue: number
  cumulativeGain: number
}

/** 标的归并键：优先代码，无代码用名称 */
function instrumentKeyOf(h: Holding): string {
  return h.code || h.name
}

/** 单个标的跨快照走势：同代码（或同名称）持仓按快照求和，日期升序 */
export function instrumentSeries(db: Database, key: string): InstrumentPoint[] {
  return totalAssetsPointsBySnapshot(db).map((s) => {
    const matched = db.holdings.filter(
      (h) => h.snapshotId === s.snapshotId && instrumentKeyOf(h) === key
    )
    return {
      date: s.date,
      marketValue: matched.reduce((sum, h) => sum + h.marketValue, 0),
      cumulativeGain: matched.reduce((sum, h) => sum + h.cumulativeGain, 0),
    }
  })
}

/** 全部标的（去重），名称取最近一次出现的 */
export function listInstruments(db: Database): { code: string; name: string }[] {
  const byKey = new Map<string, { code: string; name: string }>()
  for (const s of totalAssetsPointsBySnapshot(db)) {
    for (const h of db.holdings.filter((h) => h.snapshotId === s.snapshotId)) {
      byKey.set(instrumentKeyOf(h), { code: h.code, name: h.name })
    }
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))
}

function totalAssetsPointsBySnapshot(db: Database): TotalAssetsPoint[] {
  return totalAssetsSeries(db)
}
