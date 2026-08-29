import { useState } from "react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { deltaClass, formatYuan } from "@/components/SnapshotRow"
import {
  instrumentSeries,
  listInstruments,
  listSnapshots,
  holdingsOf,
  type Database,
} from "@/lib/snapshot-library"

const seriesConfig = {
  marketValue: { label: "市值", color: "var(--primary)" },
  cumulativeGain: { label: "累计收益", color: "var(--chart-2)" },
} satisfies ChartConfig

interface InstrumentsProps {
  db: Database
}

/** 标的视图：按代码（无代码按名称）归并，查看单个标的的跨快照走势 */
export function Instruments({ db }: InstrumentsProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const instruments = listInstruments(db)
  const latest = listSnapshots(db)[0]

  if (instruments.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>还没有标的</EmptyTitle>
          <EmptyDescription>录入持仓后，这里能看到每只基金/股票的走势</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const selected = instruments.find(
    (i) => (i.code || i.name) === selectedKey
  )
  const chartData = selectedKey ? instrumentSeries(db, selectedKey) : []

  return (
    <div className={selected ? "flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start" : "flex flex-col gap-4"}>
      <div className="flex flex-col divide-y rounded-lg border">
        {instruments.map((instrument) => {
          const key = instrument.code || instrument.name
          const latestHoldings = latest
            ? holdingsOf(db, latest.id).filter(
                (h) => (h.code || h.name) === key
              )
            : []
          const latestTotal = latestHoldings.reduce((sum, h) => sum + h.marketValue, 0)
          const latestGain = latestHoldings.reduce((sum, h) => sum + h.cumulativeGain, 0)
          return (
            <button
              key={key}
              className="flex items-center justify-between px-4 py-3 text-left hover:bg-muted/50"
              onClick={() => setSelectedKey(key === selectedKey ? null : key)}
            >
              <span>
                <span className="font-medium">{instrument.name}</span>
                {instrument.code && (
                  <span className="text-muted-foreground ml-1 text-xs">{instrument.code}</span>
                )}
              </span>
              <span className="flex items-baseline gap-2">
                <span>{formatYuan(latestTotal)}</span>
                <span className={`text-sm ${deltaClass(latestGain)}`}>
                  {latestGain > 0 ? "+" : ""}
                  {formatYuan(latestGain)}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {selected.name}
              <span className="text-muted-foreground text-sm font-normal">{selected.code}</span>
            </CardTitle>
            <CardDescription>跨快照走势（同代码跨平台/跨人已合并）</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={seriesConfig} className="h-56 w-full">
              <LineChart data={chartData} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={48} />
                <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                <Line dataKey="marketValue" type="monotone" stroke="var(--color-marketValue)" dot />
                <Line
                  dataKey="cumulativeGain"
                  type="monotone"
                  stroke="var(--color-cumulativeGain)"
                  dot
                />
              </LineChart>
            </ChartContainer>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setSelectedKey(null)}>
              收起走势
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
