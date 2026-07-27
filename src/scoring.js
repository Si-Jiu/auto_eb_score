import { randInt, randFloat } from './utils.js';
import { t } from './i18n/index.js';
import { log } from './ui.js';

export function resolveScore(s) {
    if (s.scoreMode === 'fixed') return s.scoreFixed;
    return randInt(Math.min(s.scoreMin, s.scoreMax), Math.max(s.scoreMin, s.scoreMax));
}

export function resolveDelaySec(s) {
    const lo = Math.min(s.delayMin, s.delayMax);
    const hi = Math.max(s.delayMin, s.delayMax);
    if (hi <= 0) return 0;
    return Math.round(randFloat(lo, hi) * 60);
}

export async function initAndCommitAPI(outerIframe, score) {
    const outerWin = outerIframe.contentWindow;
    if (!outerWin || !outerWin.API) {
        log(t('msgErrorNoApi'));
        return false;
    }
    const api = outerWin.API;
    if (api.isInitialized !== 'true') {
        api.LMSInitialize('');
        await new Promise(r => setTimeout(r, 500));
    }
    if (api.isInitialized !== 'true') {
        log(t('msgErrorInitFailed'));
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
        log(t('msgPostHttpStatus', xhr.status));
        if (xhr.status !== 200) return false;
    } catch (e) {
        log(t('msgXhrError', e.message));
        return false;
    }

    api.LMSFinish('');
    return true;
}
