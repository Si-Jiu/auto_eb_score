# EB Auto Score

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
   `https://raw.githubusercontent.com/Si-Jiu/auto_eb_score/main/eb_auto_score.user.js`
3. Your userscript manager should detect the script and prompt you to
   install it. Confirm the install.
4. Visit the EB lesson list page
   (`https://lms1.wiseman.com.hk/lms/user/secure/course/eb/select_lesson/`) —
   the control panel appears automatically in the top-right corner.

### Updating

Userscript managers check the `@version` header for updates automatically.
If a new version doesn't appear, open the script's page in your manager and
click **Check for updates**.

## License

[MIT](./LICENSE)
