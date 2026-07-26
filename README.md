# EB Auto Score

[English](./README.md) | [中文（香港）](./README_zh_HK.md) | [粵語（香港）](./README_yue_HK.md)

A userscript that automates scoring EB lessons on the Wiseman LMS
(`lms1.wiseman.com.hk`). It adds a floating control panel to the lesson list
page where you can set a target score (fixed or random range), an optional
delay between lessons, and which lessons to target (incomplete/new only, or
also redo lessons below a score threshold), then run it against the current
lesson or batch through every matching lesson automatically.

## Install

1. Install a userscript manager in your browser:
   - [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Firefox, Edge, Safari)
   - [Violentmonkey](https://violentmonkey.github.io/) (Chrome, Firefox, Edge)
2. Open [`eb_auto_score.user.js`](./eb_auto_score.user.js) in this repo and
   click **Raw**, or use this direct link:
   `https://github.com/devcme/auto_eb_score/raw/refs/heads/main/eb_auto_score.user.js`
3. Your userscript manager should detect the script and prompt you to
   install it. Confirm the install.
4. Log in to English Builder — the control panel appears automatically in the top-right corner.

### Updating

Userscript managers check the `@version` header for updates automatically.
If a new version doesn't appear, open the script's page in your manager and
click **Check for updates**.

## License

[MIT](./LICENSE)
