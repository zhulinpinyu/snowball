import { useState } from "react"
import { Pie, PieChart } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatYuan } from "@/components/SnapshotRow"
import {
  holdingsOf,
  listSnapshots,
  sharesByDimension,
  type BreakdownDimension,
  type Database,
} from "@/lib/snapshot-library"

const DIMENSIONS: { value: BreakdownDimension; label: string }[] = [
  { value: "owner", label: "所属人" },
  { value: "platform", label: "平台" },
  { value: "assetType", label: "类型" },
]

const SLICE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

interface BreakdownProps {
  db: Database
  onOpenSnapshot?: (id: string) => void
}

/** 占比视图：最新快照按维度汇总的饼图，点选分块下钻看明细持仓 */
export function Breakdown({ db }: BreakdownProps) {
  const [dimension, setDimension] = useState<BreakdownDimension>("owner")
  const [selected, setSelected] = useState<string | null>(null)

  const latest = listSnapshots(db)[0]
  const shares = sharesByDimension(db, dimension)
  const config = Object.fromEntries(
    shares.map((s, i) => [s.label, { label: s.label, color: SLICE_COLORS[i % SLICE_COLORS.length] }])
  ) satisfies ChartConfig
  const chartData = shares.map((s, i) => ({
    ...s,
    fill: SLICE_COLORS[i % SLICE_COLORS.length],
  }))
  const drillHoldings = latest
    ? holdingsOf(db, latest.id).filter((h) => h[dimension] === selected)
    : []

  if (!latest) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>还没有数据</EmptyTitle>
          <EmptyDescription>先去「快照」页录入持仓，这里就能看占比了</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

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
          <CardDescription>{latest.date} 快照，点击分块看明细</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ChartContainer config={config} className="mx-auto aspect-square max-h-64 w-full">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Pie
                data={chartData}
                dataKey="total"
                nameKey="label"
                onClick={(slice) => {
                  const label = slice?.name as string | undefined
                  setSelected(label === selected ? null : (label ?? null))
                }}
                cursor="pointer"
              />
            </PieChart>
          </ChartContainer>
          <div className="flex flex-wrap justify-center gap-2">
            {shares.map((s) => (
              <button
                key={s.label}
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
            <CardTitle>「{selected}」的持仓</CardTitle>
            <CardDescription>共 {drillHoldings.length} 条</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {drillHoldings.map((h) => (
              <div key={h.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  <span className="font-medium">{h.name}</span>
                  {h.code && <span className="text-muted-foreground ml-1 text-xs">{h.code}</span>}
                </span>
                <span className="flex gap-2">
                  <span>{formatYuan(h.marketValue)}</span>
                  <span className="text-muted-foreground">
                    {h.owner} · {h.platform}
                  </span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
