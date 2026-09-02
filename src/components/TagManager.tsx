import { useState } from "react"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { addTag, deleteTag, type Database, type TagKind } from "@/lib/ledger"

const KINDS: { kind: TagKind; title: string; description: string }[] = [
  { kind: "owners", title: "所属人", description: "家里谁的持仓/账户" },
  { kind: "platforms", title: "平台", description: "钱放在哪个 App / 银行" },
]

interface TagManagerProps {
  db: Database
  onUpdate: (fn: (db: Database) => Database) => void
}

/** 标签管理：所属人/平台的增删；被持仓或现金账户引用的标签不可删 */
export function TagManager({ db, onUpdate }: TagManagerProps) {
  return (
    <div className="flex flex-col gap-4">
      {KINDS.map(({ kind, title, description }) => (
        <TagSection key={kind} kind={kind} title={title} description={description} db={db} onUpdate={onUpdate} />
      ))}
    </div>
  )
}

interface TagSectionProps {
  kind: TagKind
  title: string
  description: string
  db: Database
  onUpdate: (fn: (db: Database) => Database) => void
}

function TagSection({ kind, title, description, db, onUpdate }: TagSectionProps) {
  const [draft, setDraft] = useState("")
  const used =
    kind === "owners"
      ? new Set([...db.positions.map((p) => p.owner), ...db.accounts.map((a) => a.owner)])
      : new Set([...db.positions.map((p) => p.platform), ...db.accounts.map((a) => a.platform)])
  const labels = db[kind]

  const add = () => {
    const trimmed = draft.trim()
    if (trimmed) {
      onUpdate((current) => addTag(current, kind, trimmed))
      setDraft("")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {labels.length === 0 ? (
          <p className="text-muted-foreground text-sm">还没有{title}标签</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {labels.map((label) => {
              const inUse = used.has(label)
              return (
                <Badge key={label} variant="secondary" className="gap-1 py-1 pr-1 pl-2">
                  {label}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-4 rounded-full"
                    aria-label={inUse ? `「${label}」仍被引用，不可删除` : `删除「${label}」`}
                    disabled={inUse}
                    onClick={() => onUpdate((current) => deleteTag(current, kind, label))}
                  >
                    <Trash2Icon data-icon="inline-start" />
                  </Button>
                </Badge>
              )
            })}
          </div>
        )}
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`add-${kind}`}>新增{title}</FieldLabel>
            <div className="flex gap-2">
              <Input
                id={`add-${kind}`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add()}
                placeholder={`输入新${title}名称`}
              />
              <Button variant="outline" onClick={add} disabled={!draft.trim()}>
                <PlusIcon data-icon="inline-start" />
                添加
              </Button>
            </div>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
