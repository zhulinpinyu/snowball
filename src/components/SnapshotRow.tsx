import { useState } from "react"
import { MoreVerticalIcon } from "lucide-react"
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { deleteSnapshot, updateSnapshot } from "@/lib/snapshot-library"

/** 红涨绿跌（国内习惯） */
export function deltaClass(delta: number | null): string {
  if (delta === null || delta === 0) return "text-muted-foreground"
  return delta > 0 ? "text-red-600" : "text-emerald-600"
}

export function formatYuan(n: number): string {
  return n.toLocaleString("zh-CN", { maximumFractionDigits: 2 })
}

interface SnapshotRowProps {
  snapshotId: string
  date: string
  /** 主文案，如快照日期 */
  title: string
  /** 右侧摘要（如持仓数或总资产） */
  summary?: string
  /** 较上期涨跌额，用于着色展示 */
  delta?: number | null
  onOpen: () => void
  onUpdate: (fn: (db: Parameters<typeof updateSnapshot>[0]) => Parameters<typeof updateSnapshot>[0]) => void
}

/** 快照行：点击进入详情，菜单可改日期/删除（带确认） */
export function SnapshotRow({ snapshotId, title, summary, delta, onOpen, onUpdate }: SnapshotRowProps) {
  const [editing, setEditing] = useState<{ date: string } | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  return (
    <div className="flex items-center">
      <button
        className="flex flex-1 items-center justify-between px-4 py-3 text-left hover:bg-muted/50"
        onClick={onOpen}
      >
        <span className="font-medium">{title}</span>
        {summary !== undefined && (
          <span className="flex items-baseline gap-2">
            <span>{summary}</span>
            {delta !== undefined && delta !== null && (
              <span className={`text-sm ${deltaClass(delta)}`}>
                {delta > 0 ? "+" : ""}
                {formatYuan(delta)}
              </span>
            )}
          </span>
        )}
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
            <DropdownMenuItem onClick={() => setEditing({ date: title })}>修改日期</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => setConfirmingDelete(true)}>
              删除快照
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

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
                onChange={(e) => editing && setEditing({ date: e.target.value })}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              disabled={!editing?.date}
              onClick={() => {
                if (editing) onUpdate((db) => updateSnapshot(db, snapshotId, editing.date))
                setEditing(null)
              }}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除 {title} 的快照？</AlertDialogTitle>
            <AlertDialogDescription>其下的持仓记录会一并删除，无法恢复。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onUpdate((db) => deleteSnapshot(db, snapshotId))
                setConfirmingDelete(false)
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
