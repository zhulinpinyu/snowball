import { SettingsIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { InstrumentManager } from "./InstrumentManager"
import { TagManager } from "./TagManager"
import { DataCard } from "./DataCard"
import { setAutoValuation, type Database } from "@/lib/ledger"

interface SettingsPageProps {
  db: Database
  onUpdate: (fn: (db: Database) => Database) => void
  onReplace: (db: Database) => void
}

/** 设置：每日估值快照开关 + 标的库 + 所属人/平台标签 + 数据备份（导出/导入 JSON，单机无云） */
export function SettingsPage({ db, onUpdate, onReplace }: SettingsPageProps) {
  const points = db.positionPoints.length + db.cashPoints.length
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
        <SettingsIcon data-icon="inline-start" className="size-4" />
        <span>
          {db.instruments.length} 只标的 · {db.positions.length} 个持仓 · {db.accounts.length} 个现金账户 ·{" "}
          {points} 条记录点 · {db.valuationPoints.length} 条估值快照
        </span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>每日估值快照</CardTitle>
          <CardDescription>刷新行情后自动记下当天价格，攒出每天的总资产走势</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground text-sm">
            {db.autoValuation ? "已开启：每次刷新行情自动记录" : "已关闭：曲线只由人工记录点驱动"}
          </span>
          <Button
            variant={db.autoValuation ? "outline" : "default"}
            onClick={() => onUpdate((current) => setAutoValuation(current, !current.autoValuation))}
          >
            {db.autoValuation ? "关闭" : "开启"}
          </Button>
        </CardContent>
      </Card>

      <InstrumentManager db={db} onUpdate={onUpdate} />
      <TagManager db={db} onUpdate={onUpdate} />
      <DataCard db={db} onReplace={onReplace} />
    </div>
  )
}
