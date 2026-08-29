import { useEffect, useState } from "react"
import { ArrowLeftIcon, SnowflakeIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { HoldingFormDialog } from "@/components/HoldingFormDialog"
import { NewSnapshotDialog } from "@/components/NewSnapshotDialog"
import { holdingsOf, listSnapshots, type Holding } from "@/lib/snapshot-library"
import { useDatabase } from "@/lib/use-database"

/** 红涨绿跌（国内习惯）：赚为红、亏为绿 */
function gainClass(gain: number): string {
  if (gain > 0) return "text-red-600"
  if (gain < 0) return "text-emerald-600"
  return "text-muted-foreground"
}

function formatYuan(n: number): string {
  return n.toLocaleString("zh-CN", { maximumFractionDigits: 2 })
}

export default function App() {
  const { db, update } = useDatabase()
  const [viewingId, setViewingId] = useState<string | null>(null)

  const snapshots = listSnapshots(db)
  const viewing = snapshots.find((s) => s.id === viewingId) ?? null

  // 快照被删（如数据被导入覆盖）时回到列表
  useEffect(() => {
    if (viewingId && !viewing) setViewingId(null)
  }, [viewingId, viewing])

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        {viewing ? (
          <Button variant="ghost" size="sm" onClick={() => setViewingId(null)}>
            <ArrowLeftIcon data-icon="inline-start" />
            返回
          </Button>
        ) : (
          <>
            <SnowflakeIcon data-icon="inline-start" className="text-muted-foreground" />
            <h1 className="text-lg font-semibold">家庭资产账本</h1>
          </>
        )}
        {viewing && <h1 className="text-lg font-semibold">{viewing.date} 快照</h1>}
      </header>

      <main className="flex flex-1 flex-col px-4 py-4">
        {viewing ? (
          <SnapshotDetail snapshotId={viewing.id} db={db} onUpdate={update} />
        ) : (
          <SnapshotList
            snapshotDates={snapshots.map((s) => ({ id: s.id, date: s.date }))}
            countOf={(id) => holdingsOf(db, id).length}
            onOpen={setViewingId}
            onCreate={(fn) => update(fn)}
          />
        )}
      </main>
    </div>
  )
}

interface SnapshotListProps {
  snapshotDates: { id: string; date: string }[]
  countOf: (id: string) => number
  onOpen: (id: string) => void
  onCreate: (fn: Parameters<ReturnType<typeof useDatabase>["update"]>[0]) => void
}

function SnapshotList({ snapshotDates, countOf, onOpen, onCreate }: SnapshotListProps) {
  if (snapshotDates.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SnowflakeIcon />
          </EmptyMedia>
          <EmptyTitle>还没有快照</EmptyTitle>
          <EmptyDescription>新建第一张快照，把各平台里的基金、股票抄录进来吧</EmptyDescription>
        </EmptyHeader>
        <NewSnapshotDialog onCreate={onCreate} />
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <NewSnapshotDialog onCreate={onCreate} />
      <div className="flex flex-col divide-y rounded-lg border">
        {snapshotDates.map((s) => (
          <button
            key={s.id}
            className="flex items-center justify-between px-4 py-3 text-left hover:bg-muted/50"
            onClick={() => onOpen(s.id)}
          >
            <span className="font-medium">{s.date}</span>
            <span className="text-muted-foreground text-sm">{countOf(s.id)} 条持仓</span>
          </button>
        ))}
      </div>
    </div>
  )
}

interface SnapshotDetailProps {
  snapshotId: string
  db: ReturnType<typeof useDatabase>["db"]
  onUpdate: (fn: Parameters<ReturnType<typeof useDatabase>["update"]>[0]) => void
}

function SnapshotDetail({ snapshotId, db, onUpdate }: SnapshotDetailProps) {
  const holdings = holdingsOf(db, snapshotId)
  const totalValue = holdings.reduce((sum, h) => sum + h.marketValue, 0)
  const totalGain = holdings.reduce((sum, h) => sum + h.cumulativeGain, 0)

  return (
    <div className="flex flex-col gap-4">
      <HoldingFormDialog snapshotId={snapshotId} db={db} onUpdate={onUpdate} />
      {holdings.length > 0 && (
        <>
          <div className="flex gap-2 text-sm">
            <span className="text-muted-foreground">总市值</span>
            <span className="font-semibold">{formatYuan(totalValue)}</span>
            <span className="text-muted-foreground">总收益</span>
            <span className={`font-semibold ${gainClass(totalGain)}`}>
              {totalGain > 0 ? "+" : ""}
              {formatYuan(totalGain)}
            </span>
          </div>
          <HoldingTable holdings={holdings} />
        </>
      )}
    </div>
  )
}

function HoldingTable({ holdings }: { holdings: Holding[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>标的</TableHead>
          <TableHead>谁/哪</TableHead>
          <TableHead className="text-right">市值</TableHead>
          <TableHead className="text-right">累计收益</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {holdings.map((h) => (
          <TableRow key={h.id}>
            <TableCell>
              <div className="font-medium">{h.name}</div>
              {h.code && <div className="text-muted-foreground text-xs">{h.code}</div>}
            </TableCell>
            <TableCell>
              <div className="text-sm">{h.owner}</div>
              <div className="text-muted-foreground text-xs">
                {h.platform} · {h.assetType}
              </div>
            </TableCell>
            <TableCell className="text-right">{formatYuan(h.marketValue)}</TableCell>
            <TableCell className={`text-right font-medium ${gainClass(h.cumulativeGain)}`}>
              {h.cumulativeGain > 0 ? "+" : ""}
              {formatYuan(h.cumulativeGain)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
