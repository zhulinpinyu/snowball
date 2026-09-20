import { describe, expect, it } from "vitest"
import { seedDemoDatabase } from "./demo"
import { valuationSeries } from "./ledger"

describe("演示数据（dev 预览用）", () => {
  it("生成一条跨 3 个月的每日曲线，且含中途的人工改动", () => {
    const db = seedDemoDatabase()
    const series = valuationSeries(db)

    // 6/30 起点 + 7~9 月每个交易日 → 应该有 50+ 个采样点
    expect(series.length).toBeGreaterThan(50)
    expect(series[0].date).toBe("2026-06-30")
    expect(series.at(-1)!.date).toBe("2026-09-18")
    // 约 25 万级别，且每天都不同（随机游走）
    expect(series[0].total).toBeGreaterThan(200000)
    const totals = new Set(series.map((s) => s.total))
    expect(totals.size).toBe(series.length)

    // 打印几行，便于人工核对
    for (const point of series.filter((_, i) => i % 10 === 0 || i === series.length - 1)) {
      console.log(point.date, Math.round(point.total), point.incomplete ? "(缺价)" : "")
    }
  })
})
