import { useState } from "react"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CatalogAddDialog } from "./CatalogAddDialog"
import { deleteInstrument, listInstruments, type Database, type InstrumentKind } from "@/lib/ledger"

interface InstrumentManagerProps {
  db: Database
  onUpdate: (fn: (db: Database) => Database) => void
}

const KIND_LABEL: Record<InstrumentKind, string> = { fund: "基金", stock: "股票" }

/** 标的库管理：基金/股票的增删。被持仓引用的条目不可删。 */
export function InstrumentManager({ db, onUpdate }: InstrumentManagerProps) {
  const [showAdd, setShowAdd] = useState(false)
  const instruments = listInstruments(db)
  const usedKeys = new Set(db.positions.map((p) => `${p.kind}:${p.code}`))

  return (
    <Card>
      <CardHeader>
        <CardTitle>基金 / 股票（标的库）</CardTitle>
        <CardDescription>每只输一次代码加入库；之后在「资产」页新建持仓时直接选</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {instruments.length === 0 ? (
          <p className="text-muted-foreground text-sm">库里还没有标的，点右上添加吧</p>
        ) : (
          <div className="flex flex-col divide-y rounded-lg border">
            {instruments.map((instrument) => {
              const inUse = usedKeys.has(`${instrument.kind}:${instrument.code}`)
              return (
                <div key={instrument.id} className="flex items-center gap-2 px-3 py-2">
                  <Badge variant="secondary">{KIND_LABEL[instrument.kind]}</Badge>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{instrument.name}</span>
                  <span className="text-muted-foreground shrink-0 text-xs">{instrument.code}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground size-7"
                    aria-label={inUse ? `「${instrument.name}」仍被持仓引用，不可删除` : `删除「${instrument.name}」`}
                    disabled={inUse}
                    onClick={() => onUpdate((current) => deleteInstrument(current, instrument.id))}
                  >
                    <Trash2Icon data-icon="inline-start" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}
        <div>
          <Button variant="outline" onClick={() => setShowAdd(true)}>
            <PlusIcon data-icon="inline-start" />
            添加标的
          </Button>
        </div>
      </CardContent>

      {showAdd && (
        <CatalogAddDialog onUpdate={onUpdate} onClose={() => setShowAdd(false)} />
      )}
    </Card>
  )
}
