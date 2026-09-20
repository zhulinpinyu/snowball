import { TrendingUpIcon } from "lucide-react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { deltaClass, formatYuan, todayLocal } from "@/lib/format"
import { liveSummary, valuationSeries, type Database } from "@/lib/ledger"
import type { QuoteView } from "@/lib/use-quotes"

const trendConfig = {
  total: { label: "总资产", color: "var(--primary)" },
} satisfies ChartConfig

interface OverviewPageProps {
  db: Database
  quotes: Record<string, QuoteView>
  quoteError: string | null
  onGoRecord: () => void
}

interface ChartRow {
  /** YYYY-MM-DD，或「现在」 */
  date: string
  /** 时间轴用的毫秒时间戳（真实日期间距） */
  ts: number
  total: number
}

function dateToTs(date: string): number {
  const [y, m, d] = date.split("-").map(Number)
  return new Date(y, m - 1, d).getTime()
}

function formatTick(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** 总览：实时家庭总资产 + 合计浮动盈亏 + 记录点/每日快照驱动的估值曲线 */
export function OverviewPage({ db, quotes, quoteError, onGoRecord }: OverviewPageProps) {
  const series = valuationSeries(db)
  const live = liveSummary(db, quotes)

  if (series.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TrendingUpIcon />
          </EmptyMedia>
          <EmptyTitle>开始记第一笔</EmptyTitle>
          <EmptyDescription>
            添加基金/股票时输代码即可自动补名称和现价，记下份额与成本；现金账户随时改余额。
            之后每次刷新行情会自动记下当天的估值，攒出每天的总资产走势。
          </EmptyDescription>
        </EmptyHeader>
        <Button onClick={onGoRecord}>去记一笔</Button>
      </Empty>
    )
  }

  const anyStale = Object.values(quotes).some((q) => q.stale)
  const pl = live.totals.pl

  // 采样点按真实时间排布；今天已有采样点就用实时值更新它，否则在末尾追加「现在」
  const today = todayLocal()
  const chartData: ChartRow[] = series.map((s) => ({
    date: s.date,
    ts: dateToTs(s.date),
    total: s.total,
  }))
  const todayIdx = chartData.findIndex((d) => d.date === today)
  if (todayIdx >= 0) {
    chartData[todayIdx] = { ...chartData[todayIdx], total: live.totals.assets }
  } else if (chartData[chartData.length - 1].date < today) {
    chartData.push({ date: "现在", ts: dateToTs(today), total: live.totals.assets })
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-1 pt-6">
          <span className="text-muted-foreground text-sm">家庭总资产 · 实时行情</span>
          <span className="text-4xl font-semibold tracking-tight">
            <span className="text-2xl align-top text-muted-foreground">¥</span>
            {formatYuan(live.totals.assets)}
          </span>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span className="text-muted-foreground">
              持仓市值 {formatYuan(live.totals.holdings)}
              <span className={`ml-1 font-medium ${deltaClass(pl)}`}>
                {pl > 0 ? "+" : ""}
                {formatYuan(pl)}
              </span>
            </span>
            <span className="text-muted-foreground">现金 {formatYuan(live.totals.cash)}</span>
          </div>
          {anyStale && (
            <p className="text-amber-600 text-xs">
              部分行情未更新，按上次记录价估算（{quoteError ?? "行情获取失败"}）
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>家庭资产走势</CardTitle>
          <CardDescription>
            人工记录点 + 每日行情快照按真实日期连线（没打开过的日子不采样），末尾为实时值
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length >= 2 ? (
            <ChartContainer config={trendConfig} className="h-56 w-full">
              <LineChart data={chartData} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="ts"
                  type="number"
                  scale="time"
                  domain={["dataMin", "dataMax"]}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatTick}
                />
                <YAxis tickLine={false} axisLine={false} width={56} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      indicator="line"
                      labelFormatter={(_value, payload) =>
                        (payload?.[0]?.payload as ChartRow | undefined)?.date ?? ""
                      }
                    />
                  }
                />
                <Line dataKey="total" type="monotone" stroke="var(--color-total)" dot />
              </LineChart>
            </ChartContainer>
          ) : (
            <p className="text-muted-foreground py-8 text-center text-sm">
              只有一笔记录。刷新一次行情（或再记一次份额/余额）这里就会出现走势。
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
