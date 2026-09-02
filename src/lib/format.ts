/** 红涨绿跌（国内习惯） */
export function deltaClass(delta: number | null): string {
  if (delta === null || delta === 0) return "text-muted-foreground"
  return delta > 0 ? "text-red-600" : "text-emerald-600"
}

export function formatYuan(n: number): string {
  return n.toLocaleString("zh-CN", { maximumFractionDigits: 2 })
}

/** 单价显示：保留尽可能多的小数（最多 8 位），不加千分位（基金净值可达 4 位以上） */
export function formatPrice(n: number): string {
  return n.toLocaleString("zh-CN", { maximumFractionDigits: 8, useGrouping: false })
}

/** 本地日期 YYYY-MM-DD（避免 toISOString 的时区偏移） */
export function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
