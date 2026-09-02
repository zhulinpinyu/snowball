import { useCallback, useEffect, useRef, useState } from "react"
import { latestPositionPoint, type Database } from "./ledger"
import { fundQuote, stockQuote, stockMarketOf, type QuoteData } from "./prices"

/** UI 层行情视图：price 一定有值（失败时回退到上次记录价/成本价并标记 stale） */
export interface QuoteView extends QuoteData {
  price: number
  stale: boolean
}

/**
 * 实时行情：为每个持仓拉一次现价。
 * 单个持仓拉取失败时回退到 该持仓最近记录点里存的价格（再没有就沿用上次成功的价），
 * 并标记 stale=true（对应 ADR 0002 的降级策略：断网不阻断查看）。
 * 仅在持仓集合（增删/代码变化）时自动重拉；份额/成本等记录变化不触发。
 */
export function useQuotes(db: Database) {
  const dbRef = useRef(db)
  useEffect(() => {
    dbRef.current = db
  })
  const quotesRef = useRef<Record<string, QuoteView>>({})
  const [quotes, setQuotes] = useState<Record<string, QuoteView>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const sig = db.positions.map((p) => `${p.id}|${p.kind}|${p.code}`).join(";")

  const refresh = useCallback(async () => {
    const positions = dbRef.current.positions
    if (positions.length === 0) {
      quotesRef.current = {}
      setQuotes({})
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    let failed = 0
    const next: Record<string, QuoteView> = {}
    for (const pos of positions) {
      const prev = quotesRef.current[pos.id]
      let view: QuoteView | null = null
      try {
        const q =
          pos.kind === "fund"
            ? await fundQuote(pos.code)
            : await stockQuote(pos.code, stockMarketOf(pos.code) ?? "sh")
        if (q.price !== null) {
          view = { name: q.name, price: q.price, date: q.date, stale: false }
        }
      } catch {
        // 掉到下面的回退
      }
      if (!view) {
        const fallback = fallbackPrice(dbRef.current, pos.id)
        if (fallback !== null) {
          view = { name: pos.name, price: fallback, date: null, stale: true }
        } else if (prev) {
          view = { ...prev, stale: true }
        }
        failed++
      }
      if (view) next[pos.id] = view
    }
    quotesRef.current = next
    setQuotes(next)
    setLoading(false)
    if (failed > 0) setError(failed === positions.length ? "行情不可用，按上次记录价显示" : "部分行情未更新")
  }, [])

  useEffect(() => {
    void refresh()
  }, [sig, refresh])

  return { quotes, loading, error, refresh }
}

/** 回退价：最近记录点里存的记录价；没有再取成本价 */
function fallbackPrice(db: Database, positionId: string): number | null {
  const point = latestPositionPoint(db, positionId)
  if (!point) return null
  return point.priceAtRecord ?? point.costPrice
}
