import { useEffect, useState } from "react"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
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
import { TagManager } from "@/components/TagManager"
import {
  deleteHolding,
  deleteSnapshot,
  holdingsOf,
  listSnapshots,
  updateSnapshot,
  type Holding,
} from "@/lib/snapshot-library"
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

  // 快照不存在（被删除或数据被导入覆盖）时回到列表
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
          <Tabs defaultValue="snapshots">
            <TabsList className="w-full">
              <TabsTrigger value="snapshots">快照</TabsTrigger>
              <TabsTrigger value="tags">标签</TabsTrigger>
            </TabsList>
            <TabsContent value="snapshots">
              <SnapshotList
                snapshots={snapshots}
                db={db}
                onOpen={setViewingId}
                onUpdate={update}
              />
            </TabsContent>
            <TabsContent value="tags">
              <TagManager db={db} onUpdate={update} />
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
  const [editing, setEditing] = useState<{ id: string; date: string } | null>(null)
  const [deleting, setDeleting] = useState<{ id: string; date: string } | null>(null)

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
          <div key={s.id} className="flex items-center">
            <button
              className="flex flex-1 items-center justify-between px-4 py-3 text-left hover:bg-muted/50"
              onClick={() => onOpen(s.id)}
            >
              <span className="font-medium">{s.date}</span>
              <span className="text-muted-foreground text-sm">{holdingsOf(db, s.id).length} 条持仓</span>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={(props) => (
                  <Button variant="ghost" size="icon" aria-label="快照操作" {...props}>
                    <MoreVerticalIcon data-icon="inline-start" />
                  </Button>
                )}
              />
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => setEditing({ id: s.id, date: s.date })}>
                    修改日期
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={() => setDeleting({ id: s.id, date: s.date })}>
                    删除快照
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改快照日期</DialogTitle>
            <DialogDescription>快照内的持仓保持不变。</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="edit-snapshot-date">快照日期</FieldLabel>
              <Input
                id="edit-snapshot-date"
                type="date"
                value={editing?.date ?? ""}
                onChange={(e) => editing && setEditing({ ...editing, date: e.target.value })}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              disabled={!editing?.date}
              onClick={() => {
                if (editing) onUpdate((db) => updateSnapshot(db, editing.id, editing.date))
                setEditing(null)
              }}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除 {deleting?.date} 的快照？</AlertDialogTitle>
            <AlertDialogDescription>
              其下的持仓记录会一并删除，无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleting) onUpdate((db) => deleteSnapshot(db, deleting.id))
                setDeleting(null)
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
            <span className={`font-semibold ${gainClass(totalGain)}`}>
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
                  <TableCell className={`text-right font-medium ${gainClass(h.cumulativeGain)}`}>
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

      <HoldingFormDialog
        snapshotId={snapshotId}
        db={db}
        onUpdate={onUpdate}
        holding={editingHolding ?? undefined}
        open={!!editingHolding}
        onOpenChange={(o) => !o && setEditingHolding(null)}
      />

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
