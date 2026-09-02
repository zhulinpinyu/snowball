import { HistoryIcon, Trash2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export interface HistoryItem {
  id: string
  date: string
  caption: string
}

interface HistoryDialogProps {
  title: string
  items: HistoryItem[]
  onDelete: (pointId: string) => void
  onClose: () => void
}

/** 记录点历史：查看某持仓/现金账户的每次改动，可删除单个点纠错 */
export function HistoryDialog({ title, items, onDelete, onClose }: HistoryDialogProps) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-svh overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>每个记录点是一次改动；删错点后当前状态回退到更早一次</DialogDescription>
        </DialogHeader>
        {items.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">还没有记录点</p>
        ) : (
          <div className="flex flex-col divide-y rounded-lg border">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-2 px-3 py-2">
                <span className="text-muted-foreground w-24 shrink-0 text-sm">{item.date}</span>
                <span className="flex-1 text-sm">{item.caption}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground size-7"
                  aria-label={`删除 ${item.date} 的记录`}
                  onClick={() => onDelete(item.id)}
                >
                  <Trash2Icon data-icon="inline-start" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** 行尾两个小图标按钮的统一样式 */
export function RowActions({
  onHistory,
  onDelete,
}: {
  onHistory: () => void
  onDelete: () => void
}) {
  return (
    <span className="flex shrink-0 gap-0.5">
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground size-7"
        aria-label="记录历史"
        onClick={onHistory}
      >
        <HistoryIcon data-icon="inline-start" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground size-7"
        aria-label="删除"
        onClick={onDelete}
      >
        <Trash2Icon data-icon="inline-start" />
      </Button>
    </span>
  )
}
