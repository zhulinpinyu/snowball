import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { TagPicker } from "./TagPicker"
import { addHolding, addTag, type Database } from "@/lib/snapshot-library"

interface HoldingFormDialogProps {
  snapshotId: string
  db: Database
  onUpdate: (fn: (db: Database) => Database) => void
}

interface HoldingDraft {
  name: string
  code: string
  assetType: string
  owner: string
  platform: string
  marketValue: string
  cumulativeGain: string
}

const emptyDraft: HoldingDraft = {
  name: "",
  code: "",
  assetType: "",
  owner: "",
  platform: "",
  marketValue: "",
  cumulativeGain: "",
}

/** 添加持仓：从所属 App 抄录市值与累计收益，标签可从已有中选择或新建 */
export function HoldingFormDialog({ snapshotId, db, onUpdate }: HoldingFormDialogProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<HoldingDraft>(emptyDraft)

  const set = (patch: Partial<HoldingDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const valid =
    draft.name.trim() &&
    draft.owner &&
    draft.platform &&
    draft.assetType &&
    draft.marketValue !== ""

  const submit = () => {
    onUpdate((current) => {
      let next = current
      // 新标签先入库，保证标签列表与持仓引用一致
      for (const kind of ["owners", "platforms", "assetTypes"] as const) {
        const label = draft[kind === "owners" ? "owner" : kind === "platforms" ? "platform" : "assetType"]
        if (label) next = addTag(next, kind, label)
      }
      return addHolding(next, snapshotId, {
        name: draft.name.trim(),
        code: draft.code.trim(),
        assetType: draft.assetType,
        owner: draft.owner,
        platform: draft.platform,
        marketValue: Number(draft.marketValue),
        cumulativeGain: Number(draft.cumulativeGain || 0),
      })
    })
    setDraft(emptyDraft)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={(props) => (
          <Button {...props}>添加持仓</Button>
        )}
      />
      <DialogContent className="max-h-svh overflow-y-auto">
        <DialogHeader>
          <DialogTitle>添加持仓</DialogTitle>
          <DialogDescription>打开所属 App，照着抄就行。</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="holding-name">标的名称 *</FieldLabel>
            <Input
              id="holding-name"
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="如 沪深300指数A"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="holding-code">标的代码</FieldLabel>
            <Input
              id="holding-code"
              value={draft.code}
              onChange={(e) => set({ code: e.target.value })}
              placeholder="如 000961"
            />
            <p className="text-muted-foreground text-sm">仅作标识，不用于拉取行情</p>
          </Field>
          <TagPicker label="所属人" options={db.owners} value={draft.owner} onChange={(v) => set({ owner: v })} />
          <TagPicker label="平台" options={db.platforms} value={draft.platform} onChange={(v) => set({ platform: v })} />
          <TagPicker label="资产类型" options={db.assetTypes} value={draft.assetType} onChange={(v) => set({ assetType: v })} />
          <Field>
            <FieldLabel htmlFor="holding-value">市值（元）*</FieldLabel>
            <Input
              id="holding-value"
              type="number"
              inputMode="decimal"
              value={draft.marketValue}
              onChange={(e) => set({ marketValue: e.target.value })}
              placeholder="当前持有市值"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="holding-gain">累计收益（元）</FieldLabel>
            <Input
              id="holding-gain"
              type="number"
              inputMode="decimal"
              value={draft.cumulativeGain}
              onChange={(e) => set({ cumulativeGain: e.target.value })}
              placeholder="App 里显示的持有收益，亏了填负数"
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button disabled={!valid} onClick={submit}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
