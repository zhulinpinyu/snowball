import { useState } from "react"
import { CheckIcon, PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const NEW_OPTION = "__new__"

interface TagPickerProps {
  label: string
  options: string[]
  value: string
  onChange: (value: string) => void
}

/** 标签选择器：从已有标签中选择，也可就地输入新标签 */
export function TagPicker({ label, options, value, onChange }: TagPickerProps) {
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState("")

  const commitDraft = () => {
    const trimmed = draft.trim()
    if (trimmed) {
      onChange(trimmed)
      setCreating(false)
      setDraft("")
    }
  }

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      {creating ? (
        <div className="flex gap-2">
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && commitDraft()}
            placeholder="输入新标签"
          />
          <Button variant="outline" size="icon" onClick={commitDraft} aria-label="确认新标签">
            <CheckIcon data-icon="inline-start" />
          </Button>
        </div>
      ) : (
        <Select
          value={value || undefined}
          onValueChange={(v) => {
            if (!v) return
            if (v === NEW_OPTION) {
              setCreating(true)
            } else {
              onChange(v)
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder={`选择${label}`} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
              <SelectItem value={NEW_OPTION}>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <PlusIcon data-icon="inline-start" />
                  新增{label}…
                </span>
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      )}
    </Field>
  )
}
