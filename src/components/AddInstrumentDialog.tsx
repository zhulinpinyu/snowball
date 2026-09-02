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
import { TagPicker } from "./TagPicker"
import {
  addInstrument,
  addPosition,
  recordPosition,
  listInstruments,
  type Database,
  type InstrumentKind,
} from "@/lib/ledger"
import { fundQuote, lookupInstrument, stockMarketOf, stockQuote, type InstrumentHit } from "@/lib/prices"
import { formatPrice } from "@/lib/format"

interface AddInstrumentDialogProps {
  db: Database
  recordDate: string
  onUpdate: (fn: (db: Database) => Database) => void
  onClose: () => void
}

const KIND_LABEL: Record<InstrumentKind, string> = { fund: "基金", stock: "股票" }

interface ChosenInstrument {
  code: string
  name: string
  kind: InstrumentKind
  /** 选择时已知的现价（来自代码查询）；从库里选时先 null，再后台取 */
  price: number | null
}

/**
 * 添加基金/股票持仓：先从标的库选（输一次代码即可），库里没有才输新代码查询；
 * 选好后填 所属人/平台 + 初始份额/成本。
 */
export function AddInstrumentDialog({ db, recordDate, onUpdate, onClose }: AddInstrumentDialogProps) {
  const [mode, setMode] = useState<"list" | "lookup">("list")
  const [chosen, setChosen] = useState<ChosenInstrument | null>(null)
  const [fromNewCode, setFromNewCode] = useState(false)
  const [price, setPrice] = useState<number | null>(null)
  const [priceLoading, setPriceLoading] = useState(false)
  const [owner, setOwner] = useState("")
  const [platform, setPlatform] = useState("")
  const [sharesText, setSharesText] = useState("")
  const [costText, setCostText] = useState("")

  // 代码查询（mode === "lookup"）
  const [code, setCode] = useState("")
  const [searching, setSearching] = useState(false)
  const [hits, setHits] = useState<InstrumentHit[]>([])
  const [error, setError] = useState<string | null>(null)

  const instruments = listInstruments(db)
  const funds = instruments.filter((i) => i.kind === "fund")
  const stocks = instruments.filter((i) => i.kind === "stock")

  // 从库里选定时，后台取一次现价用于初始记录（事件处理器内 setState，不在 effect 里）
  const pickFromList = (instrument: { code: string; name: string; kind: InstrumentKind }) => {
    setChosen({ ...instrument, price: null })
    setFromNewCode(false)
    setPrice(null)
    setPriceLoading(true)
    const q =
      instrument.kind === "fund"
        ? fundQuote(instrument.code)
        : stockQuote(instrument.code, stockMarketOf(instrument.code) ?? "sh")
    q.then((quote) => setPrice(quote.price))
      .catch(() => undefined)
      .finally(() => setPriceLoading(false))
  }

  const search = async () => {
    const trimmed = code.trim()
    if (!trimmed) return
    setSearching(true)
    setError(null)
    setHits([])
    try {
      const found = await lookupInstrument(trimmed)
      setHits(found)
      if (found.length === 1) {
        const hit = found[0]
        setChosen({ code: trimmed, name: hit.name, kind: hit.kind, price: hit.price })
        setFromNewCode(true)
        setPrice(hit.price)
      }
    } catch {
      setError(`没有找到代码 ${trimmed}，请检查是不是 6 位基金/股票代码`)
    } finally {
      setSearching(false)
    }
  }

  const pickHit = (hit: InstrumentHit) => {
    const trimmed = code.trim()
    setChosen({ code: trimmed, name: hit.name, kind: hit.kind, price: hit.price })
    setFromNewCode(true)
    setPrice(hit.price)
  }

  const shares = Number(sharesText)
  const cost = Number(costText)
  const numbersValid =
    sharesText.trim() === "" ||
    (Number.isFinite(shares) && shares > 0 && Number.isFinite(cost) && cost >= 0)
  const valid = !!chosen && !!owner && !!platform && numbersValid

  const save = () => {
    if (!chosen || !valid) return
    const hasInitial = sharesText.trim() !== ""
    onUpdate((current) => {
      let next = current
      if (fromNewCode) {
        next = addInstrument(next, { code: chosen.code, name: chosen.name, kind: chosen.kind })
      }
      const existing = next.positions.find(
        (p) =>
          p.kind === chosen.kind &&
          p.code === chosen.code &&
          p.owner === owner &&
          p.platform === platform
      )
      let positionId: string
      if (existing) {
        positionId = existing.id
      } else {
        next = addPosition(next, {
          code: chosen.code,
          name: chosen.name,
          kind: chosen.kind,
          owner,
          platform,
        })
        positionId = next.positions[next.positions.length - 1].id
      }
      if (hasInitial) {
        next = recordPosition(next, positionId, recordDate, shares, cost, price)
      }
      return next
    })
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-svh overflow-y-auto">
        <DialogHeader>
          <DialogTitle>添加持仓</DialogTitle>
          <DialogDescription>
            先从库里选标的；库里没有就输代码查询并自动入库。再填谁/在哪 + 份额与成本。
          </DialogDescription>
        </DialogHeader>

        {!chosen && mode === "list" && (
          <div className="flex flex-col gap-3">
            {instruments.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                标的库是空的，先「输代码添加」查一只吧（也可以到设置页维护库）
              </p>
            ) : (
              <>
                <InstrumentGroup label="基金" items={funds} onPick={pickFromList} />
                <InstrumentGroup label="股票" items={stocks} onPick={pickFromList} />
              </>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setMode("lookup")}>
                <SearchIcon data-icon="inline-start" />
                库里没有？输代码添加
              </Button>
            </div>
          </div>
        )}

        {!chosen && mode === "lookup" && (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="inst-code">标的代码</FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="inst-code"
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
            <Button variant="ghost" size="sm" onClick={() => setMode("list")}>
              ← 返回从库里选
            </Button>
            {hits.length > 1 && (
              <Field>
                <FieldLabel>同一个代码查到多个，选一个</FieldLabel>
                <div className="flex flex-col gap-2">
                  {hits.map((hit, i) => (
                    <button
                      key={`${hit.kind}-${i}`}
                      type="button"
                      className="rounded-lg border px-3 py-2 text-left text-sm"
                      onClick={() => pickHit(hit)}
                    >
                      <span className="font-medium">{hit.name}</span>
                      <span className="text-muted-foreground ml-2">{KIND_LABEL[hit.kind]}</span>
                    </button>
                  ))}
                </div>
              </Field>
            )}
          </FieldGroup>
        )}

        {chosen && (
          <FieldGroup>
            <Field>
              <FieldLabel>标的</FieldLabel>
              <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                <span className="min-w-0">
                  <span className="font-medium">{chosen.name}</span>
                  <span className="text-muted-foreground ml-2 text-xs">
                    {KIND_LABEL[chosen.kind]} · {chosen.code}
                  </span>
                </span>
                <span className="text-muted-foreground text-xs">
                  当前价 {priceLoading ? "…" : price !== null ? formatPrice(price) : "暂无"}
                </span>
              </div>
            </Field>
            <TagPicker label="所属人" options={db.owners} value={owner} onChange={setOwner} />
            <TagPicker label="平台" options={db.platforms} value={platform} onChange={setPlatform} />
            <div className="grid grid-cols-2 gap-2">
              <Field>
                <FieldLabel htmlFor="inst-shares">份额 / 股数</FieldLabel>
                <Input
                  id="inst-shares"
                  type="number"
                  inputMode="decimal"
                  value={sharesText}
                  onChange={(e) => setSharesText(e.target.value)}
                  placeholder="如 1234.56"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="inst-cost">持仓成本价（元）</FieldLabel>
                <Input
                  id="inst-cost"
                  type="number"
                  inputMode="decimal"
                  value={costText}
                  onChange={(e) => setCostText(e.target.value)}
                  placeholder="如 1.2"
                />
              </Field>
            </div>
            <p className="text-muted-foreground text-sm">
              份额与成本为空 = 只添加持仓，之后在「资产」页记第一笔
            </p>
          </FieldGroup>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          {chosen && (
            <Button disabled={!valid} onClick={save}>
              保存{sharesText.trim() !== "" ? `（记录于 ${recordDate}）` : ""}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function InstrumentGroup({
  label,
  items,
  onPick,
}: {
  label: string
  items: { code: string; name: string; kind: InstrumentKind }[]
  onPick: (i: { code: string; name: string; kind: InstrumentKind }) => void
}) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-muted-foreground px-1 text-sm font-medium">{label}</h3>
      <div className="flex flex-col divide-y rounded-lg border">
        {items.map((instrument) => (
          <button
            key={`${instrument.kind}-${instrument.code}`}
            type="button"
            className="flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/50"
            onClick={() => onPick(instrument)}
          >
            <span className="min-w-0 truncate font-medium">{instrument.name}</span>
            <span className="text-muted-foreground ml-2 shrink-0 text-xs">{instrument.code}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
