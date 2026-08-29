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
import { addSnapshot, type Database } from "@/lib/snapshot-library"

interface NewSnapshotDialogProps {
  onCreate: (fn: (db: Database) => Database) => void
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function NewSnapshotDialog({ onCreate }: NewSnapshotDialogProps) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(today())

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setDate(today())
      }}
    >
      <DialogTrigger
        render={(props) => (
          <Button {...props}>新建快照</Button>
        )}
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建快照</DialogTitle>
          <DialogDescription>这一期的持仓都会挂在这个日期上。</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="snapshot-date">快照日期</FieldLabel>
            <Input
              id="snapshot-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button
            disabled={!date}
            onClick={() => {
              onCreate((db) => addSnapshot(db, date))
              setOpen(false)
            }}
          >
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
