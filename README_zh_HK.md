# EB Auto Score

[English](./README.md) | [中文（香港）](./README_zh_HK.md) | [粵語（香港）](./README_yue_HK.md)

一個用戶腳本，可自動為 Wiseman LMS（`lms1.wiseman.com.hk`）上的 EB 課節評分。
它在課節列表頁面添加一個浮動控制面板，你可以設定目標分數（固定或隨機範圍）、
可選的課節之間延遲，以及要處理的課節（僅未完成／新課節，或同時重做低於分數門檻的課節），
然後針對當前課節或批次自動處理所有符合條件的課節。

## 安裝

1. 在瀏覽器中安裝用戶腳本管理器：
   - [Tampermonkey](https://www.tampermonkey.net/)（Chrome、Firefox、Edge、Safari）
   - [Violentmonkey](https://violentmonkey.github.io/)（Chrome、Firefox、Edge）
2. 在本倉庫中打開 [`eb_auto_score.user.js`](./eb_auto_score.user.js) 並點擊 **Raw**，
   或使用此直接連結：
   `https://github.com/devcme/auto_eb_score/raw/refs/heads/main/eb_auto_score.user.js`
3. 你的用戶腳本管理器應會檢測到腳本並提示安裝。確認安裝。
4. 登錄 English Builder — 控制面板會自動出現在右上角。

### 更新

用戶腳本管理器會自動檢查 `@version` 標頭來更新。
如果新版本沒有出現，請在管理器中打開腳本頁面並點擊 **檢查更新**。

## 授權

[MIT](./LICENSE)
