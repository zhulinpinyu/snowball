import { useState } from "react"
import { ArrowLeftIcon, MoreVerticalIcon, SnowflakeIcon } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { HoldingFormDialog } from "@/components/HoldingFormDialog"
import { NewSnapshotDialog } from "@/components/NewSnapshotDialog"
import { Overview } from "@/components/Overview"
import { Breakdown } from "@/components/Breakdown"
import { Instruments } from "@/components/Instruments"
import { DataCard } from "@/components/DataCard"
import { SnapshotRow, deltaClass, formatYuan } from "@/components/SnapshotRow"
import { TagManager } from "@/components/TagManager"
import { deleteHolding, holdingsOf, listSnapshots, type Holding } from "@/lib/snapshot-library"
import { useDatabase } from "@/lib/use-database"

export default function App() {
  const { db, update, replace } = useDatabase()
  const [viewingId, setViewingId] = useState<string | null>(null)

  const snapshots = listSnapshots(db)
  const viewing = snapshots.find((s) => s.id === viewingId) ?? null

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

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-4">
        {viewing ? (
          <SnapshotDetail snapshotId={viewing.id} db={db} onUpdate={update} />
        ) : (
          <Tabs defaultValue="overview">
            <TabsList className="w-full">
              <TabsTrigger value="overview">总览</TabsTrigger>
              <TabsTrigger value="breakdown">占比</TabsTrigger>
              <TabsTrigger value="instruments">标的</TabsTrigger>
              <TabsTrigger value="snapshots">快照</TabsTrigger>
              <TabsTrigger value="settings">设置</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <Overview db={db} onOpenSnapshot={setViewingId} onUpdate={update} />
            </TabsContent>
            <TabsContent value="breakdown">
              <Breakdown db={db} />
            </TabsContent>
            <TabsContent value="instruments">
              <Instruments db={db} />
            </TabsContent>
            <TabsContent value="snapshots">
              <SnapshotList
                snapshots={snapshots}
                db={db}
                onOpen={setViewingId}
                onUpdate={update}
              />
            </TabsContent>
            <TabsContent value="settings">
              <div className="grid gap-4 md:grid-cols-2 md:items-start">
                <TagManager db={db} onUpdate={update} />
                <DataCard db={db} onReplace={replace} />
              </div>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  )
}

interface SnapshotListProps {
  snapshots: ReturnType<typeof listSnapshots>
  db: ReturnType<typeof useDatabase>["db"]
  onOpen: (id: string) => void
  onUpdate: (fn: (db: ReturnType<typeof useDatabase>["db"]) => ReturnType<typeof useDatabase>["db"]) => void
}

function SnapshotList({ snapshots, db, onOpen, onUpdate }: SnapshotListProps) {
  if (snapshots.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SnowflakeIcon />
          </EmptyMedia>
          <EmptyTitle>还没有快照</EmptyTitle>
          <EmptyDescription>新建第一张快照，把各平台里的基金、股票抄录进来吧</EmptyDescription>
        </EmptyHeader>
        <NewSnapshotDialog onCreate={onUpdate} />
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <NewSnapshotDialog onCreate={onUpdate} />
      <div className="flex flex-col divide-y rounded-lg border">
        {snapshots.map((s) => (
          <SnapshotRow
            key={s.id}
            snapshotId={s.id}
            date={s.date}
            title={s.date}
            summary={`${holdingsOf(db, s.id).length} 条持仓`}
            onOpen={() => onOpen(s.id)}
            onUpdate={onUpdate}
          />
        ))}
      </div>
    </div>
  )
}

interface SnapshotDetailProps {
  snapshotId: string
  db: ReturnType<typeof useDatabase>["db"]
  onUpdate: (fn: (db: ReturnType<typeof useDatabase>["db"]) => ReturnType<typeof useDatabase>["db"]) => void
}

function SnapshotDetail({ snapshotId, db, onUpdate }: SnapshotDetailProps) {
  const holdings = holdingsOf(db, snapshotId)
  const totalValue = holdings.reduce((sum, h) => sum + h.marketValue, 0)
  const totalGain = holdings.reduce((sum, h) => sum + h.cumulativeGain, 0)
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null)
  const [deletingHolding, setDeletingHolding] = useState<Holding | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <HoldingFormDialog snapshotId={snapshotId} db={db} onUpdate={onUpdate} />
      {holdings.length > 0 && (
        <>
          <div className="flex gap-2 text-sm">
            <span className="text-muted-foreground">总市值</span>
            <span className="font-semibold">{formatYuan(totalValue)}</span>
            <span className="text-muted-foreground">总收益</span>
            <span className={`font-semibold ${deltaClass(totalGain)}`}>
              {totalGain > 0 ? "+" : ""}
              {formatYuan(totalGain)}
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>标的</TableHead>
                <TableHead>谁/哪</TableHead>
                <TableHead className="text-right">市值</TableHead>
                <TableHead className="text-right">累计收益</TableHead>
                <TableHead className="w-10" />
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
                  <TableCell className={`text-right font-medium ${deltaClass(h.cumulativeGain)}`}>
                    {h.cumulativeGain > 0 ? "+" : ""}
                    {formatYuan(h.cumulativeGain)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={(props) => (
                          <Button variant="ghost" size="icon" aria-label="持仓操作" {...props}>
                            <MoreVerticalIcon data-icon="inline-start" />
                          </Button>
                        )}
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          <DropdownMenuItem onClick={() => setEditingHolding(h)}>编辑</DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onClick={() => setDeletingHolding(h)}>
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}

      {editingHolding && (
        <HoldingFormDialog
          snapshotId={snapshotId}
          db={db}
          onUpdate={onUpdate}
          holding={editingHolding}
          open
          onOpenChange={(o) => !o && setEditingHolding(null)}
        />
      )}

      <AlertDialog open={!!deletingHolding} onOpenChange={(o) => !o && setDeletingHolding(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除持仓「{deletingHolding?.name}」？</AlertDialogTitle>
            <AlertDialogDescription>只影响这张快照里的这条记录。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingHolding) onUpdate((db) => deleteHolding(db, deletingHolding.id))
                setDeletingHolding(null)
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
