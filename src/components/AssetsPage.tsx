import { useState, type ReactNode } from "react"
import { LandmarkIcon, NotebookPenIcon, PlusIcon } from "lucide-react"
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
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { AddInstrumentDialog } from "./AddInstrumentDialog"
import { AddAccountDialog } from "./AddAccountDialog"
import { HistoryDialog, RowActions, type HistoryItem } from "./HistoryDialog"
import { deltaClass, formatPrice, formatYuan, todayLocal } from "@/lib/format"
import {
  deleteAccount,
  deleteCashPoint,
  deletePosition,
  deletePositionPoint,
  latestCashPoint,
  latestPositionPoint,
  recordCash,
  recordPosition,
  type CashAccount,
  type CashPoint,
  type Database,
  type Position,
  type PositionPoint,
} from "@/lib/ledger"
import type { QuoteView } from "@/lib/use-quotes"

interface AssetsPageProps {
  db: Database
  quotes: Record<string, QuoteView>
  onUpdate: (fn: (db: Database) => Database) => void
}

type HistoryKind = "position" | "account"
interface HistoryTarget {
  kind: HistoryKind
  id: string
  title: string
}
interface DeleteTarget {
  kind: HistoryKind
  id: string
  name: string
}

/** 资产页：全部持仓/现金账户明细；行内改 份额/成本/余额 = 记一笔（落所选日期） */
export function AssetsPage({ db, quotes, onUpdate }: AssetsPageProps) {
  const [recordDate, setRecordDate] = useState(todayLocal())
  const [showInstrument, setShowInstrument] = useState(false)
  const [showAccount, setShowAccount] = useState(false)
  const [history, setHistory] = useState<HistoryTarget | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)

  const hasAnything = db.positions.length > 0 || db.accounts.length > 0
  const positions = db.positions
  const funds = positions.filter((p) => p.kind === "fund")
  const stocks = positions.filter((p) => p.kind === "stock")

  const savePosition = (position: Position, shares: number, cost: number) => {
    onUpdate((current) => {
      const price = quotes[position.id]?.price ?? null
      return recordPosition(current, position.id, recordDate, shares, cost, price)
    })
  }

  const saveCash = (account: CashAccount, balance: number) => {
    onUpdate((current) => recordCash(current, account.id, recordDate, balance))
  }

  const historyItems = (): HistoryItem[] => {
    if (!history) return []
    if (history.kind === "position") {
      return db.positionPoints
        .filter((p) => p.positionId === history.id)
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((p) => ({
          id: p.id,
          date: p.date,
          caption: `份额 ${p.shares} · 成本 ${formatPrice(p.costPrice)} · 记录价 ${
            p.priceAtRecord !== null ? formatPrice(p.priceAtRecord) : "—"
          }`,
        }))
    }
    return db.cashPoints
      .filter((p) => p.accountId === history.id)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((p) => ({ id: p.id, date: p.date, caption: `余额 ${formatYuan(p.balance)}` }))
  }

  const deletePoint = (pointId: string) => {
    onUpdate((current) =>
      history?.kind === "position"
        ? deletePositionPoint(current, pointId)
        : deleteCashPoint(current, pointId)
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Field>
          <FieldLabel htmlFor="record-date">记在哪天</FieldLabel>
          <Input
            id="record-date"
            type="date"
            value={recordDate}
            onChange={(e) => e.target.value && setRecordDate(e.target.value)}
            className="w-fit"
          />
        </Field>
        <p className="text-muted-foreground text-xs">
          现价实时更新，没变就不用记；改了份额/成本/余额，点「记一笔」再保存 = 记录在所选日期
        </p>
      </div>

      {!hasAnything ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LandmarkIcon />
            </EmptyMedia>
            <EmptyTitle>还没有任何资产</EmptyTitle>
            <EmptyDescription>基金/股票从库里选，库里没有的输代码自动查；现金账户填名字随时记余额</EmptyDescription>
          </EmptyHeader>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => setShowInstrument(true)}>
              <PlusIcon data-icon="inline-start" />
              添加基金 / 股票
            </Button>
            <Button variant="outline" onClick={() => setShowAccount(true)}>
              <PlusIcon data-icon="inline-start" />
              添加现金账户
            </Button>
          </div>
        </Empty>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowInstrument(true)}>
              <PlusIcon data-icon="inline-start" />
              基金 / 股票
            </Button>
            <Button variant="outline" onClick={() => setShowAccount(true)}>
              <PlusIcon data-icon="inline-start" />
              现金账户
            </Button>
          </div>

          {db.accounts.length > 0 && (
            <Section title="现金账户">
              {db.accounts.map((account) => (
                <CashCard
                  key={account.id}
                  account={account}
                  point={latestCashPoint(db, account.id)}
                  onSave={(balance) => saveCash(account, balance)}
                  onHistory={() => setHistory({ kind: "account", id: account.id, title: account.name })}
                  onDelete={() => setDeleteTarget({ kind: "account", id: account.id, name: account.name })}
                />
              ))}
            </Section>
          )}
          {funds.length > 0 && (
            <Section title="基金">
              {funds.map((position) => (
                <PositionCard
                  key={`${position.id}:${latestPositionPoint(db, position.id)?.id ?? "none"}`}
                  position={position}
                  point={latestPositionPoint(db, position.id)}
                  quote={quotes[position.id]}
                  onSave={(shares, cost) => savePosition(position, shares, cost)}
                  onHistory={() =>
                    setHistory({ kind: "position", id: position.id, title: `${position.name} 的记录` })
                  }
                  onDelete={() => setDeleteTarget({ kind: "position", id: position.id, name: position.name })}
                />
              ))}
            </Section>
          )}
          {stocks.length > 0 && (
            <Section title="股票">
              {stocks.map((position) => (
                <PositionCard
                  key={`${position.id}:${latestPositionPoint(db, position.id)?.id ?? "none"}`}
                  position={position}
                  point={latestPositionPoint(db, position.id)}
                  quote={quotes[position.id]}
                  onSave={(shares, cost) => savePosition(position, shares, cost)}
                  onHistory={() =>
                    setHistory({ kind: "position", id: position.id, title: `${position.name} 的记录` })
                  }
                  onDelete={() => setDeleteTarget({ kind: "position", id: position.id, name: position.name })}
                />
              ))}
            </Section>
          )}
        </>
      )}

      {showInstrument && (
        <AddInstrumentDialog
          db={db}
          recordDate={recordDate}
          onUpdate={onUpdate}
          onClose={() => setShowInstrument(false)}
        />
      )}
      {showAccount && (
        <AddAccountDialog
          db={db}
          recordDate={recordDate}
          onUpdate={onUpdate}
          onClose={() => setShowAccount(false)}
        />
      )}

      {history && (
        <HistoryDialog
          title={history.title}
          items={historyItems()}
          onDelete={deletePoint}
          onClose={() => setHistory(null)}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              删除{deleteTarget?.kind === "position" ? "持仓" : "现金账户"}「{deleteTarget?.name}」？
            </AlertDialogTitle>
            <AlertDialogDescription>其下的全部记录点会一并删除，无法恢复。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const t = deleteTarget
                if (t) {
                  onUpdate((current) =>
                    t.kind === "position"
                      ? deletePosition(current, t.id)
                      : deleteAccount(current, t.id)
                  )
                }
                setDeleteTarget(null)
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-muted-foreground px-1 text-sm font-medium">{title}</h2>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}

interface PositionCardProps {
  position: Position
  point: PositionPoint | null
  quote: QuoteView | undefined
  onSave: (shares: number, cost: number) => void
  onHistory: () => void
  onDelete: () => void
}

/** 持仓行：默认只读展示；点「记一笔」才展开 份额/成本 输入与保存（改动才记） */
function PositionCard({ position, point, quote, onSave, onHistory, onDelete }: PositionCardProps) {
  const [editing, setEditing] = useState(false)
  const [sharesText, setSharesText] = useState(point ? String(point.shares) : "")
  const [costText, setCostText] = useState(point ? String(point.costPrice) : "")

  const shares = Number(sharesText)
  const cost = Number(costText)
  const valid = sharesText.trim() !== "" && costText.trim() !== "" && shares > 0 && cost >= 0
  const kindLabel = position.kind === "fund" ? "基金" : "股票"

  const cancel = () => {
    setSharesText(point ? String(point.shares) : "")
    setCostText(point ? String(point.costPrice) : "")
    setEditing(false)
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="truncate font-medium">{position.name}</span>
            <span className="text-muted-foreground shrink-0 text-xs">{position.code}</span>
          </div>
          <div className="text-muted-foreground truncate text-xs">
            {position.owner} · {position.platform} · {kindLabel}
          </div>
        </div>
        <RowActions onHistory={onHistory} onDelete={onDelete} />
      </div>

      <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 text-sm">
        {point && quote ? (
          <>
            <span>
              现价 ¥{formatPrice(quote.price)}
              {quote.stale && <span className="text-amber-600">（行情未更新）</span>}
            </span>
            <span>市值 ¥{formatYuan(point.shares * quote.price)}</span>
            <span className={deltaClass((quote.price - point.costPrice) * point.shares)}>
              浮盈 {(quote.price - point.costPrice) * point.shares > 0 ? "+" : ""}
              {formatYuan((quote.price - point.costPrice) * point.shares)}
            </span>
          </>
        ) : (
          <span>{!point ? "还没有记录，先记一笔" : "行情获取中…"}</span>
        )}
      </div>

      {editing ? (
        <div className="flex items-end gap-2">
          <div className="grid flex-1 grid-cols-2 gap-2">
            <NumberField
              label="份额 / 股数"
              value={sharesText}
              onChange={setSharesText}
              ariaLabel={`${position.name} 份额`}
            />
            <NumberField
              label="持仓成本价（元）"
              value={costText}
              onChange={setCostText}
              ariaLabel={`${position.name} 成本价`}
            />
          </div>
          <Button size="sm" disabled={!valid} onClick={() => { onSave(shares, cost); setEditing(false) }}>
            保存
          </Button>
          <Button size="sm" variant="ghost" onClick={cancel}>
            取消
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground text-sm">
            {point ? (
              <>
                份额 {point.shares} · 成本 ¥{formatPrice(point.costPrice)}
                <span className="text-muted-foreground/70 ml-1 text-xs">（记于 {point.date}）</span>
              </>
            ) : (
              "改动才记：点「记一笔」录入"
            )}
          </span>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <NotebookPenIcon data-icon="inline-start" className="size-4" />
            记一笔
          </Button>
        </div>
      )}
    </div>
  )
}

interface CashCardProps {
  account: CashAccount
  point: CashPoint | null
  onSave: (balance: number) => void
  onHistory: () => void
  onDelete: () => void
}

/** 现金账户行：默认只读展示；点「记一笔」才展开余额输入 */
function CashCard({ account, point, onSave, onHistory, onDelete }: CashCardProps) {
  const [editing, setEditing] = useState(false)
  const [balanceText, setBalanceText] = useState(point ? String(point.balance) : "")

  const balance = Number(balanceText)
  const valid = balanceText.trim() !== "" && Number.isFinite(balance) && balance >= 0

  const cancel = () => {
    setBalanceText(point ? String(point.balance) : "")
    setEditing(false)
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{account.name}</div>
          <div className="text-muted-foreground truncate text-xs">
            {account.owner} · {account.platform} · 现金
          </div>
        </div>
        <RowActions onHistory={onHistory} onDelete={onDelete} />
      </div>

      {editing ? (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <NumberField label="余额（元）" value={balanceText} onChange={setBalanceText} ariaLabel={`${account.name} 余额`} />
          </div>
          <Button size="sm" disabled={!valid} onClick={() => { onSave(balance); setEditing(false) }}>
            保存
          </Button>
          <Button size="sm" variant="ghost" onClick={cancel}>
            取消
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground text-sm">
            {point ? (
              <>
                余额 ¥{formatYuan(point.balance)}
                <span className="text-muted-foreground/70 ml-1 text-xs">（记于 {point.date}）</span>
              </>
            ) : (
              "改动才记：点「记一笔」录入"
            )}
          </span>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <NotebookPenIcon data-icon="inline-start" className="size-4" />
            记一笔
          </Button>
        </div>
      )}
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
  ariaLabel,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  ariaLabel: string
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <Input
        type="number"
        inputMode="decimal"
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}
