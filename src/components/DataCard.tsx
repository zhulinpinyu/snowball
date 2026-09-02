import { useRef, useState } from "react"
import { DownloadIcon, UploadIcon } from "lucide-react"
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { type Database } from "@/lib/ledger"
import { isLegacyV2, isValidDatabase, migrateLegacyV2 } from "@/lib/storage"

interface DataCardProps {
  db: Database
  onReplace: (db: Database) => void
}

function toDatabase(value: unknown): Database | null {
  if (isValidDatabase(value)) return value
  // 早期（无标的库）导出的备份：导入时自动迁移
  if (isLegacyV2(value)) return migrateLegacyV2(value)
  return null
}

/** 数据备份：导出全部数据为 JSON，导入则整体覆盖（先确认） */
export function DataCard({ db, onReplace }: DataCardProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [pendingImport, setPendingImport] = useState<Database | null>(null)
  const [error, setError] = useState<string | null>(null)

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `snowball-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const pickFile = () => {
    setError(null)
    fileInput.current?.click()
  }

  const onFile = async (file: File) => {
    try {
      const parsed: unknown = JSON.parse(await file.text())
      const imported = toDatabase(parsed)
      if (imported) {
        setPendingImport(imported)
      } else {
        setError("文件格式不对，不是 Snowball 导出的数据")
      }
    } catch {
      setError("文件解析失败，请确认是之前导出的 JSON")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>数据备份</CardTitle>
        <CardDescription>数据只存在这台手机的浏览器里，记得定期导出</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportJson}>
            <DownloadIcon data-icon="inline-start" />
            导出 JSON
          </Button>
          <Button variant="outline" onClick={pickFile}>
            <UploadIcon data-icon="inline-start" />
            导入 JSON
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void onFile(file)
              e.target.value = ""
            }}
          />
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <p className="text-muted-foreground text-sm">
          {db.positions.length} 个持仓 · {db.accounts.length} 个现金账户
          {db.positions.length === 0 && db.accounts.length === 0 && "（当前为空）"}
        </p>
      </CardContent>

      <AlertDialog open={!!pendingImport} onOpenChange={(o) => !o && setPendingImport(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>导入并覆盖现有数据？</AlertDialogTitle>
            <AlertDialogDescription>
              将导入 {pendingImport?.positions.length ?? 0} 个持仓、
              {pendingImport?.accounts.length ?? 0} 个现金账户，当前数据会被整体替换。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingImport) onReplace(pendingImport)
                setPendingImport(null)
              }}
            >
              覆盖导入
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
