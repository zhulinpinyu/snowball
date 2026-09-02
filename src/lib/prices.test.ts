import { describe, expect, it } from "vitest"
import {
  NotFoundError,
  fundQuote,
  lookupInstrument,
  parseFundMobiJson,
  parsePush2Json,
  parseQtFundText,
  parseQtStockText,
  stockMarketOf,
  stockQuote,
  type FetchLike,
} from "./prices"

describe("代码市场前缀判定", () => {
  it("6/5/9 开头 → 沪；0/1/2/3 → 深；其余 → null", () => {
    expect(stockMarketOf("600519")).toBe("sh")
    expect(stockMarketOf("510300")).toBe("sh")
    expect(stockMarketOf("000001")).toBe("sz")
    expect(stockMarketOf("300750")).toBe("sz")
    expect(stockMarketOf("430047")).toBe(null)
  })
})

describe("解析函数（纯）", () => {
  it("fundmobapi：名称/净值/净值日期；非基金返回 null；净值缺失为 null", () => {
    expect(
      parseFundMobiJson({
        Datas: [{ SHORTNAME: "天弘沪深300ETF联接A", DWJZ: 1.6393, FSRQ: "2026-09-02" }],
      })
    ).toEqual({ name: "天弘沪深300ETF联接A", price: 1.6393, date: "2026-09-02" })
    expect(parseFundMobiJson({ Datas: null })).toBeNull()
    expect(parseFundMobiJson({ Datas: [{ SHORTNAME: "某新基金", DWJZ: null }] })).toEqual({
      name: "某新基金",
      price: null,
      date: null,
    })
  })

  it("腾讯基金 s_jj：名称/净值/净值日期", () => {
    const text = `v_s_jj000961="000961~天弘沪深300ETF联接A~20260902~1.6393~1.6393~-1.31~";`
    expect(parseQtFundText(text)).toEqual({
      name: "天弘沪深300ETF联接A",
      price: 1.6393,
      date: "2026-09-02",
    })
  })

  it("腾讯股票：名称/现价/行情日期", () => {
    const parts = Array.from({ length: 35 }, (_, i) => {
      if (i === 1) return "贵州茅台"
      if (i === 3) return "1500.00"
      if (i === 30) return "20260902150000"
      return "0"
    })
    const text = `v_sh600519="${parts.join("~")}";`
    expect(parseQtStockText(text)).toEqual({
      name: "贵州茅台",
      price: 1500,
      date: "2026-09-02",
    })
  })

  it("东财 push2：价格 ×100 还原", () => {
    const ts = 1756800000
    const hit = parsePush2Json({ data: { f57: "600519", f58: "贵州茅台", f43: 150000, f86: ts } })
    expect(hit?.price).toBe(1500)
    expect(hit?.date).toBe(new Date(ts * 1000).toISOString().slice(0, 10))
  })
})

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  })
}

describe("取价（注入 fetch）", () => {
  it("基金：fundmobapi 命中即返回，不再请求兜底源", async () => {
    const urls: string[] = []
    const fetchImpl: FetchLike = async (url) => {
      urls.push(url)
      return jsonResponse({
        Datas: [{ SHORTNAME: "天弘沪深300ETF联接A", DWJZ: 1.6393, FSRQ: "2026-09-02" }],
      })
    }
    const q = await fundQuote("000961", fetchImpl)
    expect(q).toEqual({ name: "天弘沪深300ETF联接A", price: 1.6393, date: "2026-09-02" })
    expect(urls).toHaveLength(1)
  })

  it("基金：主源未命中 → 兜底腾讯 s_jj", async () => {
    const fetchImpl: FetchLike = async (url) =>
      url.includes("fundmobapi")
        ? jsonResponse({ Datas: null })
        : new Response(`v_s_jj000961="000961~A-FUND~20260901~2.0~2.0~";`)
    const q = await fundQuote("000961", fetchImpl)
    expect(q).toEqual({ name: "A-FUND", price: 2, date: "2026-09-01" })
  })

  it("股票：腾讯命中；空行回退东财 push2", async () => {
    const fetchImpl: FetchLike = async (url) =>
      url.includes("qt.gtimg")
        ? new Response(`v_sh600519="";`)
        : jsonResponse({ data: { f57: "600519", f58: "贵州茅台", f43: 150000, f86: 1756800000 } })
    const q = await stockQuote("600519", "sh", fetchImpl)
    expect(q?.name).toBe("贵州茅台")
    expect(q?.price).toBe(1500)
  })

  it("两个源都查无 → NotFoundError", async () => {
    const fetchImpl: FetchLike = async () => new Response("", { status: 200 })
    await expect(stockQuote("999999", "sh", fetchImpl)).rejects.toThrow()
  })
})

describe("添加标的口 lookupInstrument", () => {
  it("只命中基金（代码也被判为深市但股票源查无）→ 基金", async () => {
    const fetchImpl: FetchLike = async (url) =>
      url.includes("fundmobapi") || url.includes("s_jj")
        ? jsonResponse({ Datas: [{ SHORTNAME: "天弘沪深300ETF联接A", DWJZ: 1.6, FSRQ: "2026-09-02" }] })
        : new Response(`v_sz000961="";`)
    const hits = await lookupInstrument("000961", fetchImpl)
    expect(hits).toEqual([
      { kind: "fund", name: "天弘沪深300ETF联接A", price: 1.6, date: "2026-09-02" },
    ])
  })

  it("只命中股票 → 带 market", async () => {
    const parts = Array.from({ length: 35 }, (_, i) => {
      if (i === 1) return "Kweichow Moutai"
      if (i === 3) return "1500"
      if (i === 30) return "20260902150000"
      return "0"
    })
    const fetchImpl: FetchLike = async (url) =>
      url.includes("fundmobapi") || url.includes("s_jj")
        ? jsonResponse({ Datas: null })
        : new Response(`v_sh600519="${parts.join("~")}";`)
    const hits = await lookupInstrument("600519", fetchImpl)
    expect(hits).toEqual([
      { kind: "stock", name: "Kweichow Moutai", market: "sh", price: 1500, date: "2026-09-02" },
    ])
  })

  it("两个源都查无 → NotFoundError", async () => {
    const fetchImpl: FetchLike = async () => jsonResponse({ Datas: null })
    await expect(lookupInstrument("999999", fetchImpl)).rejects.toBeInstanceOf(NotFoundError)
  })
})
