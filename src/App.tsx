import { useEffect, useState } from "react"
import { SnowflakeIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { listSnapshots, type Database } from "@/lib/snapshot-library"
import { loadDatabase } from "@/lib/storage"

export default function App() {
  const [db, setDb] = useState<Database | null>(null)

  useEffect(() => {
    setDb(loadDatabase(window.localStorage))
  }, [])

  if (!db) return null

  const snapshots = listSnapshots(db)

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <SnowflakeIcon data-icon="inline-start" className="text-muted-foreground" />
        <h1 className="text-lg font-semibold">家庭资产账本</h1>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4">
        {snapshots.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SnowflakeIcon />
              </EmptyMedia>
              <EmptyTitle>还没有快照</EmptyTitle>
              <EmptyDescription>
                新建第一张快照，把各平台里的基金、股票抄录进来吧
              </EmptyDescription>
            </EmptyHeader>
            <Button disabled>新建快照（下一张工单实现）</Button>
          </Empty>
        ) : (
          <p className="text-muted-foreground">已有 {snapshots.length} 张快照</p>
        )}
      </main>
    </div>
  )
}
