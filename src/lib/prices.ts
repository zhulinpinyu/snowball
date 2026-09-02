/**
 * prices —— 行情/标的信息适配层（ADR 0003）。
 *
 * 纯前端直连（实测 Access-Control-Allow-Origin: *）：
 * - 场外基金：天天基金移动端接口 fundmobapi …FundMNNBasicInformation（名称+单位净值+净值日期）
 *   兜底：腾讯 qt.gtimg.cn/q=s_jj{code}
 * - A股股票：腾讯 qt.gtimg.cn/q=sh|sz{code}（GBK，需 TextDecoder("gbk")）
 *   兜底：东财 push2.eastmoney.com/api/qt/stock/get（价格 ×100）
 * UI 与领域核心不直连本模块之外的网络细节；解析函数独立导出以便单测。
 */

import type { InstrumentKind } from "./ledger"

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

const DEFAULT_FETCH: FetchLike = (input, init) => fetch(input, init)

const FUND_MOBI_URL = (code: string) =>
  `https://fundmobapi.eastmoney.com/FundMNewApi/FundMNNBasicInformation?FCODE=${code}&deviceid=Wap&plat=Android&product=EFund&version=1`
const QT_FUND_URL = (code: string) => `https://qt.gtimg.cn/q=s_jj${code}`
const QT_STOCK_URL = (market: "sh" | "sz", code: string) => `https://qt.gtimg.cn/q=${market}${code}`
const PUSH2_STOCK_URL = (market: "sh" | "sz", code: string) =>
  `https://push2.eastmoney.com/api/qt/stock/get?secid=${market === "sh" ? "1" : "0"}.${code}&fields=f43,f57,f58,f86`

/** A股行情前缀推断：6/5/9 → 沪，0/1/2/3 → 深；其余（如基金、北交所）不适用 */
export function stockMarketOf(code: string): "sh" | "sz" | null {
  if (/^[569]\d{5}$/.test(code)) return "sh"
  if (/^[0123]\d{5}$/.test(code)) return "sz"
  return null
}

export class NotFoundError extends Error {}
export class QuoteUnavailableError extends Error {}

export interface QuoteData {
  name: string
  /** 现价（基金=单位净值）；源返回空时为 null */
  price: number | null
  /** 行情日期（YYYY-MM-DD）；未知为 null */
  date: string | null
}

/** 解析 fundmobapi 响应：{Datas:[{SHORTNAME,DWJZ,FSRQ}]}；非基金（空/缺名）返回 null */
export function parseFundMobiJson(raw: unknown): QuoteData | null {
  const datas = (raw as { Datas?: unknown })?.Datas
  const first = Array.isArray(datas) ? (datas[0] as Record<string, unknown> | undefined) : undefined
  if (!first) return null
  const name = typeof first.SHORTNAME === "string" ? first.SHORTNAME.trim() : ""
  if (!name) return null
  const nav = Number(first.DWJZ)
  const date = typeof first.FSRQ === "string" ? first.FSRQ : null
  return { name, price: Number.isFinite(nav) && nav > 0 ? nav : null, date }
}

/** 解析腾讯基金 s_jj 行：0代码~1名称~2日期(YYYYMMDD)~3单位净值~… */
export function parseQtFundText(text: string): QuoteData | null {
  const m = /="([^"]*)"/.exec(text)
  const parts = m?.[1]?.split("~") ?? []
  const name = parts[1]?.trim()
  if (!name) return null
  const price = Number(parts[3])
  const date = /^\d{8}$/.test(parts[2] ?? "") ? formatDate8(parts[2]) : null
  return { name, price: Number.isFinite(price) && price > 0 ? price : null, date }
}

/** 解析腾讯股票行 v_sh600000="1~名称~代码~现价~…"（~分割：1名称/3现价/30时间戳YYYYMMDDHHMMSS） */
export function parseQtStockText(text: string): QuoteData | null {
  const m = /="([^"]*)"/.exec(text)
  const parts = m?.[1]?.split("~") ?? []
  const name = parts[1]?.trim()
  if (!name) return null
  const price = Number(parts[3])
  const stamp = parts[30] ?? ""
  const date = /^\d{14}$/.test(stamp) ? formatDate8(stamp.slice(0, 8)) : null
  return { name, price: Number.isFinite(price) && price > 0 ? price : null, date }
}

/** 解析东财 push2 响应：{data:{f57代码,f58名称,f43现价×100,f86时间戳}} */
export function parsePush2Json(raw: unknown): QuoteData | null {
  const data = (raw as { data?: Record<string, unknown> })?.data
  const name = typeof data?.f58 === "string" ? (data.f58 as string).trim() : ""
  if (!name) return null
  const scaled = Number(data?.f43)
  const ts = Number(data?.f86)
  const date = Number.isFinite(ts) && ts > 0 ? new Date(ts * 1000).toISOString().slice(0, 10) : null
  return { name, price: Number.isFinite(scaled) && scaled > 0 ? scaled / 100 : null, date }
}

function formatDate8(yyyymmdd: string): string {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`
}

async function asText(res: Response): Promise<string> {
  // 腾讯返回 GBK 字节
  return new TextDecoder("gbk").decode(await res.arrayBuffer())
}

/** 场外基金：名称 + 最新单位净值 + 净值日期（fundmobapi 为主，腾讯 s_jj 兜底） */
export async function fundQuote(code: string, fetchImpl: FetchLike = DEFAULT_FETCH): Promise<QuoteData> {
  let primaryErr: unknown
  try {
    const res = await fetchImpl(FUND_MOBI_URL(code))
    if (!res.ok) throw new QuoteUnavailableError(`行情接口 HTTP ${res.status}`)
    const hit = parseFundMobiJson(await res.json())
    if (hit) return hit
  } catch (err) {
    primaryErr = err
  }
  try {
    const res = await fetchImpl(QT_FUND_URL(code))
    if (!res.ok) throw new QuoteUnavailableError(`行情接口 HTTP ${res.status}`)
    const hit = parseQtFundText(await asText(res))
    if (hit) return hit
  } catch {
    /* 双源都失败，抛下面的原始错误 */
  }
  throw primaryErr instanceof Error ? primaryErr : new NotFoundError(`查无基金 ${code}`)
}

/** A股：名称 + 最新价（腾讯 qt.gtimg 为主，东财 push2 兜底） */
export async function stockQuote(
  code: string,
  market: "sh" | "sz",
  fetchImpl: FetchLike = DEFAULT_FETCH
): Promise<QuoteData> {
  let primaryErr: unknown
  try {
    const res = await fetchImpl(QT_STOCK_URL(market, code))
    if (!res.ok) throw new QuoteUnavailableError(`行情接口 HTTP ${res.status}`)
    const hit = parseQtStockText(await asText(res))
    if (hit) return hit
  } catch (err) {
    primaryErr = err
  }
  try {
    const res = await fetchImpl(PUSH2_STOCK_URL(market, code))
    if (!res.ok) throw new QuoteUnavailableError(`行情接口 HTTP ${res.status}`)
    const hit = parsePush2Json(await res.json())
    if (hit) return hit
  } catch {
    /* 双源都失败，抛下面的原始错误 */
  }
  throw primaryErr instanceof Error ? primaryErr : new NotFoundError(`查无股票 ${code}`)
}

export interface InstrumentHit {
  kind: InstrumentKind
  name: string
  market?: "sh" | "sz"
  /** 命中时顺手取得的现价（可能为 null） */
  price: number | null
  /** 行情日期 YYYY-MM-DD */
  date: string | null
}

/**
 * 添加标的口：输入 6 位代码 → 并行查 场外基金 + A股（若前缀可判），返回命中的候选。
 * 返回多条（如 000001 既是基金又是股票）时由 UI 让用户选择。
 */
export async function lookupInstrument(
  code: string,
  fetchImpl: FetchLike = DEFAULT_FETCH
): Promise<InstrumentHit[]> {
  const market = stockMarketOf(code)
  const tasks: Promise<InstrumentHit | null>[] = [
    fundQuote(code, fetchImpl).then((q) =>
      q ? { kind: "fund" as const, name: q.name, price: q.price, date: q.date } : null
    ),
  ]
  if (market) {
    tasks.push(
      stockQuote(code, market, fetchImpl).then((q) =>
        q ? { kind: "stock" as const, name: q.name, market, price: q.price, date: q.date } : null
      )
    )
  }
  const settled = await Promise.allSettled(tasks)
  const hits = settled
    .filter((r): r is PromiseFulfilledResult<InstrumentHit | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((h): h is InstrumentHit => h !== null)
  if (hits.length === 0) {
    throw new NotFoundError(`没有找到代码 ${code} 对应的基金或股票`)
  }
  return hits
}
