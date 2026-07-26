// ==UserScript==
// @name         EB Auto Score
// @namespace    http://tampermonkey.net/
// @version      4.0.0
// @description  Auto submit score for EB lessons
// @match        https://lms1.wiseman.com.hk/lms/user/secure/course/eb/select_lesson/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const LIST_URL = 'https://lms1.wiseman.com.hk/lms/user/secure/course/eb/select_lesson/index.shtml';
    const STATE_KEY = 'eb_auto_state';
    const CONFIG_KEY = 'eb_auto_config';
    const THEME_KEY = 'eb_auto_theme';
    let panel = null;
    let isMinimized = false;
    let isRunning = false;
    let stopRequested = false;

    function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
    function randFloat(a, b) { return Math.random() * (b - a) + a; }
    function waitMs(ms) { return new Promise(r => setTimeout(r, ms)); }
    function numVal(id, fallback) { const v = parseFloat(document.getElementById(id).value); return isNaN(v) ? fallback : v; }

    function formatSeconds(s) {
        if (s <= 0) return '0s';
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return (m > 0 ? m + 'm ' : '') + sec + 's';
    }

    function loadState() { try { return JSON.parse(localStorage.getItem(STATE_KEY)); } catch (e) { return null; } }
    function saveState(s) { localStorage.setItem(STATE_KEY, JSON.stringify(s)); }
    function clearState() { localStorage.removeItem(STATE_KEY); }

    function systemPrefersLight() {
        try { return window.matchMedia('(prefers-color-scheme: light)').matches; } catch (e) { return false; }
    }

    function loadTheme() {
        const t = localStorage.getItem(THEME_KEY);
        if (t === 'light' || t === 'dark') return t;
        return systemPrefersLight() ? 'light' : 'dark';
    }

    function applyTheme(theme, persist) {
        const light = theme === 'light';
        panel.classList.toggle('eb-theme-light', light);
        const cb = document.getElementById('eb-theme-toggle');
        if (cb) {
            cb.checked = !light;
            const sw = cb.closest('.eb-switch');
            if (sw) sw.title = light ? 'Switch to dark mode' : 'Switch to light mode';
        }
        if (persist) localStorage.setItem(THEME_KEY, theme);
    }

    function loadConfig() { try { return JSON.parse(localStorage.getItem(CONFIG_KEY)) || {}; } catch (e) { return {}; } }
    function persistConfig() {
        const cfg = readUIConfig();
        localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
    }

    function readUIConfig() {
        return {
            scoreMode: document.querySelector('input[name="eb-score-mode"]:checked').value,
            scoreFixed: numVal('eb-score-fixed', 100),
            scoreMin: numVal('eb-score-min', 85),
            scoreMax: numVal('eb-score-max', 100),
            delayMin: numVal('eb-delay-min', 0),
            delayMax: numVal('eb-delay-max', 0),
            filterMode: document.getElementById('eb-filter-mode').value,
            filterScoreBelow: numVal('eb-filter-score', 100),
            logVisible: document.getElementById('eb-log-toggle').checked
        };
    }

    function resolveScore(s) {
        if (s.scoreMode === 'fixed') return s.scoreFixed;
        return randInt(Math.min(s.scoreMin, s.scoreMax), Math.max(s.scoreMin, s.scoreMax));
    }

    function resolveDelaySec(s) {
        const lo = Math.min(s.delayMin, s.delayMax);
        const hi = Math.max(s.delayMin, s.delayMax);
        if (hi <= 0) return 0;
        return Math.round(randFloat(lo, hi) * 60);
    }

    function log(msg) {
        const el = document.getElementById('eb-log');
        if (el) {
            el.textContent += '[' + new Date().toLocaleTimeString() + '] ' + msg + '\n';
            el.scrollTop = el.scrollHeight;
        }
        console.log('[EB Auto]', msg);
    }

    function setLogVisible(v) {
        const el = document.getElementById('eb-log');
        const cb = document.getElementById('eb-log-toggle');
        if (el) el.classList.toggle('eb-log-hidden', !v);
        if (cb) {
            cb.checked = v;
            const sw = cb.closest('.eb-switch');
            if (sw) sw.title = v ? 'Hide activity log' : 'Show activity log';
        }
    }

    function applyConfigToUI(c) {
        if (!c) return;
        const r = document.querySelector('input[name="eb-score-mode"][value="' + (c.scoreMode || 'fixed') + '"]');
        if (r) r.checked = true;
        if (c.scoreFixed != null) document.getElementById('eb-score-fixed').value = c.scoreFixed;
        if (c.scoreMin != null) document.getElementById('eb-score-min').value = c.scoreMin;
        if (c.scoreMax != null) document.getElementById('eb-score-max').value = c.scoreMax;
        if (c.delayMin != null) document.getElementById('eb-delay-min').value = c.delayMin;
        if (c.delayMax != null) document.getElementById('eb-delay-max').value = c.delayMax;
        if (c.filterMode) document.getElementById('eb-filter-mode').value = c.filterMode;
        if (c.filterScoreBelow != null) document.getElementById('eb-filter-score').value = c.filterScoreBelow;
        if (c.logVisible != null) setLogVisible(c.logVisible);
    }

    function setRunning(v) {
        isRunning = v;
        document.getElementById('eb-btn-one').disabled = v;
        document.getElementById('eb-btn-all').disabled = v;
        document.getElementById('eb-btn-stop').classList.toggle('eb-visible', v);
    }

    function setFilterScoreVisible(v) {
        const wrap = document.getElementById('eb-filter-score-wrap');
        if (wrap) wrap.classList.toggle('eb-visible', !!v);
    }

    async function showCountdown(seconds) {
        if (seconds <= 0) return;
        const el = document.getElementById('eb-countdown');
        const label = document.getElementById('eb-countdown-label');
        const bar = document.getElementById('eb-progress-bar');
        el.classList.add('eb-visible');
        for (let i = seconds; i >= 0; i--) {
            if (stopRequested) { el.classList.remove('eb-visible'); bar.style.width = '0%'; return; }
            label.textContent = 'Next lesson in ' + formatSeconds(i);
            bar.style.width = ((seconds - i) / seconds * 100).toFixed(1) + '%';
            await waitMs(1000);
        }
        el.classList.remove('eb-visible');
        bar.style.width = '0%';
    }

    // ---- UI ----

    function createPanel() {
        panel = document.createElement('div');
        panel.id = 'eb-auto-panel';
        panel.innerHTML = `
            <div id="eb-panel-inner">
                <div id="eb-panel-title">
                    <span id="eb-title-text">EB Auto Score</span>
                    <span id="eb-version">4.0.0</span>
                    <label class="eb-switch" title="Switch to light mode">
                        <input id="eb-theme-toggle" type="checkbox" checked aria-label="Dark mode"/>
                        <span class="eb-switch-track">
                            <span class="eb-switch-handle">
                                <svg class="eb-icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21q-3.75 0-6.37-2.63T3 12q0-3.75 2.63-6.38T12 3q.35 0 .69.03.34.02.67.07-1.03.73-1.64 1.9-.62 1.17-.62 2.5 0 2.23 1.56 3.79Q14.22 12.85 16.45 12.85q1.35 0 2.51-.61 1.16-.62 1.87-1.64.05.33.08.67.02.34.02.68 0 3.75-2.62 6.38T12 21"/></svg>
                                <svg class="eb-icon-sun" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 17q-2.08 0-3.54-1.46Q7 14.08 7 12t1.46-3.54Q9.92 7 12 7t3.54 1.46Q17 9.92 17 12t-1.46 3.54Q14.08 17 12 17M2 13q-.42 0-.71-.29Q1 12.42 1 12t.29-.71Q1.58 11 2 11h2q.42 0 .71.29.29.29.29.71t-.29.71Q4.42 13 4 13zm18 0q-.42 0-.71-.29Q19 12.42 19 12t.29-.71q.29-.29.71-.29h2q.42 0 .71.29.29.29.29.71t-.29.71Q22.42 13 22 13zm-8-8q-.42 0-.71-.29Q11 4.42 11 4V2q0-.42.29-.71Q11.58 1 12 1t.71.29Q13 1.58 13 2v2q0 .42-.29.71Q12.42 5 12 5m0 18q-.42 0-.71-.29Q11 22.42 11 22v-2q0-.42.29-.71.29-.29.71-.29t.71.29q.29.29.29.71v2q0 .42-.29.71-.29.29-.71.29M5.65 7.05 4.575 6q-.3-.275-.288-.7.013-.425.288-.725.3-.3.725-.3t.7.3L7.05 5.65q.275.3.275.7 0 .4-.275.7-.275.3-.687.287-.413-.012-.713-.287M18 19.425l-1.05-1.075q-.275-.3-.275-.712 0-.413.275-.688.275-.3.688-.287.412.012.712.287L19.425 18q.3.275.288.7-.013.425-.288.725-.3.3-.725.3t-.7-.3M16.95 7.05q-.3-.275-.287-.688.012-.412.287-.712L18 4.575q.275-.3.7-.288.425.013.725.288.3.3.3.725t-.3.7L18.35 7.05q-.3.275-.7.275-.4 0-.7-.275M4.575 19.425q-.3-.3-.3-.725t.3-.7l1.075-1.05q.3-.275.712-.275.413 0 .688.275.3.275.287.688-.012.412-.287.712L6 19.425q-.275.3-.7.288-.425-.013-.725-.288"/></svg>
                            </span>
                        </span>
                    </label>
                    <button id="eb-btn-toggle" class="eb-icon-btn" title="Collapse panel" aria-label="Collapse panel" aria-expanded="true">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.4 15.4 6 14l6-6 6 6-1.4 1.4L12 10.8z"/></svg>
                    </button>
                </div>
                <div id="eb-panel-body">
                    <fieldset class="eb-card">
                        <legend class="eb-card-title">Target score</legend>
                        <div class="eb-row">
                            <label class="eb-radio">
                                <input type="radio" name="eb-score-mode" value="fixed" checked/>
                                <span class="eb-radio-mark"></span>
                                <span class="eb-radio-label">Fixed</span>
                            </label>
                            <input id="eb-score-fixed" class="eb-input" type="number" value="100" min="0" max="100" aria-label="Fixed score"/>
                        </div>
                        <div class="eb-row">
                            <label class="eb-radio">
                                <input type="radio" name="eb-score-mode" value="random"/>
                                <span class="eb-radio-mark"></span>
                                <span class="eb-radio-label">Range</span>
                            </label>
                            <input id="eb-score-min" class="eb-input" type="number" value="85" min="0" max="100" aria-label="Lowest score"/>
                            <span class="eb-affix">to</span>
                            <input id="eb-score-max" class="eb-input" type="number" value="100" min="0" max="100" aria-label="Highest score"/>
                        </div>
                    </fieldset>
                    <fieldset class="eb-card">
                        <legend class="eb-card-title">Delay between lessons</legend>
                        <div class="eb-row eb-row-fields">
                            <label class="eb-field">
                                <span class="eb-field-label">Min</span>
                                <input id="eb-delay-min" type="number" value="0" min="0" step="0.1"/>
                            </label>
                            <label class="eb-field">
                                <span class="eb-field-label">Max</span>
                                <input id="eb-delay-max" type="number" value="0" min="0" step="0.1"/>
                            </label>
                        </div>
                        <p class="eb-support">Minutes. Set both to 0 to score without waiting.</p>
                    </fieldset>
                    <fieldset class="eb-card">
                        <legend class="eb-card-title">Which lessons</legend>
                        <div class="eb-select-wrap">
                            <select id="eb-filter-mode" aria-label="Lesson filter">
                                <option value="incomplete">Incomplete and new only</option>
                                <option value="score_below">Also redo low scores</option>
                            </select>
                            <svg class="eb-select-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6z"/></svg>
                        </div>
                        <div id="eb-filter-score-wrap" class="eb-row">
                            <span class="eb-affix">Redo when score is below</span>
                            <input id="eb-filter-score" class="eb-input" type="number" value="100" min="0" max="100" aria-label="Score threshold"/>
                        </div>
                    </fieldset>
                    <div id="eb-actions">
                        <button id="eb-btn-all" class="eb-btn eb-btn-filled">Score all matching</button>
                        <button id="eb-btn-one" class="eb-btn eb-btn-tonal">Score current lesson</button>
                        <button id="eb-btn-stop" class="eb-btn eb-btn-error">Stop</button>
                    </div>
                    <div id="eb-countdown">
                        <span id="eb-countdown-label">Waiting</span>
                        <span id="eb-progress-track"><span id="eb-progress-bar"></span></span>
                    </div>
                    <div class="eb-card">
                        <div class="eb-log-header">
                            <span class="eb-card-title">Activity log</span>
                            <label class="eb-switch eb-switch-sm" title="Hide activity log">
                                <input id="eb-log-toggle" type="checkbox" checked aria-label="Show activity log"/>
                                <span class="eb-switch-track"><span class="eb-switch-handle"></span></span>
                            </label>
                        </div>
                        <div id="eb-log" role="log" aria-live="polite"></div>
                    </div>
                </div>
            </div>
        `;
        const style = document.createElement('style');
        style.textContent = `
            #eb-auto-panel{
                --eb-surface:#141218;--eb-surface-1:#1D1B20;--eb-surface-2:#211F26;--eb-surface-3:#2B2930;
                --eb-on-surface:#E6E0E9;--eb-on-surface-var:#CAC4D0;--eb-outline:#938F99;--eb-outline-var:#49454F;
                --eb-primary:#D0BCFF;--eb-on-primary:#381E72;--eb-primary-container:#4F378B;
                --eb-secondary-container:#4A4458;--eb-on-secondary-container:#E8DEF8;
                --eb-error:#F2B8B5;--eb-on-error:#601410;
                --eb-surface-highest:#36343B;--eb-disabled:230,224,233;
                --eb-on-primary-container:#EADDFF;
                --eb-ease:cubic-bezier(.2,0,0,1);
                position:fixed;top:60px;right:16px;z-index:999999;
                font-family:Roboto,"Segoe UI",system-ui,-apple-system,sans-serif;
                width:328px;color:var(--eb-on-surface);line-height:normal;
                -webkit-font-smoothing:antialiased;
            }
            #eb-auto-panel.eb-theme-light{
                --eb-surface:#FEF7FF;--eb-surface-1:#F7F2FA;--eb-surface-2:#F3EDF7;--eb-surface-3:#ECE6F0;
                --eb-surface-highest:#E6E0E9;--eb-disabled:28,27,31;
                --eb-on-surface:#1D1B20;--eb-on-surface-var:#49454F;--eb-outline:#79747E;--eb-outline-var:#CAC4D0;
                --eb-primary:#6750A4;--eb-on-primary:#FFFFFF;--eb-primary-container:#EADDFF;
                --eb-on-primary-container:#21005D;
                --eb-secondary-container:#E8DEF8;--eb-on-secondary-container:#1D192B;
                --eb-error:#B3261E;--eb-on-error:#FFFFFF;
            }
            #eb-auto-panel *{box-sizing:border-box;margin:0;padding:0;font-family:inherit;text-transform:none;float:none}
            #eb-panel-inner{
                background:var(--eb-surface-1);border-radius:28px;overflow:hidden;
                box-shadow:0 8px 12px 6px rgba(0,0,0,.15),0 4px 4px rgba(0,0,0,.3);
            }
            /* Top app bar */
            #eb-panel-title{
                display:flex;align-items:center;gap:8px;height:56px;padding:0 8px 0 20px;
                background:var(--eb-surface-3);cursor:grab;user-select:none;
            }
            #eb-panel-title:active{cursor:grabbing}
            #eb-title-text{font-size:16px;font-weight:500;letter-spacing:.15px;flex:1}
            #eb-version{
                font-size:11px;font-weight:500;letter-spacing:.5px;color:var(--eb-on-secondary-container);
                background:var(--eb-secondary-container);border-radius:8px;padding:4px 8px;
            }
            /* Theme switch */
            .eb-switch{position:relative;display:inline-flex;flex:0 0 auto;cursor:pointer}
            .eb-switch input{position:absolute;opacity:0;width:0;height:0}
            .eb-switch-track{
                position:relative;display:block;width:48px;height:30px;border-radius:15px;
                background:var(--eb-surface-highest);border:2px solid var(--eb-outline);
                transition:background-color .2s var(--eb-ease),border-color .2s var(--eb-ease);
            }
            .eb-switch-handle{
                position:absolute;top:50%;left:4px;transform:translateY(-50%);
                display:flex;align-items:center;justify-content:center;
                width:22px;height:22px;border-radius:50%;background:var(--eb-on-surface-var);
                transition:left .2s var(--eb-ease),background-color .2s var(--eb-ease),width .1s linear,height .1s linear;
            }
            .eb-switch-handle svg{width:14px;height:14px;fill:var(--eb-surface)}
            .eb-switch .eb-icon-sun{display:none}
            .eb-switch input:checked+.eb-switch-track{background:var(--eb-primary);border-color:var(--eb-primary)}
            .eb-switch input:checked+.eb-switch-track .eb-switch-handle{
                left:22px;background:var(--eb-on-primary)
            }
            .eb-switch input:checked+.eb-switch-track .eb-switch-handle svg{fill:var(--eb-on-primary-container)}
            .eb-switch input:not(:checked)+.eb-switch-track .eb-icon-sun{display:block}
            .eb-switch input:not(:checked)+.eb-switch-track .eb-icon-moon{display:none}
            .eb-switch:active .eb-switch-handle{width:26px;height:26px}
            .eb-switch input:focus-visible+.eb-switch-track{outline:2px solid var(--eb-primary);outline-offset:3px}
            .eb-switch-sm .eb-switch-track{width:36px;height:22px;border-radius:11px}
            .eb-switch-sm .eb-switch-handle{width:14px;height:14px;left:3px}
            .eb-switch-sm input:checked+.eb-switch-track .eb-switch-handle{left:16px}
            .eb-switch-sm:active .eb-switch-handle{width:16px;height:16px}
            .eb-icon-btn{
                position:relative;display:flex;align-items:center;justify-content:center;
                width:40px;height:40px;flex:0 0 40px;border:0;border-radius:50%;
                background:transparent;color:var(--eb-on-surface-var);cursor:pointer;overflow:hidden;
            }
            .eb-icon-btn svg{width:24px;height:24px;fill:currentColor;transition:transform .3s var(--eb-ease)}
            .eb-icon-btn::before{
                content:'';position:absolute;inset:0;background:currentColor;opacity:0;
                transition:opacity .15s linear;
            }
            .eb-icon-btn:hover::before{opacity:.08}
            .eb-icon-btn:focus-visible::before{opacity:.1}
            .eb-icon-btn.eb-collapsed svg{transform:rotate(180deg)}
            #eb-panel-body{
                padding:16px;display:flex;flex-direction:column;gap:12px;
                max-height:calc(100vh - 140px);overflow-y:auto;
                scrollbar-width:thin;scrollbar-color:var(--eb-outline-var) transparent;
                transition:max-height .35s var(--eb-ease),padding .35s var(--eb-ease)
            }
            #eb-panel-body::-webkit-scrollbar{width:6px}
            #eb-panel-body::-webkit-scrollbar-thumb{background:var(--eb-outline-var);border-radius:3px}
            #eb-panel-body.collapsed{max-height:0;padding-top:0;padding-bottom:0;overflow:hidden}
            /* Cards */
            #eb-auto-panel .eb-card{
                border:1px solid var(--eb-outline-var);border-radius:12px;
                padding:14px 16px 16px;background:var(--eb-surface-2);
                display:flex;flex-direction:column;gap:12px;
            }
            #eb-auto-panel .eb-card-title{
                font-size:14px;font-weight:500;letter-spacing:.1px;color:var(--eb-on-surface);
                padding:0;margin:0;float:none;width:auto;
            }
            .eb-log-header{display:flex;align-items:center;justify-content:space-between}
            #eb-log.eb-log-hidden{max-height:0;opacity:0;padding-top:0;padding-bottom:0;margin-top:-12px;overflow:hidden;border:0}
            .eb-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
            .eb-row-fields{gap:12px}
            .eb-affix{font-size:13px;letter-spacing:.25px;color:var(--eb-on-surface-var)}
            .eb-support{font-size:12px;letter-spacing:.4px;color:var(--eb-on-surface-var)}
            /* Radios */
            .eb-radio{display:inline-flex;align-items:center;gap:8px;cursor:pointer;min-width:88px}
            .eb-radio input{position:absolute;opacity:0;width:0;height:0}
            .eb-radio-mark{
                position:relative;width:20px;height:20px;flex:0 0 20px;border-radius:50%;
                border:2px solid var(--eb-on-surface-var);transition:border-color .15s linear;
            }
            .eb-radio-mark::after{
                content:'';position:absolute;inset:3px;border-radius:50%;background:var(--eb-primary);
                transform:scale(0);transition:transform .15s var(--eb-ease);
            }
            .eb-radio input:checked+.eb-radio-mark{border-color:var(--eb-primary)}
            .eb-radio input:checked+.eb-radio-mark::after{transform:scale(1)}
            .eb-radio input:focus-visible+.eb-radio-mark{outline:2px solid var(--eb-primary);outline-offset:3px}
            .eb-radio-label{font-size:14px;letter-spacing:.25px}
            /* Text fields */
            #eb-auto-panel input[type=number]{
                appearance:textfield;-moz-appearance:textfield;
                background:var(--eb-surface-3);color:var(--eb-on-surface);
                border:0;border-bottom:1px solid var(--eb-outline);border-radius:8px 8px 0 0;
                font-size:14px;letter-spacing:.25px;outline:none;transition:border-color .15s linear;
            }
            #eb-auto-panel input[type=number]::-webkit-inner-spin-button{display:none}
            #eb-auto-panel input[type=number]:focus{border-bottom:2px solid var(--eb-primary);padding-bottom:0}
            #eb-auto-panel input[type=number]:hover{border-bottom-color:var(--eb-on-surface)}
            #eb-auto-panel .eb-input{width:56px;height:40px;padding:0 10px 1px;text-align:center}
            #eb-auto-panel .eb-input:focus{padding-bottom:0}
            .eb-field{flex:1;display:flex;flex-direction:column;gap:2px;position:relative}
            .eb-field-label{font-size:11px;letter-spacing:.5px;color:var(--eb-on-surface-var);padding-left:12px}
            #eb-auto-panel .eb-field input{width:100%;height:38px;padding:0 12px 1px}
            /* Select */
            .eb-select-wrap{position:relative;display:block}
            #eb-auto-panel select{
                appearance:none;-webkit-appearance:none;width:100%;height:44px;
                padding:0 44px 1px 14px;background:var(--eb-surface-3);color:var(--eb-on-surface);
                border:0;border-bottom:1px solid var(--eb-outline);border-radius:8px 8px 0 0;
                font-size:14px;letter-spacing:.25px;cursor:pointer;outline:none;
            }
            #eb-auto-panel select:hover{border-bottom-color:var(--eb-on-surface)}
            #eb-auto-panel select:focus{border-bottom:2px solid var(--eb-primary);padding-bottom:0}
            #eb-auto-panel select option{background:var(--eb-surface-3);color:var(--eb-on-surface)}
            .eb-select-arrow{
                position:absolute;right:14px;top:50%;transform:translateY(-50%);
                width:20px;height:20px;fill:var(--eb-on-surface-var);pointer-events:none;
            }
            #eb-filter-score-wrap{display:none}
            #eb-filter-score-wrap.eb-visible{display:flex}
            /* Buttons */
            #eb-actions{display:flex;flex-direction:column;gap:8px}
            #eb-auto-panel .eb-btn{
                position:relative;display:flex;align-items:center;justify-content:center;
                width:100%;height:44px;border:0;border-radius:22px;cursor:pointer;overflow:hidden;
                font-size:14px;font-weight:500;letter-spacing:.1px;
                transition:box-shadow .15s linear,opacity .15s linear;
            }
            #eb-auto-panel .eb-btn::before{
                content:'';position:absolute;inset:0;background:currentColor;opacity:0;
                transition:opacity .15s linear;
            }
            #eb-auto-panel .eb-btn:hover::before{opacity:.08}
            #eb-auto-panel .eb-btn:focus-visible{outline:none}
            #eb-auto-panel .eb-btn:focus-visible::before{opacity:.1}
            #eb-auto-panel .eb-btn:hover{box-shadow:0 1px 3px 1px rgba(0,0,0,.15),0 1px 2px rgba(0,0,0,.3)}
            #eb-auto-panel .eb-btn:disabled{
                background:rgba(var(--eb-disabled),.12);color:rgba(var(--eb-disabled),.38);
                cursor:not-allowed;box-shadow:none;
            }
            #eb-auto-panel .eb-btn:disabled::before{opacity:0}
            .eb-btn-filled{background:var(--eb-primary);color:var(--eb-on-primary)}
            .eb-btn-tonal{background:var(--eb-secondary-container);color:var(--eb-on-secondary-container)}
            .eb-btn-error{background:var(--eb-error);color:var(--eb-on-error);display:none!important}
            .eb-btn-error.eb-visible{display:flex!important}
            .eb-ripple{
                position:absolute;border-radius:50%;background:currentColor;opacity:.24;
                transform:scale(0);pointer-events:none;animation:eb-ripple .5s var(--eb-ease) forwards;
            }
            @keyframes eb-ripple{to{transform:scale(1);opacity:0}}
            /* Linear progress */
            #eb-countdown{
                display:none;flex-direction:column;gap:10px;
                background:var(--eb-surface-2);border-radius:12px;padding:14px 16px;
            }
            #eb-countdown.eb-visible{display:flex}
            #eb-countdown-label{font-size:14px;font-weight:500;letter-spacing:.1px;color:var(--eb-primary)}
            #eb-progress-track{
                display:block;height:4px;border-radius:2px;
                background:var(--eb-secondary-container);overflow:hidden;
            }
            #eb-progress-bar{
                display:block;height:100%;width:0;border-radius:2px;
                background:var(--eb-primary);transition:width 1s linear;
            }
            /* Log */
            #eb-log{
                max-height:200px;overflow-y:auto;padding:12px 14px;border-radius:12px;
                background:var(--eb-surface);color:var(--eb-on-surface-var);
                font-family:"Roboto Mono",Consolas,monospace;font-size:11px;line-height:1.6;
                font-variant-ligatures:none;font-feature-settings:"liga" 0,"calt" 0;
                white-space:pre-wrap;word-break:break-word;scrollbar-width:thin;
                scrollbar-color:var(--eb-outline-var) transparent;
                transition:max-height .25s var(--eb-ease),opacity .2s linear,margin-top .25s var(--eb-ease);
            }
            #eb-log::-webkit-scrollbar{width:6px}
            #eb-log::-webkit-scrollbar-thumb{background:var(--eb-outline-var);border-radius:3px}
            #eb-log:empty::before{content:'No activity yet.';color:var(--eb-outline)}
            @media (max-width:480px){
                #eb-auto-panel{width:calc(100vw - 24px);right:12px;left:12px}
            }
            @media (prefers-reduced-motion:reduce){
                #eb-auto-panel *,#eb-auto-panel *::before,#eb-auto-panel *::after{
                    transition-duration:.01ms!important;animation-duration:.01ms!important
                }
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(panel);

        // Ripple (Material touch feedback)
        panel.querySelectorAll('.eb-btn, .eb-icon-btn').forEach(btn => {
            btn.addEventListener('pointerdown', e => {
                if (btn.disabled) return;
                if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
                const r = btn.getBoundingClientRect();
                const size = Math.max(r.width, r.height) * 2.2;
                const ink = document.createElement('span');
                ink.className = 'eb-ripple';
                ink.style.width = ink.style.height = size + 'px';
                ink.style.left = (e.clientX - r.left - size / 2) + 'px';
                ink.style.top = (e.clientY - r.top - size / 2) + 'px';
                ink.addEventListener('animationend', () => ink.remove());
                btn.appendChild(ink);
            });
        });

        // Drag
        const title = document.getElementById('eb-panel-title');
        let sx, sy, sl, st;
        title.addEventListener('mousedown', e => {
            if (e.target.closest('button, .eb-switch')) return;
            e.preventDefault();
            sx = e.clientX; sy = e.clientY;
            const r = panel.getBoundingClientRect();
            sl = r.left; st = r.top;
            const move = ev => { panel.style.left = (sl + ev.clientX - sx) + 'px'; panel.style.top = (st + ev.clientY - sy) + 'px'; panel.style.right = 'auto'; };
            const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', up);
        });

        // Toggle
        document.getElementById('eb-btn-toggle').addEventListener('click', () => {
            const body = document.getElementById('eb-panel-body');
            const btn = document.getElementById('eb-btn-toggle');
            isMinimized = !isMinimized;
            body.classList.toggle('collapsed', isMinimized);
            btn.classList.toggle('eb-collapsed', isMinimized);
            btn.title = isMinimized ? 'Expand panel' : 'Collapse panel';
            btn.setAttribute('aria-label', btn.title);
            btn.setAttribute('aria-expanded', String(!isMinimized));
        });

        // Theme switch
        document.getElementById('eb-theme-toggle').addEventListener('change', e => {
            applyTheme(e.target.checked ? 'dark' : 'light', true);
        });

        // Follow the OS scheme until the user picks a side
        try {
            window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', ev => {
                if (localStorage.getItem(THEME_KEY)) return;
                applyTheme(ev.matches ? 'light' : 'dark', false);
            });
        } catch (e) { }

        // Filter mode toggle
        document.getElementById('eb-filter-mode').addEventListener('change', () => {
            setFilterScoreVisible(document.getElementById('eb-filter-mode').value === 'score_below');
            persistConfig();
        });

        // Log visibility toggle
        document.getElementById('eb-log-toggle').addEventListener('change', e => {
            setLogVisible(e.target.checked);
        });

        // Auto-save config on any change
        const configInputs = panel.querySelectorAll('input, select');
        configInputs.forEach(el => {
            el.addEventListener('input', persistConfig);
            el.addEventListener('change', persistConfig);
        });

        // Buttons
        document.getElementById('eb-btn-one').addEventListener('click', handleScoreCurrent);
        document.getElementById('eb-btn-all').addEventListener('click', handleScoreAll);
        document.getElementById('eb-btn-stop').addEventListener('click', () => {
            stopRequested = true;
            clearState();
            log('Stopped.');
            setRunning(false);
        });

        // Theme (saved choice, else OS preference)
        applyTheme(loadTheme(), false);

        // Load saved config
        const savedCfg = loadConfig();
        if (Object.keys(savedCfg).length > 0) {
            applyConfigToUI(savedCfg);
            // trigger filter display
            setFilterScoreVisible(savedCfg.filterMode === 'score_below');
        }

        // Resume running state
        const runState = loadState();
        if (runState && runState.running) {
            applyConfigToUI(runState.settings);
            setFilterScoreVisible(runState.settings && runState.settings.filterMode === 'score_below');
            log('Resuming...');
            setTimeout(() => resume(runState), 1500);
        }
    }

    // ---- Lesson interaction ----

    async function clickOpenLesson(lessonId) {
        const link = document.querySelector('a.popup[data-id="' + lessonId + '"]');
        if (link) {
            link.click();
        } else {
            log('  Link not found');
            return null;
        }

        await waitMs(1500);

        let overlay = document.querySelector('.overlay-player');
        for (let i = 0; i < 20 && !overlay; i++) {
            await waitMs(500);
            overlay = document.querySelector('.overlay-player');
        }
        if (!overlay) { log('  Overlay failed'); return null; }

        log('  Waiting for SCORM API...');
        try {
            const win = overlay.contentWindow;
            for (let i = 0; i < 30; i++) {
                if (stopRequested) return null;
                if (win && win.API && win.API.isInitialized === 'true') break;
                await waitMs(1000);
            }
        } catch (e) {
            log('  Access error: ' + e.message);
        }

        return overlay;
    }

    async function handleDifficultySelection(overlayPlayer) {
        try {
            const outerDoc = overlayPlayer.contentDocument;
            if (!outerDoc) return;
            const innerIframe = outerDoc.querySelector('iframe');
            if (!innerIframe) return;

            let found = false;
            for (let i = 0; i < 15; i++) {
                if (stopRequested) return;
                try {
                    const d = innerIframe.contentDocument;
                    if (d && d.body && d.body.innerText && d.body.innerText.includes('LEVEL OF DIFFICULTY')) { found = true; break; }
                } catch (e) { }
                await waitMs(1000);
            }
            if (!found) return;

            log('  Difficulty detected, picking Challenging...');

            const doc1 = innerIframe.contentDocument;
            const challengingEl = findDeepestByText(doc1, 'Challenging');
            if (challengingEl) {
                challengingEl.click();
                log('  Clicked Challenging');
            }
            await waitMs(1000);

            let startBtn = null;
            for (let i = 0; i < 10; i++) {
                if (stopRequested) return;
                try {
                    const d = innerIframe.contentDocument;
                    startBtn = Array.from(d.querySelectorAll('button')).find(b => b.textContent.includes('Start Lessons') && !b.disabled);
                    if (startBtn) break;
                } catch (e) { }
                await waitMs(500);
            }
            if (startBtn) {
                startBtn.click();
                log('  Clicked Start Lessons');
            } else {
                log('  Start btn fallback: XPath...');
                try {
                    const d = innerIframe.contentDocument;
                    const result = d.evaluate('//button-group//button', d, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                    const btn = result.singleNodeValue;
                    if (btn) { btn.click(); log('  Clicked via XPath'); }
                } catch (e) { }
            }
            await waitMs(3000);

            try {
                const doc2 = innerIframe.contentDocument;
                const win2 = innerIframe.contentWindow;
                if (doc2 && win2) {
                    const options = findAnswerOptions(doc2, win2);
                    if (options.length > 0) {
                        options[Math.floor(Math.random() * options.length)].click();
                        await waitMs(500);
                        const sub = Array.from(doc2.querySelectorAll('button')).find(b => b.textContent.includes('Submit') && !b.disabled);
                        if (sub) sub.click();
                        log('  Answered Q1 randomly');
                        await waitMs(500);
                    }
                }
            } catch (e) { }
        } catch (e) {
            log('  Difficulty error: ' + e.message);
        }
    }

    function findDeepestByText(doc, text) {
        const xpath = `.//*[contains(text(),'${text}')]`;
        const r = doc.evaluate(xpath, doc.body, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        for (let i = r.snapshotLength - 1; i >= 0; i--) {
            const el = r.snapshotItem(i);
            if (el.textContent.trim().length < 50) return el;
        }
        return null;
    }

    function findAnswerOptions(doc, win) {
        try {
            const all = doc.querySelectorAll('div, span');
            const ptr = [];
            for (const el of all) {
                if (el.children.length > 2) continue;
                const t = el.textContent.trim();
                if (t.length < 3 || t.length > 100) continue;
                try { if (win.getComputedStyle(el).cursor === 'pointer') ptr.push(el); } catch (e) { }
            }
            const groups = {};
            for (const el of ptr) {
                const p = el.parentElement;
                if (!p) continue;
                if (!groups[p]) groups[p] = [];
                groups[p].push(el);
            }
            let best = [];
            for (const p in groups) { if (groups[p].length > best.length) best = groups[p]; }
            return best.length >= 2 ? best : [];
        } catch (e) { return []; }
    }

    async function initAndCommitAPI(outerIframe, score) {
        const outerWin = outerIframe.contentWindow;
        if (!outerWin || !outerWin.API) {
            log('  ERROR: No API');
            return false;
        }
        const api = outerWin.API;
        if (api.isInitialized !== 'true') {
            api.LMSInitialize('');
            await waitMs(500);
        }
        if (api.isInitialized !== 'true') {
            log('  ERROR: Init failed');
            return false;
        }

        api.LMSSetValue('cmi.core.score.raw', String(score));
        api.LMSSetValue('cmi.core.lesson_status', 'completed');

        const commitUrl = new URL('commit.do', outerWin.location.href).href;
        const payload = 'token=' + api.token + '&data=' + encodeURIComponent(JSON.stringify(api.cmiData));

        try {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', commitUrl, false);
            xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
            xhr.send(payload);
            log('  POST -> HTTP ' + xhr.status);
            if (xhr.status !== 200) return false;
        } catch (e) {
            log('  XHR error: ' + e.message);
            return false;
        }

        api.LMSFinish('');
        return true;
    }

    // ---- Task scanning ----

    function pickRandomTask(settings) {
        const tasks = [];
        document.querySelectorAll('table tbody tr').forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 5) return;
            const link = cells[2] && cells[2].querySelector('a.popup[data-id]');
            if (!link) return;
            const status = cells[3] ? cells[3].textContent.trim().toLowerCase() : '';
            const scoreText = cells[4] ? cells[4].textContent.trim() : '-';
            const scoreNum = parseInt(scoreText);

            let match = false;
            if (settings.filterMode === 'score_below') {
                if (status === 'new' || status === 'incomplete') {
                    match = true;
                } else if (!isNaN(scoreNum) && scoreNum < settings.filterScoreBelow) {
                    match = true;
                }
            } else {
                if (status === 'incomplete' || status === 'new') {
                    match = true;
                }
            }

            if (match) {
                tasks.push({
                    id: link.dataset.id,
                    name: cells[2].textContent.trim().replace(/\s+/g, ' ').substring(0, 70),
                    status: cells[3].textContent.trim(),
                    score: scoreText
                });
            }
        });
        return tasks.length > 0 ? tasks[randInt(0, tasks.length - 1)] : null;
    }

    // ---- Main flow ----

    async function doPhaseEnter(state) {
        setRunning(true);
        log('=== ENTER: ' + (state.lessonName || state.lessonId) + ' ===');

        const overlay = await clickOpenLesson(state.lessonId);
        if (!overlay) {
            log('  Failed to open, skipping...');
            await finishAndNext(state);
            return;
        }

        await handleDifficultySelection(overlay);

        log('  First visit done, 3s...');
        await waitMs(3000);

        if (stopRequested) { clearState(); setRunning(false); return; }

        state.phase = 'score';
        state.settings = readUIConfig();
        saveState(state);
        log('  Refreshing...');
        window.location.href = LIST_URL;
    }

    async function doPhaseScore(state) {
        setRunning(true);
        log('=== SCORE: ' + (state.lessonName || state.lessonId) + ' ===');

        const overlay = await clickOpenLesson(state.lessonId);
        if (!overlay) {
            log('  Failed to open, skipping...');
            await finishAndNext(state);
            return;
        }

        if (stopRequested) { clearState(); setRunning(false); return; }

        const cfg = readUIConfig();
        const delaySec = resolveDelaySec(cfg);
        if (delaySec > 0) {
            log('  Delay: ' + formatSeconds(delaySec));
            await showCountdown(delaySec);
        }

        if (stopRequested) { clearState(); setRunning(false); return; }

        const score = resolveScore(cfg);
        log('  Committing score: ' + score);
        const ok = await initAndCommitAPI(overlay, score);
        log(ok ? '  SUCCESS!' : '  FAILED!');

        log('  3s...');
        await waitMs(3000);

        await finishAndNext(state);
    }

    async function finishAndNext(state) {
        if (stopRequested) { clearState(); setRunning(false); return; }

        if (state.mode === 'all') {
            state.phase = 'enter';
            state.lessonId = null;
            state.lessonName = null;
            state.lessonStatus = null;
            state.settings = readUIConfig();
            saveState(state);
            log('  Next...');
            window.location.href = LIST_URL;
        } else {
            clearState();
            setRunning(false);
            log('  Done.');
            window.location.href = LIST_URL;
        }
    }

    // ---- Button handlers ----

    async function handleScoreCurrent() {
        if (isRunning) return;

        const overlay = document.querySelector('.overlay-player');
        if (!overlay || !overlay.contentWindow) {
            log('No lesson is currently open!');
            return;
        }

        const src = overlay.getAttribute('src') || '';
        const m = src.match(/id=([^&]+)/);
        if (!m) { log('Cannot detect lesson ID'); return; }

        const cfg = readUIConfig();
        const lessonId = m[1];

        setRunning(true);
        log('=== CURRENT LESSON ===');

        await handleDifficultySelection(overlay);

        log('  First visit, 3s...');
        await waitMs(3000);

        if (stopRequested) { clearState(); setRunning(false); return; }

        saveState({
            running: true,
            mode: 'one',
            phase: 'score',
            lessonId: lessonId,
            lessonName: '(current)',
            lessonStatus: '',
            settings: cfg
        });
        log('  Refreshing...');
        window.location.href = LIST_URL;
    }

    function handleScoreAll() {
        if (isRunning) return;
        const cfg = readUIConfig();
        saveState({
            running: true,
            mode: 'all',
            phase: 'enter',
            lessonId: null,
            lessonName: null,
            lessonStatus: null,
            settings: cfg
        });
        log('Starting batch...');
        window.location.href = LIST_URL;
    }

    // ---- Resume ----

    async function resume(state) {
        if (!state || !state.running) return;

        if (state.phase === 'enter') {
            if (!state.lessonId) {
                const cfg = readUIConfig();
                const task = pickRandomTask(cfg);
                if (!task) {
                    log('No matching tasks! Done.');
                    clearState();
                    setRunning(false);
                    return;
                }
                state.lessonId = task.id;
                state.lessonName = task.name;
                state.lessonStatus = task.status;
                log('Found: ' + task.name + ' [' + task.status + '] score=' + task.score);
            }
            await doPhaseEnter(state);
        } else if (state.phase === 'score') {
            await doPhaseScore(state);
        }
    }

    // ---- Init ----

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createPanel);
    } else {
        createPanel();
    }
})();
