# ADR 0003 — 行情数据源：天天基金 fundmobapi + 腾讯 qt.gtimg

日期：2026-09-02
状态：已接受

## 背景

ADR 0002 决定现价自动取得，而 v1 是纯前端静态应用（无后端、无代理），数据源必须能被浏览器直接 `fetch`。
曾考虑的候选经实测淘汰：蛋卷基金 djapi（WAF 反爬 + 无 CORS）、新浪行情 hq.sinajs.cn（Referer 强校验，
非新浪域名一律 403，浏览器无法伪造）、天天基金 fundgz（2026-07 起下线）、东财 push2（CORS 可用但实测
偶发限频、价格字段 ×100 缩放）、fund.eastmoney.com 档案接口（无 CORS，只能 `<script>` 注入且体积大）。

## 决策

- 场外基金（名称 + 最新单位净值 + 净值日期）：天天基金移动端接口
  `fundmobapi.eastmoney.com/FundMNewApi/FundMNNBasicInformation?FCODE={code}&...`
  实测响应头 `Access-Control-Allow-Origin: *`，UTF-8 JSON，字段 SHORTNAME/DWJZ/FSRQ。
- A股股票（名称 + 最新价）：腾讯 `qt.gtimg.cn/q=sh{code}` / `sz{code}`，
  实测 `Access-Control-Allow-Origin: *`；GBK 编码需 `TextDecoder('gbk')` 解码。
- 兜底：基金用腾讯 `s_jj{code}`，股票用东财 push2；接口失败时沿用上次价并标记。
- 添加标的按代码分类：先查场外基金源，未命中再按行情源判沪/深前缀，仍失败允许用户手动指定类型。

## 后果

- 依赖无 SLA 的私有接口，字段靠命名/位置解析，较脆弱：适配层集中封装、可注入测试，UI 与领域核心不直连数据源。
- 基金净值每日傍晚才更新：白天展示最近已公布净值（即上一交易日），不做盘中估值。
- 港美股不在 v1 范围，但腾讯 qt.gtimg 同域预留 `r_hk`/`us` 前缀，后续可低成本扩展。
