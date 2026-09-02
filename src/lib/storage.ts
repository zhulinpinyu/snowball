import { emptyDatabase, type Database, type Instrument, type InstrumentKind } from "./ledger"

export const STORAGE_KEY = "snowball:database"

interface V2Database {
  positions: {
    id: string
    code: string
    name: string
    kind: InstrumentKind
    owner: string
    platform: string
  }[]
  accounts: Database["accounts"]
  positionPoints: Database["positionPoints"]
  cashPoints: Database["cashPoints"]
  owners: string[]
  platforms: string[]
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}
function isStr(v: unknown): v is string {
  return typeof v === "string"
}
function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v)
}
function isKind(v: unknown): boolean {
  return v === "fund" || v === "stock"
}
function isStringArray(a: unknown): boolean {
  return Array.isArray(a) && a.every(isStr)
}

/** 逐条校验，避免"形似"但字段缺失/类型错的数据导入后让界面崩 */
function validInstruments(a: unknown): boolean {
  return (
    Array.isArray(a) &&
    a.every((x) => isRecord(x) && isStr(x.id) && isStr(x.code) && isStr(x.name) && isKind(x.kind))
  )
}
function validPositions(a: unknown): boolean {
  return (
    Array.isArray(a) &&
    a.every((x) => isRecord(x) && isStr(x.id) && isStr(x.code) && isStr(x.name) && isKind(x.kind) && isStr(x.owner) && isStr(x.platform))
  )
}
function validAccounts(a: unknown): boolean {
  return (
    Array.isArray(a) &&
    a.every((x) => isRecord(x) && isStr(x.id) && isStr(x.name) && isStr(x.owner) && isStr(x.platform))
  )
}
function validPositionPoints(a: unknown): boolean {
  return (
    Array.isArray(a) &&
    a.every(
      (x) =>
        isRecord(x) &&
        isStr(x.id) &&
        isStr(x.positionId) &&
        isStr(x.date) &&
        isNum(x.shares) &&
        isNum(x.costPrice) &&
        (isNum(x.priceAtRecord) || x.priceAtRecord === null)
    )
  )
}
function validCashPoints(a: unknown): boolean {
  return (
    Array.isArray(a) &&
    a.every((x) => isRecord(x) && isStr(x.id) && isStr(x.accountId) && isStr(x.date) && isNum(x.balance))
  )
}

/**
 * 数据形状是否为 v1（Spec 0002）的库（含标的库 instruments），并逐条校验。
 * 更早 MVP 原型（snapshots/holdings 结构）不符合本形状，会被判无效。
 */
export function isValidDatabase(value: unknown): value is Database {
  if (!isRecord(value)) return false
  return (
    validInstruments(value.instruments) &&
    validPositions(value.positions) &&
    validAccounts(value.accounts) &&
    validPositionPoints(value.positionPoints) &&
    validCashPoints(value.cashPoints) &&
    isStringArray(value.owners) &&
    isStringArray(value.platforms)
  )
}

/** 是否是"还没有标的库"的旧形状（持仓内嵌 code/name/kind，无 instruments 字段） */
export function isLegacyV2(value: unknown): value is V2Database {
  if (!isRecord(value)) return false
  return (
    !Array.isArray(value.instruments) &&
    Array.isArray(value.positions) &&
    Array.isArray(value.accounts) &&
    Array.isArray(value.positionPoints) &&
    Array.isArray(value.cashPoints) &&
    isStringArray(value.owners) &&
    isStringArray(value.platforms) &&
    (value.positions as unknown[]).every(
      (p) =>
        isRecord(p) &&
        isStr(p.id) &&
        isStr(p.code) &&
        isStr(p.name) &&
        isKind(p.kind) &&
        isStr(p.owner) &&
        isStr(p.platform)
    )
  )
}

/** 从旧形状迁移：由持仓去重重建标的库，持仓数据原样保留 */
export function migrateLegacyV2(v2: V2Database): Database {
  const seen = new Map<string, Instrument>()
  for (const pos of v2.positions) {
    const key = `${pos.kind}:${pos.code}`
    if (!seen.has(key)) {
      seen.set(key, {
        id: `inst-${seen.size + 1}`,
        code: pos.code,
        name: pos.name,
        kind: pos.kind,
      })
    }
  }
  return {
    instruments: [...seen.values()],
    positions: v2.positions,
    accounts: v2.accounts,
    positionPoints: v2.positionPoints,
    cashPoints: v2.cashPoints,
    owners: v2.owners,
    platforms: v2.platforms,
  }
}

/** 将整个库保存到 localStorage（单键存储） */
export function saveDatabase(ls: Storage, db: Database): void {
  ls.setItem(STORAGE_KEY, JSON.stringify(db))
}

/** 从 localStorage 加载库；旧形状自动迁移；其他损坏/更旧数据返回空库 */
export function loadDatabase(ls: Storage): Database {
  const raw = ls.getItem(STORAGE_KEY)
  if (!raw) return emptyDatabase()
  try {
    const parsed: unknown = JSON.parse(raw)
    if (isValidDatabase(parsed)) {
      return parsed
    }
    if (isLegacyV2(parsed)) {
      return migrateLegacyV2(parsed)
    }
  } catch {
    // 数据损坏则回到空库
  }
  return emptyDatabase()
}
