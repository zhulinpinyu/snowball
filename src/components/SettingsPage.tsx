import { SettingsIcon } from "lucide-react"
import { InstrumentManager } from "./InstrumentManager"
import { TagManager } from "./TagManager"
import { DataCard } from "./DataCard"
import type { Database } from "@/lib/ledger"

interface SettingsPageProps {
  db: Database
  onUpdate: (fn: (db: Database) => Database) => void
  onReplace: (db: Database) => void
}

/** 设置：标的库 + 所属人/平台标签 + 数据备份（导出/导入 JSON，单机无云） */
export function SettingsPage({ db, onUpdate, onReplace }: SettingsPageProps) {
  const points = db.positionPoints.length + db.cashPoints.length
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
        <SettingsIcon data-icon="inline-start" className="size-4" />
        <span>
          {db.instruments.length} 只标的 · {db.positions.length} 个持仓 · {db.accounts.length} 个现金账户 ·{" "}
          {points} 条记录点
        </span>
      </div>
      <InstrumentManager db={db} onUpdate={onUpdate} />
      <TagManager db={db} onUpdate={onUpdate} />
      <DataCard db={db} onReplace={onReplace} />
    </div>
  )
}
