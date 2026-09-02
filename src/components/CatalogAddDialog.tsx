import { useState } from "react"
import { SearchIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { addInstrument, type Database, type InstrumentKind } from "@/lib/ledger"
import { lookupInstrument, type InstrumentHit } from "@/lib/prices"

interface CatalogAddDialogProps {
  onUpdate: (fn: (db: Database) => Database) => void
  onClose: () => void
}

const KIND_LABEL: Record<InstrumentKind, string> = { fund: "基金", stock: "股票" }

/** 添加标的到库：输代码 → 查出名称/类型 → 入库（同类型同代码自动去重） */
export function CatalogAddDialog({ onUpdate, onClose }: CatalogAddDialogProps) {
  const [code, setCode] = useState("")
  const [searching, setSearching] = useState(false)
  const [hits, setHits] = useState<InstrumentHit[]>([])
  const [picked, setPicked] = useState<InstrumentHit | null>(null)
  const [error, setError] = useState<string | null>(null)

  const search = async () => {
    const trimmed = code.trim()
    if (!trimmed) return
    setSearching(true)
    setError(null)
    setHits([])
    setPicked(null)
    try {
      const found = await lookupInstrument(trimmed)
      setHits(found)
      setPicked(found.length === 1 ? found[0] : null)
    } catch {
      setError(`没有找到代码 ${trimmed}，请检查是不是 6 位基金/股票代码`)
    } finally {
      setSearching(false)
    }
  }

  const save = () => {
    if (!picked) return
    onUpdate((current) =>
      addInstrument(current, { code: code.trim(), name: picked.name, kind: picked.kind })
    )
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-svh overflow-y-auto">
        <DialogHeader>
          <DialogTitle>把标的加入库</DialogTitle>
          <DialogDescription>输一次代码，之后记录时直接从库里选，不用再输</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="cat-code">标的代码</FieldLabel>
            <div className="flex gap-2">
              <Input
                id="cat-code"
                inputMode="numeric"
                placeholder="如 000961 / 600519"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void search()}
              />
              <Button variant="outline" onClick={() => void search()} disabled={searching || !code.trim()}>
                <SearchIcon data-icon="inline-start" />
                {searching ? "查询中…" : "查询"}
              </Button>
            </div>
          </Field>
          {error && <p className="text-destructive text-sm">{error}</p>}
          {hits.length > 1 && (
            <Field>
              <FieldLabel>同一个代码查到多个，选一个</FieldLabel>
              <div className="flex flex-col gap-2">
                {hits.map((hit, i) => (
                  <button
                    key={`${hit.kind}-${i}`}
                    type="button"
                    className={`rounded-lg border px-3 py-2 text-left text-sm ${picked === hit ? "border-primary" : ""}`}
                    onClick={() => setPicked(hit)}
                  >
                    <span className="font-medium">{hit.name}</span>
                    <span className="text-muted-foreground ml-2">{KIND_LABEL[hit.kind]}</span>
                  </button>
                ))}
              </div>
            </Field>
          )}
          {picked && (
            <p className="text-muted-foreground text-sm">
              将加入：{picked.name}（{KIND_LABEL[picked.kind]} · {code.trim()}）
            </p>
          )}
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button disabled={!picked} onClick={save}>
            加入标的库
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
