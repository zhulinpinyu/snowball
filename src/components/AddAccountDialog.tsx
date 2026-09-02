import { useState } from "react"
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
import { addAccount, recordCash, type Database } from "@/lib/ledger"

interface AddAccountDialogProps {
  db: Database
  recordDate: string
  onUpdate: (fn: (db: Database) => Database) => void
  onClose: () => void
}

/** 添加现金账户：余额随时改，这里可填初始余额 */
export function AddAccountDialog({ db, recordDate, onUpdate, onClose }: AddAccountDialogProps) {
  const [name, setName] = useState("")
  const [owner, setOwner] = useState("")
  const [platform, setPlatform] = useState("")
  const [balanceText, setBalanceText] = useState("")

  const balance = Number(balanceText)
  const balanceValid =
    balanceText.trim() === "" || (Number.isFinite(balance) && balance >= 0)
  const valid = !!name.trim() && !!owner && !!platform && balanceValid

  const save = () => {
    if (!valid) return
    const hasBalance = balanceText.trim() !== ""
    onUpdate((current) => {
      let next = addAccount(current, { name: name.trim(), owner, platform })
      const account = next.accounts[next.accounts.length - 1]
      if (hasBalance) {
        next = recordCash(next, account.id, recordDate, balance)
      }
      return next
    })
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-svh overflow-y-auto">
        <DialogHeader>
          <DialogTitle>添加现金账户</DialogTitle>
          <DialogDescription>活期/定期/余额宝/零钱都算现金；余额为空 = 稍后再记</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="acc-name">账户名称</FieldLabel>
            <Input
              id="acc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如 招行活期、余额宝、微信零钱"
            />
          </Field>
          <TagPicker label="所属人" options={db.owners} value={owner} onChange={setOwner} />
          <TagPicker label="平台" options={db.platforms} value={platform} onChange={setPlatform} />
          <Field>
            <FieldLabel htmlFor="acc-balance">余额（元）</FieldLabel>
            <Input
              id="acc-balance"
              type="number"
              inputMode="decimal"
              value={balanceText}
              onChange={(e) => setBalanceText(e.target.value)}
              placeholder="如 20000"
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button disabled={!valid} onClick={save}>
            保存{balanceText.trim() !== "" ? `（余额记于 ${recordDate}）` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
