import { useState } from "react"
import { Pie, PieChart } from "recharts"
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChartPieIcon } from "lucide-react"
import { formatYuan } from "@/lib/format"
import {
  CASH_LABEL,
  latestBreakdown,
  type BreakdownDimension,
  type Database,
} from "@/lib/ledger"
import type { QuoteView } from "@/lib/use-quotes"

const DIMENSIONS: { value: BreakdownDimension; label: string }[] = [
  { value: "owner", label: "所属人" },
  { value: "platform", label: "平台" },
  { value: "kind", label: "类型" },
]

const SLICE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

interface BreakdownPageProps {
  db: Database
  quotes: Record<string, QuoteView>
  onGoRecord: () => void
}

/** 占比：按 所属人/平台/类型 聚合当前（实时）资产，点分块看明细 */
export function BreakdownPage({ db, quotes, onGoRecord }: BreakdownPageProps) {
  const [dimension, setDimension] = useState<BreakdownDimension>("owner")
  const [selected, setSelected] = useState<string | null>(null)

  const hasData = db.positions.length > 0 || db.accounts.length > 0
  if (!hasData) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ChartPieIcon />
          </EmptyMedia>
          <EmptyTitle>还没有数据</EmptyTitle>
          <EmptyDescription>添加持仓或现金账户后，这里能看到资产分布</EmptyDescription>
        </EmptyHeader>
        <Button onClick={onGoRecord}>去记一笔</Button>
      </Empty>
    )
  }

  const shares = latestBreakdown(db, quotes, dimension)
  const config = Object.fromEntries(
    shares.map((s, i) => [s.label, { label: s.label, color: SLICE_COLORS[i % SLICE_COLORS.length] }])
  ) satisfies ChartConfig
  const chartData = shares.map((s, i) => ({
    ...s,
    fill: SLICE_COLORS[i % SLICE_COLORS.length],
  }))

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        value={dimension}
        onValueChange={(v) => {
          setDimension(v as BreakdownDimension)
          setSelected(null)
        }}
      >
        <TabsList className="w-full">
          {DIMENSIONS.map((d) => (
            <TabsTrigger key={d.value} value={d.value} className="flex-1">
              {d.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>资产占比</CardTitle>
          <CardDescription>按最新实时行情计算，点击分块看明细</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ChartContainer config={config} className="mx-auto h-64 w-full">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Pie
                data={chartData}
                dataKey="total"
                nameKey="label"
                cx="50%"
                cy="50%"
                onClick={(slice) => {
                  const label = slice?.name as string | undefined
                  setSelected(label === selected ? null : (label ?? null))
                }}
                cursor="pointer"
              />
            </PieChart>
          </ChartContainer>
          <div className="mt-1 flex flex-wrap justify-center gap-2">
            {shares.map((s) => (
              <button
                key={s.label}
                type="button"
                className="text-sm"
                onClick={() => setSelected(s.label === selected ? null : s.label)}
              >
                <span
                  className="mr-1 inline-block size-2 rounded-full align-middle"
                  style={{ background: config[s.label].color }}
                />
                <span className={selected === s.label ? "font-semibold" : undefined}>
                  {s.label} · {formatYuan(s.total)}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle>「{selected}」的明细</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {detailRows(db, quotes, dimension, selected).map((row) => (
              <div key={row.id} className="flex items-center justify-between py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{row.name}</span>
                  {row.meta && <span className="text-muted-foreground ml-1 text-xs">{row.meta}</span>}
                </span>
                <span className="ml-2 shrink-0">{formatYuan(row.value)}</span>
              </div>
            ))}
            {detailRows(db, quotes, dimension, selected).length === 0 && (
              <p className="text-muted-foreground py-4 text-center text-sm">没有明细</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

interface DetailRow {
  id: string
  name: string
  meta: string
  value: number
}

function detailRows(
  db: Database,
  quotes: Record<string, QuoteView>,
  dimension: BreakdownDimension,
  label: string
): DetailRow[] {
  const rows: DetailRow[] = []
  const matchesPosition = (owner: string, platform: string, kind: string) =>
    dimension === "owner"
      ? owner === label
      : dimension === "platform"
        ? platform === label
        : kind === label
  for (const pos of db.positions) {
    const kindLabel = pos.kind === "fund" ? "基金" : "股票"
    if (!matchesPosition(pos.owner, pos.platform, kindLabel)) continue
    const point = latestPointOf(db, pos.id)
    const q = point ? quotes[pos.id] : undefined
    if (!point || !q) continue
    rows.push({ id: pos.id, name: pos.name, meta: pos.code, value: point.shares * q.price })
  }
  for (const acc of db.accounts) {
    if (!matchesPosition(acc.owner, acc.platform, CASH_LABEL)) continue
    const point = latestCashOf(db, acc.id)
    if (!point) continue
    rows.push({ id: acc.id, name: acc.name, meta: `${acc.owner} · ${acc.platform}`, value: point.balance })
  }
  return rows.sort((a, b) => b.value - a.value)
}

function latestPointOf(db: Database, positionId: string) {
  return db.positionPoints
    .filter((p) => p.positionId === positionId)
    .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
}

function latestCashOf(db: Database, accountId: string) {
  return db.cashPoints
    .filter((p) => p.accountId === accountId)
    .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
}
