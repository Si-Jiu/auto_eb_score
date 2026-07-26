# EB Auto Score

[English](./README.md) | [中文（香港）](./README_zh_HK.md) | [粵語（香港）](./README_yue_HK.md)

一個用戶腳本，可以自動幫 Wiseman LMS（`lms1.wiseman.com.hk`）上面嘅 EB 課節評分。
佢會喺課節列表頁面加一個浮動控制面板，你可以設定目標分數（固定或者隨機範圍）、
選擇性嘅課節之間延遲，同埋要處理邊啲課節（只係未完成／新課節，或者亦都重做低過分數門檻嘅課節），
然後針對而家呢課或者批次自動處理晒所有符合條件嘅課節。

## 安裝

1. 喺瀏覽器度安裝用戶腳本管理器：
   - [Tampermonkey](https://www.tampermonkey.net/)（Chrome、Firefox、Edge、Safari）
   - [Violentmonkey](https://violentmonkey.github.io/)（Chrome、Firefox、Edge）
2. 撳[呢度](https://github.com/devcme/auto_eb_score/raw/refs/heads/main/eb_auto_score.user.js)然後安裝腳本。
3. 登錄 English Builder — 控制面板會自動喺右上角出現。

### 更新

用戶腳本管理器會自動檢查 `@version` 標頭嚟更新。
如果新版本冇出現，請喺管理器度打開腳本頁面然後撳 **檢查更新**。

## 授權

[MIT](./LICENSE)
