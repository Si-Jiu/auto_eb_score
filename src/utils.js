export function randInt(a, b) {
    return Math.floor(Math.random() * (b - a + 1)) + a;
}

export function randFloat(a, b) {
    return Math.random() * (b - a) + a;
}

export function waitMs(ms) {
    return new Promise(r => setTimeout(r, ms));
}

export function numVal(id, fallback) {
    const v = parseFloat(document.getElementById(id).value);
    return isNaN(v) ? fallback : v;
}

export function formatSeconds(s) {
    if (s <= 0) return '0s';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return (m > 0 ? m + 'm ' : '') + sec + 's';
}
