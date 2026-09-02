import { useState } from "react"
import { ChartPieIcon, RefreshCwIcon, SettingsIcon, SnowflakeIcon, TrendingUpIcon, WalletIcon } from "lucide-react"
import { OverviewPage } from "@/components/OverviewPage"
import { AssetsPage } from "@/components/AssetsPage"
import { BreakdownPage } from "@/components/BreakdownPage"
import { SettingsPage } from "@/components/SettingsPage"
import { Button } from "@/components/ui/button"
import { useDatabase } from "@/lib/use-database"
import { useQuotes } from "@/lib/use-quotes"
import { cn } from "@/lib/utils"

type Tab = "overview" | "assets" | "breakdown" | "settings"

const TAB_ITEMS: { key: Tab; label: string; icon: typeof TrendingUpIcon }[] = [
  { key: "overview", label: "总览", icon: TrendingUpIcon },
  { key: "assets", label: "资产", icon: WalletIcon },
  { key: "breakdown", label: "占比", icon: ChartPieIcon },
  { key: "settings", label: "设置", icon: SettingsIcon },
]

export default function App() {
  const { db, update, replace } = useDatabase()
  const { quotes, loading, error, refresh } = useQuotes(db)
  const [tab, setTab] = useState<Tab>("overview")

  const goRecord = () => setTab("assets")

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <SnowflakeIcon data-icon="inline-start" className="text-muted-foreground" />
        <h1 className="text-lg font-semibold">家庭资产账本</h1>
        {error && (
          <span className="text-amber-600 ml-auto truncate text-xs">{error}</span>
        )}
        <Button
          variant="ghost"
          size="icon"
          aria-label="刷新行情"
          disabled={loading}
          onClick={() => void refresh()}
        >
          <RefreshCwIcon data-icon="inline-start" className={cn(loading && "animate-spin")} />
        </Button>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-4 pb-24">
        {tab === "overview" && (
          <OverviewPage db={db} quotes={quotes} quoteError={error} onGoRecord={goRecord} />
        )}
        {tab === "assets" && <AssetsPage db={db} quotes={quotes} onUpdate={update} />}
        {tab === "breakdown" && (
          <BreakdownPage db={db} quotes={quotes} onGoRecord={goRecord} />
        )}
        {tab === "settings" && <SettingsPage db={db} onUpdate={update} onReplace={replace} />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex w-full max-w-3xl">
          {TAB_ITEMS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-xs",
                tab === key ? "text-primary" : "text-muted-foreground"
              )}
              aria-current={tab === key ? "page" : undefined}
              onClick={() => setTab(key)}
            >
              <Icon className="size-5" />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
