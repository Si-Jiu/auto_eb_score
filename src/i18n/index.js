import { TRANSLATIONS, LANG_CODES, langLabel } from './_registry.js';

export { TRANSLATIONS, LANG_CODES, langLabel };

const LANG_KEY = 'eb_auto_lang';

export let currentLang;

export function loadLang() {
    const lang = localStorage.getItem(LANG_KEY);
    if (lang && TRANSLATIONS[lang]) return lang;
    return 'en_US';
}

currentLang = loadLang();

export function t(key, ...args) {
    let str = (TRANSLATIONS[currentLang] && TRANSLATIONS[currentLang][key])
        || TRANSLATIONS.en_US[key] || key;
    for (let i = 0; i < args.length; i++) {
        str = str.replace('{' + i + '}', args[i]);
    }
    return str;
}

export function setLang(lang, applyFn) {
    if (!TRANSLATIONS[lang]) return;
    currentLang = lang;
    localStorage.setItem(LANG_KEY, lang);
    if (applyFn) applyFn();
}

export function applyTranslations(panel) {
    if (!panel) return;
    panel.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (key) el.textContent = t(key);
    });
    panel.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.dataset.i18nTitle;
        if (key) el.setAttribute('title', t(key));
    });
    panel.querySelectorAll('[data-i18n-aria]').forEach(el => {
        const key = el.dataset.i18nAria;
        if (key) el.setAttribute('aria-label', t(key));
    });

    // Update select option headlines
    const filterMode = document.getElementById('eb-filter-mode');
    if (filterMode) {
        const opts = filterMode.querySelectorAll('md-select-option [slot="headline"]');
        if (opts[0]) opts[0].textContent = t('incompleteNewOnly');
        if (opts[1]) opts[1].textContent = t('alsoRedoLowScores');
    }

    // Update text field labels
    document.getElementById('eb-score-fixed').label = t('scoreLabel');
    document.getElementById('eb-score-min').label = t('min');
    document.getElementById('eb-score-max').label = t('max');
    document.getElementById('eb-delay-min').label = t('min');
    document.getElementById('eb-delay-max').label = t('max');

    const logEl = document.getElementById('eb-log');
    if (logEl && logEl.textContent.trim() === '') {
        logEl.setAttribute('data-empty', t('noActivityYet'));
    }
    const langSel = document.getElementById('eb-lang-select');
    if (langSel) {
        setTimeout(() => { langSel.value = currentLang; }, 0);
    }
}
