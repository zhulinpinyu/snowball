import { SnowflakeIcon } from "lucide-react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { SnapshotRow, deltaClass, formatYuan } from "@/components/SnapshotRow"
import { snapshotSummaries, type Database, type SnapshotSummary } from "@/lib/snapshot-library"

const trendConfig = {
  total: { label: "总资产", color: "var(--primary)" },
} satisfies ChartConfig

interface OverviewProps {
  db: Database
  onOpenSnapshot: (id: string) => void
  onUpdate: (fn: (db: Database) => Database) => Database | void
}

/** 主视图：家庭总资产趋势 + 快照列表（较上期涨跌） */
export function Overview({ db, onOpenSnapshot, onUpdate }: OverviewProps) {
  const summaries = snapshotSummaries(db)

  if (summaries.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SnowflakeIcon />
          </EmptyMedia>
          <EmptyTitle>还没有快照</EmptyTitle>
          <EmptyDescription>去「快照」页新建第一张快照吧</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const latest = summaries[0]
  const chartData = [...summaries].reverse().map((s) => ({ date: s.date, total: s.total }))

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[3fr,2fr] lg:items-start">
      <Card>
        <CardHeader>
          <CardTitle>家庭总资产</CardTitle>
          <CardDescription>
            截至 {latest.date}：{formatYuan(latest.total)} 元
            {latest.delta !== null && (
              <span className={deltaClass(latest.delta)}>
                （较上期 {latest.delta > 0 ? "+" : ""}
                {formatYuan(latest.delta)}）
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={trendConfig} className="h-56 w-full">
            <LineChart data={chartData} margin={{ left: 8, right: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={48} />
              <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
              <Line dataKey="total" type="monotone" stroke="var(--color-total)" dot />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="flex flex-col divide-y rounded-lg border">
        {summaries.map((s) => (
          <SummaryRow key={s.snapshotId} summary={s} onOpen={onOpenSnapshot} onUpdate={onUpdate} />
        ))}
      </div>
    </div>
  )
}

interface SummaryRowProps {
  summary: SnapshotSummary
  onOpen: (id: string) => void
  onUpdate: (fn: (db: Database) => Database) => void
}

function SummaryRow({ summary, onOpen, onUpdate }: SummaryRowProps) {
  return (
    <SnapshotRow
      snapshotId={summary.snapshotId}
      date={summary.date}
      title={summary.date}
      summary={`${formatYuan(summary.total)} 元`}
      delta={summary.delta}
      onOpen={() => onOpen(summary.snapshotId)}
      onUpdate={onUpdate}
    />
  )
}
