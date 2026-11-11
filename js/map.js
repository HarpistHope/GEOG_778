// map.js — ForeignHokkaido map engine
// ArcGIS Maps SDK 4.26 is loaded from the CDN <script> in index.html (AMD), so every
// SDK class is obtained through the global `require`, never through ES-module imports.

import { t, municipalities, districts, subprefectures } from "./localization.js";

/* ==========================================================================
   CONSTANTS & STATE
   ========================================================================== */

const HOME = { center: [140.3, 42.09], zoom: 9 };
// Starting view: zoom 9 on wide screens; on narrow screens zoom out (fractionally) so the whole study area fits the width.
const homeView = (width = window.innerWidth) => ({
    center: HOME.center,
    zoom: window.matchMedia(MOBILE_QUERY).matches ? HOME.zoom - 1 : Math.min(HOME.zoom, Math.log2(0.62 * width)) // phones: one level out from desktop
});
const EASE = { duration: 1500, easing: "in-out-cubic" };
const SERVICES = "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services";
const TRASH_MUNI_FIELD = "N03_004"; // field on the trash layer holding the Japanese municipality name
const MOBILE_QUERY = "(max-width: 768px)";
const FORM_LINKS = {
    survey: "https://arcg.is/1GfHCr5",
    report: "https://arcg.is/1bj49i2",
    bug: "https://arcg.is/uaqLC0"
};

const store = {
    get(key, fallback) { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* storage unavailable */ } }
};

export let currentLang = store.get("fh-lang", "EN") === "JA" ? "JA" : "EN"; // "EN" | "JA"
export let currentSeason = "summer";                                          // "summer" | "winter"

let esri = {};                 // SDK constructors, filled in by initMap
let map = null;
let view = null;
let toggleBtn = null;
let panelEl = null;
let panelOpen = false;
let townGfx = null;            // outline of the selected / filtered municipality
let nearestGfx = null;         // graphics layer holding the "you are here" and numbered result markers
let pickingOrigin = false;     // true while waiting for the user to tap the map
let toastEl = null;
let medicalMultiOnly = false; // "multilingual clinics only" toggle under the medical layer
let muniFilter = "ALL";        // value of the municipality filter dropdown
let trashTown = "ALL";         // value of the trash lookup dropdown
let spatialFilter = null;      // { geometry, spatialRelationship } | null
let filterToken = 0;           // guards against out-of-order async filter changes
let basemapKey = "";
const layers = {};             // key -> layer
const townGeometryCache = new Map();
const listeners = new Set();

/** Subscribe to language/season changes (used by main.js to refresh the header). */
export function onChange(fn) { listeners.add(fn); }
const emit = () => listeners.forEach((fn) => fn({ lang: currentLang, season: currentSeason }));

/* ==========================================================================
   ARCADE + POPUP HELPERS
   ========================================================================== */

const tr = (L, en, ja) => (L === "JA" ? ja : en);
const q = (s) => `'${String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`; // Arcade string literal
const X = (name) => `{expression/${name}}`;

// Helpers prepended to every expression. All field access goes through g(), so a
// missing/renamed field yields a dash instead of a broken popup.
const PRE = [
    "function g(feat, f) { if (HasKey(feat, f)) { return feat[f]; } return null; }",
    "function nz(v, d) { if (IsEmpty(v)) { return d; } var s = Trim(Text(v)); if (s == '' || Lower(s) == 'null') { return d; } return s; }",
    "function num(v) { if (IsEmpty(v)) { return null; } var n = Number(v); if (IsNan(n)) { return null; } return n; }",
    "function on(v) { if (IsEmpty(v)) { return false; } var s = Lower(Text(v)); return s == '1' || s == 'true' || s == 'yes'; }",
    "function esc(s) { return s; }" // popup expression results are shown as text, so no HTML escaping is needed
].join("\n") + "\n";

const E = (name, body) => ({ name, expression: PRE + body });
const G = (field) => `g($feature, '${field}')`;
const NZ = (field, dflt = "—") => `nz(${G(field)}, '${dflt}')`;

// Arcade: translate `var <v>` through a list of [japanese, english] pairs
// Reception hours arrive as Japanese free text ("月-金:8:45-11:30,13:00-14:30; 土:8:45-11:30", "24時間、365日").
// English mode converts the common patterns; anything unusual stays as written.
function translateHours(raw) {
    const W = { 月: "Mon", 火: "Tue", 水: "Wed", 木: "Thu", 金: "Fri", 土: "Sat", 日: "Sun" };
    const ord = (list) => list.split(",").map((n) => n + ({ 1: "st", 2: "nd", 3: "rd" }[n] || "th")).join("/");
    const days = "[月火水木金土日]";
    return raw
        .replace(/24時間/g, "24 hours").replace(/365日/g, "365 days")
        .replace(new RegExp(`第([\\d,]+)(${days})曜日の前の(${days})曜日`, "g"), (m, n, a, b) => `the ${W[b]} before the ${ord(n)} ${W[a]}`)
        .replace(new RegExp(`第([\\d,]+)(${days})曜日`, "g"), (m, n, a) => `${ord(n)} ${W[a]}`)
        .replace(new RegExp(`(${days})曜日の午後`, "g"), (m, a) => `${W[a]} afternoons`)
        .replace(new RegExp(`(${days})曜日の午前`, "g"), (m, a) => `${W[a]} mornings`)
        .replace(/（([^）]*)を除く）/g, "(except $1)")
        .replace(new RegExp(`(${days})-(${days})`, "g"), "$1–$2")
        .replace(new RegExp(days, "g"), (d) => W[d])
        .replace(/曜日/g, "").replace(/祝日?/g, "public holidays").replace(/休診/g, "closed")
        .replace(/[：]/g, ":").replace(/[、，]/g, ", ").replace(/\u3000+/g, "; ").replace(/[（]/g, " (").replace(/[）]/g, ")")
        .replace(/([a-z]):(?=\d)/g, "$1: ").replace(/,(?=\d)/g, ", ").replace(/(\d)\(/g, "$1 (")
        .replace(/\s+/g, " ").replace(/\s+([;,])/g, "$1").trim();
}

const decodePairs = (v, pairs, fallback = v) =>
    `Decode(${v}, ${pairs.map(([a, b]) => `${q(a)}, ${q(b)}`).join(", ")}, ${fallback})`;
const MUNI_PAIRS = municipalities.map((m) => [m.ja, m.en]);
const MUNI_EN = decodePairs("m", MUNI_PAIRS);
const DISTRICT_EN = decodePairs("d", Object.entries(districts));
const muniNameBody = (L, field) =>
    L === "JA" ? `return ${NZ(field)};` : `var m = ${NZ(field, "")}; if (m == '') { return '—'; } return ${MUNI_EN};`;

// Arcade: map a code field through [code, label] pairs
const byCode = (field, pairs, dflt) =>
    `var c = ${NZ(field, "")}; return ${decodePairs("c", pairs, q(dflt))};`;

// Arcade: pick text by subprefecture (N03_002)
const subBy = (pick, other) =>
    `var s = ${NZ("N03_002", "")}; ` +
    Object.values(subprefectures).map((x) => `if (Find('${x.match}', s) > -1) { return ${q(pick(x))}; }`).join(" ") +
    ` return ${other};`;

// Arcade: Yes/No from one or more flag fields
const yesNo = (L, ...fields) =>
    `if (${fields.map((f) => `on(${G(f)})`).join(" || ")}) { return ${q(tr(L, "Yes", "あり"))}; } return ${q(tr(L, "No", "なし"))};`;

// Links and optional rows are built with DOM custom content: Arcade expression results are
// displayed as text, so an expression can never produce a clickable link.
const el = (tag, props = {}, ...kids) => { const n = document.createElement(tag); Object.assign(n, props); n.append(...kids); return n; };
const attr = (g, f) => {
    const v = g.attributes?.[f];
    if (v === null || v === undefined) return "";
    const s = String(v).trim();
    return s.toLowerCase() === "null" ? "" : s;
};
const safeUrl = (u) => (/^https?:\/\//i.test(u) ? u : "");
const custom = (build) => ({ type: "custom", creator: ({ graphic }) => build(graphic) });
const BLOCK = "font-size:13px;line-height:1.5";
const linkEl = (url, label) => el("a", { href: url, target: "_blank", rel: "noopener noreferrer", textContent: label });
const labeled = (label, node) => el("div", {}, el("b", { textContent: `${label}: ` }), node);

// HTML fragments
const row = (label, value) => `<b>${label}:</b> ${value}<br>`;
const HR = `<hr style="border:none;border-top:1px solid #ddd;margin:8px 0">`;
const note = (html) => `<i style="font-size:11px;color:#666;display:block;margin-top:4px">${html}</i>`;
const body = (html) => [{ type: "text", text: `<div style="font-size:13px;line-height:1.5">${html}</div>` }];
const addrNote = (L) => (L === "EN" ? note("💡 Addresses are available in Japanese only") : "");

// Callout that opens a popup with the single most useful fact.
const TONES = {
    info: ["#eff6ff", "#bfdbfe", "#1e3a8a"], good: ["#ecfdf5", "#a7f3d0", "#065f46"],
    warn: ["#fffbeb", "#fde68a", "#92400e"], plain: ["#f3f4f6", "#e5e7eb", "#111827"]
};
const lead = (html, tone = "info") => {
    const [bg, border, fg] = TONES[tone];
    return `<div style="background:${bg};border:1px solid ${border};color:${fg};padding:8px 10px;border-radius:6px;margin-bottom:10px;font-size:14px;font-weight:600;line-height:1.4">${html}</div>`;
};
const chip = (text, neutral = false) => el("span", { textContent: text, style: `display:inline-block;margin:0 6px 6px 0;padding:3px 9px;border-radius:999px;font-size:12px;font-weight:600;${neutral ? "background:#f3f4f6;border:1px solid #e5e7eb;color:#374151" : "background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46"}` });
const srcNote = (L, year) => note(tr(L,
    `Source: MLIT National Land Numerical Information (${year}). Details may have changed.`,
    `出典：国土数値情報（${year}年）。最新の情報と異なる場合があります。`));
const flagOn = (g, ...fields) => fields.some((f) => /^(1|true|yes)$/i.test(attr(g, f)));

// "Directions" (Google Maps) and "Copy address" buttons for point popups.
const ACTION_STYLE = "display:inline-block;padding:4px 10px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#1d4ed8;font:600 12px system-ui,sans-serif;text-decoration:none;cursor:pointer";
function directionsUrl(g, L) {
    const pt = g.geometry?.type === "point" ? g.geometry : g.geometry?.extent?.center;
    let lat = pt?.latitude, lon = pt?.longitude;
    if (lat == null || lon == null) { const loc = view?.popup?.location; lat = loc?.latitude; lon = loc?.longitude; }
    return lat == null || lon == null ? "" : `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lon.toFixed(6)}&hl=${L === "JA" ? "ja" : "en"}`;
}
const actions = (L, addressField) => custom((g) => {
    const box = el("div", { style: `${BLOCK};margin-top:8px;display:flex;flex-wrap:wrap;gap:8px;align-items:center` });
    const url = directionsUrl(g, L);
    if (url) box.append(el("a", { href: url, target: "_blank", rel: "noopener noreferrer", textContent: `🧭 ${tr(L, "Directions", "経路を表示")}`, style: ACTION_STYLE }));
    const address = addressField ? attr(g, addressField) : "";
    if (address && navigator.clipboard) {
        const btn = el("button", { type: "button", textContent: `📋 ${tr(L, "Copy address (Japanese)", "住所をコピー")}`, style: ACTION_STYLE });
        btn.addEventListener("click", () => navigator.clipboard.writeText(address)
            .then(() => { btn.textContent = `✓ ${tr(L, "Copied", "コピーしました")}`; }).catch(() => {}));
        box.append(btn);
    }
    box.hidden = !box.childNodes.length;
    return box;
});

/* ==========================================================================
   POPUP TEMPLATES — one builder per layer, called as builder(lang, layer)
   ========================================================================== */

const KEEP_FIELD = /^(objectid|fid|globalid|shape|shape__.*|creationdate|creator|editdate|editor)$/i;
const genericPopup = (labelKey) => (L, layer) => ({
    title: t(labelKey, L),
    content: [{ type: "fields" }],
    fieldInfos: layer.fields?.length
        ? layer.fields.filter((f) => !KEEP_FIELD.test(f.name)).map((f) => ({ fieldName: f.name, label: f.alias || f.name }))
        : undefined
});

const POPUPS = {
    oshhiBoundaries: (L) => ({
        title: X("name"),
        content: body(
            row(tr(L, "Subprefecture", "振興局"), X("name")) +
            row(tr(L, "Prefecture", "都道府県"), tr(L, "Hokkaido", "北海道")) +
            row(tr(L, "Regional hub", "振興局所在地"), X("hub")) +
            HR + note(X("desc"))
        ),
        expressionInfos: [
            E("name", subBy((x) => tr(L, x.en, x.ja), "s")),
            E("hub", subBy((x) => tr(L, x.hubEn, x.hubJa), q("—"))),
            E("desc", subBy((x) => tr(L, x.descEN, x.descJA), q("")))
        ]
    }),

    muniBoundaries: (L) => ({
        title: X("name"),
        content: body(
            row(tr(L, "Municipality", "市区町村"), X("name")) +
            row(tr(L, "Subprefecture", "振興局"), X("sub")) +
            row(tr(L, "District / County", "郡"), X("district"))
        ).concat(custom((g) => muniSummary(g, L))),
        expressionInfos: [
            E("name", muniNameBody(L, "N03_004")),
            E("sub", subBy((x) => tr(L, x.en, x.ja), "s")),
            E("district",
                `var d = ${NZ("N03_003", "")}; if (d == '') { return ${q(tr(L, "Independent city", "市部（郡に属さない）"))}; } ` +
                (L === "JA" ? "return d;" : `return ${DISTRICT_EN};`))
        ]
    }),

    trash: (L) => {
        const sfx = L === "JA" ? "_ja" : "";
        // Read a bilingual field; falls back to English if the Japanese text is missing.
        // "Not confirmed" placeholders are treated as empty so they are not repeated in every section.
        const val = (g, base) => { const v = attr(g, base + sfx) || (L === "JA" ? attr(g, base) : ""); return /^(Not confirmed|未確認)/.test(v) ? "" : v; };
        const SECTIONS = [
            ["#b91c1c", "🔥", "Burnable waste", "燃やせるごみ", "burnable_s", "burnable_r"],
            ["#92400e", "🧱", "Non-burnable waste", "燃やせないごみ", "nonburn_s", "nonburn_r"],
            ["#047857", "♻️", "Plastics", "プラスチック", "plastic_sc", "plastic_ru"],
            ["#1d4ed8", "🍾", "Recyclables", "資源物", "recyclab_1", "recyclable"],
            ["#6b21a8", "🛋️", "Bulky waste", "粗大ごみ", null, "bulky_wast"]
        ];
        const STATUS = {
            "Verified": ["good", "✅", "Checked against the town's official pages", "自治体の公式ページで確認済み"],
            "Partly verified": ["info", "🟡", "Partly checked. Some details are missing, so confirm with your town", "一部のみ確認済み。不明な点は自治体にご確認ください"],
            "Needs confirmation": ["warn", "⚠️", "Not yet verified. Please confirm with your town before relying on this", "未確認の情報です。自治体にご確認の上ご利用ください"]
        };
        return {
            title: `🗑️ ${X("muni")} ${tr(L, "Garbage & Recycling Guide", "ごみ・リサイクル分別ガイド")}`,
            content: [custom((g) => {
                const box = el("div", { style: BLOCK });
                const status = STATUS[attr(g, "status")];
                const putOut = val(g, "putout");
                const disc = val(g, "disclaimer") || tr(L, "Collection rules vary by area. Check your town's official calendar.", "収集ルールは地域により異なります。自治体の公式カレンダーをご確認ください。");
                // 1. Answer first: when to put garbage out, then the warning
                if (putOut) box.insertAdjacentHTML("beforeend", lead(`🕗 ${tr(L, "Put out", "出す時間")}: ${putOut}`, "info"));
                box.insertAdjacentHTML("beforeend", lead(disc, "warn"));
                const note_ = val(g, "note");
                // 2. Official link
                const url = safeUrl(attr(g, "trash_url"));
                if (url) {
                    const l = el("div", { style: "background:#eff6ff;border:1px solid #bfdbfe;padding:8px 10px;border-radius:6px;margin-bottom:10px;text-align:center" });
                    const union = /eiseicenter\.or\.jp/i.test(url); // Setana and Imakane: the union's site holds the district calendars
                    l.append("🔗 ", linkEl(url, union ? tr(L, "Official collection calendars by district ↗", "地区別ごみ収集カレンダー（公式） ↗") : tr(L, "Official town page ↗", "自治体の公式ページ ↗")));
                    box.append(l);
                }
                // 3. One block per waste type (skipped when the layer has no data for it)
                let shown = 0;
                SECTIONS.forEach(([color, icon, en, ja, daysF, rulesF]) => {
                    const days = daysF ? val(g, daysF) : "";
                    const rules = val(g, rulesF);
                    if (!days && !rules) return;
                    const sec = el("div", { style: "margin-bottom:8px" });
                    sec.append(el("b", { textContent: `${icon} ${tr(L, en, ja)}`, style: `color:${color}` }));
                    if (days) { sec.append(el("br"), el("b", { textContent: `🗓️ ${tr(L, "Days", "収集日")}: ` }), days); }
                    if (rules) { sec.append(el("br"), el("span", { textContent: `ℹ️ ${rules}`, style: "color:#4b5563" })); }
                    box.append(sec); shown++;
                });
                if (!shown) box.insertAdjacentHTML("beforeend", lead(tr(L, "No sorting rules could be confirmed yet. Please use the official page or call the town.", "分別ルールを確認できていません。公式ページまたは自治体にご確認ください。"), "plain"));
                if (note_) box.insertAdjacentHTML("beforeend", lead(`📌 ${note_}`, "plain"));
                // 4. Verification stamp
                if (status) {
                    // "checked" may be text ("2026-11-10") or a date field (epoch milliseconds)
                    let checked = attr(g, "checked");
                    if (/^\d{10,}$/.test(checked)) checked = new Date(Number(checked)).toISOString().slice(0, 10);
                    box.insertAdjacentHTML("beforeend", lead(`${status[1]} ${tr(L, status[2], status[3])}${checked ? ` (${checked})` : ""}`, status[0]));
                }
                box.append(el("i", { textContent: tr(L, "Rules change. Always check the town's current calendar.", "ルールは変更されることがあります。最新のカレンダーをご確認ください。"), style: "font-size:11px;color:#666;display:block" }));
                return box;
            })],
            expressionInfos: [
                E("muni", L === "JA"
                    ? `return ${NZ(TRASH_MUNI_FIELD)};`
                    : `var m = ${NZ(TRASH_MUNI_FIELD, "")}; if (m == '') { m = ${NZ("municipali", "—")}; } else { m = ${MUNI_EN}; } return m;`)
            ]
        };
    },

    municipal: (L) => ({
        title: `🏛️ ${X("name")}`,
        content: [...body(
            lead((L === "EN" ? "Japanese name: " : "") + X("fname"), "info") +
            `<b>${tr(L, "What you can do here", "主な利用目的")}:</b><p style="margin:4px 0 8px">${X("desc")}</p>` +
            row(tr(L, "Address", "所在地"), X("addr")) + addrNote(L) + srcNote(L, 2022)
        ), actions(L, "P05_004")],
        expressionInfos: [
            E("fname", `return ${NZ("P05_003")};`),
            E("name", byCode("P05_002", [
                ["1", tr(L, "Town / City Hall (Yakuba / Shiyakusho)", "役場・市役所")],
                ["2", tr(L, "Branch & Liaison Office (Shisho / Shucchojo)", "支所・出張所")],
                ["4", tr(L, "Public Community Center (Kominkan)", "公立公民館")]
            ], tr(L, "Municipal Facility", "行政施設"))),
            E("desc", byCode("P05_002", [
                ["1", tr(L,
                    "Main municipal headquarters. Handles residence registration (Juminhyo), My Number card setup, National Health Insurance, local taxes and official certificates.",
                    "住民登録、マイナンバー、国民健康保険、税金手続き、各種証明書の発行を行う本庁舎です。")],
                ["2", tr(L,
                    "Local branch office. Convenient for routine certificates and minor paperwork closer to your neighborhood.",
                    "証明書の交付や地域の行政手続きを行う身近な支所・出張所です。")],
                ["4", tr(L,
                    "Public community facility (Kominkan) used for local Japanese classes, cultural clubs, town meetings and events.",
                    "地域の集会、講座、サークル活動などに利用される公立公民館です。")]
            ], tr(L, "General municipal service location.", "地域の公共施設です。"))),
            E("addr", `return ${NZ("P05_004")};`)
        ]
    }),

    police: (L) => {
        // Classify once, then translate. Name keywords take priority over the code.
        const kind =
            `var raw = ${NZ("P18_001", "")}; var c = ${NZ("P18_003", "")}; var k = 'other'; ` +
            `if (Find('交番', raw) > -1 || c == '4') { k = 'koban'; } ` +
            `else if (Find('駐在所', raw) > -1 || c == '5') { k = 'chuzai'; } ` +
            `else if (c == '6' || Find('派出所', raw) > -1) { k = 'hashutsujo'; } ` +
            `else if (c == '1') { k = 'hq'; } else if (c == '3') { k = 'branch'; } else if (c == '7') { k = 'school'; } else if (c == '8') { k = 'center'; } ` +
            `else if (Find('警察署', raw) > -1 || c == '2') { k = 'station'; } `;
        const pick = (pairs, dflt) => `${kind} return ${decodePairs("k", pairs, q(dflt))};`;
        return {
            title: `👮 ${X("title")}`,
            content: [...body(
                lead((L === "EN" ? "Japanese name: " : "") + X("name"), "info") +
                `<b>${tr(L, "What you can do here", "主な利用目的")}:</b><p style="margin:4px 0 8px">${X("desc")}</p>` +
                row(tr(L, "Address", "所在地"), X("addr")) + addrNote(L) + srcNote(L, 2012)
            ), actions(L, "P18_004")],
            expressionInfos: [
                E("title", pick([
                    ["hq", tr(L, "Prefectural Police Headquarters", "北海道警察本部")],
                    ["station", tr(L, "Police Station", "警察署")],
                    ["branch", tr(L, "Police Sub-station", "分庁舎")],
                    ["koban", tr(L, "Police Box (Koban)", "交番")],
                    ["chuzai", tr(L, "Residential Police Box (Chuzaisho)", "駐在所")],
                    ["hashutsujo", tr(L, "Police Box (Hashutsujo)", "派出所")],
                    ["school", tr(L, "Police Academy", "警察学校")],
                    ["center", tr(L, "Community Safety Center / Liaison Office", "地域安全センター・連絡所")]
                ], tr(L, "Police Facility", "警察施設"))),
                E("desc", pick([
                    ["koban", tr(L,
                        "Urban police box (Koban). Report lost or found items, ask for directions, or get immediate local emergency help.",
                        "街頭の警察拠点（交番）です。道案内、落とし物の届出、緊急時の初期対応を行います。")],
                    ["chuzai", tr(L,
                        "Rural police box (Chuzaisho) where a resident officer lives and patrols. Go here for lost and found, community safety concerns or neighborhood emergencies.",
                        "地域密着型の駐在所です。防犯巡回、道案内、落とし物の届出、緊急時の初期対応を行います。")],
                    ["hashutsujo", tr(L,
                        "Neighborhood police box. Ask for directions, report lost or found items, or get immediate local help.",
                        "地域の派出所です。道案内、落とし物の届出、緊急時の初期対応を行います。")],
                    ["center", tr(L,
                        "Community safety center or liaison office for crime prevention and local consultations.",
                        "地域の防犯相談や連絡窓口となる施設です。")],
                    ["branch", tr(L,
                        "Regional police branch providing administrative services and local emergency response.",
                        "地域警察の分庁舎です。行政手続きや地域の安全窓口として機能しています。")],
                    ["station", tr(L,
                        "Full-service police station. Visit for crime reports, formal lost-property reports, driver's license matters and official certificates.",
                        "警察の総合庁舎です。事件・事故の届出、落とし物の届出、運転免許手続きなどの窓口業務を行っています。")],
                    ["hq", tr(L,
                        "Prefectural police headquarters.",
                        "北海道警察の本部です。")]
                ], tr(L,
                    "Police facility for local safety, lost items and emergency assistance.",
                    "地域の安全・防犯・緊急対応を行う警察施設です。"))),
                E("name", `return esc(${NZ("P18_001")});`),
                E("addr", `return ${NZ("P18_004")};`)
            ]
        };
    },

    post: (L) => ({
        title: `✉️ ${X("name")}`,
        content: [...body(lead(X("type"), "plain") + (L === "EN" ? row("Japanese name", X("jname")) : "") + row(tr(L, "Address", "所在地"), X("addr")) + addrNote(L) + srcNote(L, 2013)), actions(L, "P30_006")],
        expressionInfos: [
            E("name", L === "EN" ? `return ${q("Post Office")};` : `return ${NZ("P30_005", "郵便局")};`),
            E("jname", `return ${NZ("P30_005", "郵便局")};`),
            E("type", byCode("P30_004", [
                ["18004", tr(L, "Simple Post Office (簡易郵便局)", "簡易郵便局")],
                ["18006", tr(L, "Direct-managed Post Office (直営郵便局)", "直営郵便局")]
            ], tr(L, "Post Office", "郵便局"))),
            E("addr", `return ${NZ("P30_006")};`)
        ]
    }),

    schools: (L) => ({
        title: `🏫 ${X("name")}`,
        content: [
            custom((g) => {
                const box = el("div");
                if (attr(g, "P29_007") === "9") box.innerHTML = lead(tr(L, "⚠️ Listed as temporarily closed", "⚠️ 休校中"), "warn");
                else box.hidden = true;
                return box;
            }),
            ...body(lead(X("type"), "plain") + (L === "EN" ? row("Japanese name", X("jname")) : "")),
            custom((g) => {
                const remark = attr(g, "P29_009");
                const box = el("div", { style: BLOCK });
                if (remark) box.append(labeled(tr(L, "Campus / note", "校舎・備考"), document.createTextNode(remark)));
                else box.hidden = true;
                return box;
            }),
            ...body(row(tr(L, "Address", "所在地"), X("addr")) + addrNote(L) + srcNote(L, 2023)),
            actions(L, "P29_005")
        ],
        expressionInfos: [
            E("name", L === "JA" ? `return ${NZ("P29_004")};` : `var e = ${NZ("name_en", "")}; if (e == '') { return ${NZ("P29_004")}; } return e;`),
            E("type", byCode("P29_003", [
                ["16001", tr(L, "Elementary School (小学校)", "小学校")],
                ["16002", tr(L, "Junior High School (中学校)", "中学校")],
                ["16003", tr(L, "Secondary School (中等教育学校)", "中等教育学校")],
                ["16004", tr(L, "High School (高等学校)", "高等学校")],
                ["16005", tr(L, "College of Technology (高専)", "高等専門学校")],
                ["16006", tr(L, "Junior College (短期大学)", "短期大学")],
                ["16007", tr(L, "University (大学)", "大学")],
                ["16011", tr(L, "Kindergarten (幼稚園)", "幼稚園")],
                ["16012", tr(L, "Special Needs School (特別支援学校)", "特別支援学校")],
                ["16013", tr(L, "Integrated Nursery & Kindergarten (認定こども園)", "幼保連携型認定こども園")],
                ["16014", tr(L, "Compulsory Education School (義務教育学校)", "義務教育学校")],
                ["16015", tr(L, "Miscellaneous School (各種学校)", "各種学校")],
                ["16016", tr(L, "Vocational School (専修学校)", "専修学校")]
            ], tr(L, "Educational Facility", "教育施設"))),
            E("jname", `return ${NZ("P29_004")};`),
            E("addr", `return ${NZ("P29_005")};`)
        ]
    }),

    roadside: (L) => {
        // P35_0xx flags: 1 = available, 2 = not available.
        const AMENITIES = [
            ["🏪", "Shops", "売店", ["P35_028"]], ["🍱", "Restaurant", "レストラン", ["P35_013"]], ["☕", "Café / light meals", "軽食・喫茶", ["P35_014"]],
            ["♨️", "Hot spring", "温泉", ["P35_016"]], ["🛏️", "Accommodation", "宿泊施設", ["P35_015"]], ["⛺", "Camping", "キャンプ場", ["P35_017"]],
            ["🚿", "Shower", "シャワー", ["P35_024"]], ["🛜", "Public Wi-Fi", "公衆Wi-Fi", ["P35_023"]], ["⚡", "EV charging", "EV充電", ["P35_022"]],
            ["⛽", "Gas station", "ガソリンスタンド", ["P35_021"]], ["🏧", "ATM", "ATM", ["P35_011"]], ["♿", "Accessible toilet", "身障者トイレ", ["P35_027"]],
            ["🍼", "Baby bed", "ベビーベッド", ["P35_012"]], ["🌳", "Park", "公園", ["P35_018"]], ["🌄", "Observation deck", "展望台", ["P35_019"]],
            ["🖼️", "Museum", "博物館・美術館", ["P35_020"]], ["🎨", "Experience activities", "体験施設", ["P35_025"]], ["🧭", "Tourist guide", "観光案内", ["P35_026"]]
        ];
        return {
            title: `🚗 ${tr(L, "Michi-no-Eki", "道の駅")}: ${X("name")}`,
            content: [
                custom((g) => {
                    const box = el("div", { style: `${BLOCK};margin-bottom:6px` });
                    box.append(el("div", { style: "font-weight:600;margin-bottom:4px", textContent: tr(L, "Available here", "ご利用いただける設備") }));
                    const have = AMENITIES.filter((a) => flagOn(g, ...a[3]));
                    if (have.length) have.forEach((a) => box.append(chip(`${a[0]} ${tr(L, a[1], a[2])}`)));
                    else box.append(el("div", { style: "color:#6b7280", textContent: tr(L, "No amenities recorded", "設備情報なし") }));
                    return box;
                }),
                ...body((L === "EN" ? row("Japanese name", X("jname")) : "") + row(tr(L, "Municipality", "市町村"), X("muni")) + srcNote(L, 2018)),
                custom((g) => {
                    const url = ["P35_007", "P35_008", "P35_009", "P35_010"].map((f) => safeUrl(attr(g, f))).find(Boolean);
                    const box = el("div", { style: BLOCK });
                    if (url) box.append(labeled(tr(L, "Website", "公式サイト"), linkEl(url, tr(L, "Visit official page", "公式ページを開く"))));
                    else box.hidden = true;
                    return box;
                }),
                actions(L)
            ],
            expressionInfos: [
                E("name", L === "JA" ? `return ${NZ("P35_006")};` : `var e = ${NZ("name_en", "")}; if (e == '') { return ${NZ("P35_006")}; } return e;`),
                E("jname", `return ${NZ("P35_006")};`),
                E("muni", L === "JA" ? `return ${NZ("P35_004")};`
                    : `var m = ${NZ("P35_004", "")}; var i = Find('郡', m); if (i > -1) { m = Mid(m, i + 1, Count(m) - i - 1); } if (m == '') { return '—'; } return ${MUNI_EN};`)
            ]
        };
    },

    shelters: (L) => {
        const HAZARDS = [
            ["🏚️", "Earthquake", "地震", "P20_007"], ["🌊", "Tsunami", "津波", "P20_008"],
            ["🌧️", "Flood / storm damage", "風水害", "P20_009"], ["🌋", "Volcanic activity", "火山現象", "P20_010"],
            ["⚠️", "Other disasters", "その他", "P20_011"]
        ];
        return {
            title: `🛡️ ${X("name")}`,
            content: [
                custom((g) => {
                    const box = el("div", { style: `${BLOCK};margin-bottom:6px` });
                    const yes = HAZARDS.filter((h) => flagOn(g, h[3]));
                    const no = HAZARDS.filter((h) => !flagOn(g, h[3]));
                    box.append(el("div", { style: "font-weight:600;margin-bottom:4px", textContent: yes.length ? tr(L, "Designated shelter for", "指定されている災害") : tr(L, "Disaster designation", "災害の指定") }));
                    if (yes.length) yes.forEach((h) => box.append(chip(`${h[0]} ${tr(L, h[1], h[2])}`)));
                    else box.append(el("div", { style: "color:#6b7280", textContent: flagOn(g, "P20_012")
                        ? tr(L, "No specific disaster type designated in the data", "災害種別の指定なし")
                        : tr(L, "Hazard types not specified in the data", "指定災害種別の記載なし") }));
                    if (yes.length && no.length) {
                        box.append(el("div", { style: "font-size:12px;color:#6b7280", textContent:
                            `${tr(L, "Not designated for", "対象外")}: ${no.map((h) => tr(L, h[1], h[2])).join(tr(L, ", ", "、"))}` }));
                    }
                    return box;
                }),
                ...body(
                    (L === "EN" ? row("Japanese name", X("jname")) : "") +
                    row(tr(L, "Facility type", "施設種別"), X("type")) +
                    row(tr(L, "Capacity", "想定収容人数"), X("cap")) +
                    row(tr(L, "Address", "所在地"), X("addr")) + addrNote(L) +
                    note(tr(L, "Designations come from 2012 national data. Confirm with your town's current hazard map (ハザードマップ).",
                        "指定内容は2012年の国のデータに基づきます。最新情報はお住まいの自治体のハザードマップでご確認ください。"))
                ),
                actions(L, "P20_003")
            ],
            expressionInfos: [
                E("name", L === "EN" ? `return ${q("Emergency Shelter")};` : `return ${NZ("P20_002")};`),
                E("jname", `return ${NZ("P20_002")};`),
                E("type", L === "JA" ? `return ${NZ("P20_004")};`
                    : `var j = ${NZ("P20_004", "")}; var e = ${NZ("types_en", "")}; if (e == '') { return j; } if (j == '') { return e; } return e + ' (' + Trim(Replace(j, '\u3000', '')) + ')';`),
                E("addr", `return ${NZ("P20_003")};`),
                E("cap", `var c = num(${G("P20_005")}); if (IsEmpty(c) || c <= 0) { return ${q(tr(L, "Unspecified", "未定・記載なし"))}; } return Text(c, '#,###') + ${q(tr(L, " persons", " 人"))};`)
            ]
        };
    },

    snow: (L) => {
        const stat = (name, field, unit) => E(name,
            `var n = num(${G(field)}); if (IsEmpty(n) || n == 99999999) { return ${q(tr(L, "No historical statistics available", "過去の統計データなし"))}; } return Text(Round(n, 1)) + ' ${unit}';`);
        const cls = `var n = num(${G("A22_100005")}); var c = ''; if (!IsEmpty(n)) { c = Text(n); } `;
        return {
            title: X("muni"),
            content: body(
                row(tr(L, "Municipality", "自治体名"), X("muni")) +
                lead(X("cls"), "info") +
                note(X("clsDesc")) + HR +
                `<b>${tr(L, "Climate averages", "気候平均値")}:</b>` +
                `<ul style="margin:4px 0 0 18px;padding:0"><li>${tr(L, "Avg. minimum temperature", "平均最低気温")}: ${X("temp")}</li>` +
                `<li>${tr(L, "Avg. total snowfall", "平均年間降雪量")}: ${X("snow")}</li>` +
                `<li>${tr(L, "Avg. maximum snow depth", "平均最大積雪深")}: ${X("depth")}</li></ul>` +
                srcNote(L, 2014)
            ),
            expressionInfos: [
                E("muni", muniNameBody(L, "A22_100004")),
                E("cls", `${cls} return ${decodePairs("c", [
                    ["1", tr(L, "Special Heavy Snow Zone (Class 1)", "特別豪雪地帯")],
                    ["2", tr(L, "Heavy Snow Zone (Class 2)", "豪雪地帯")],
                    ["9", tr(L, "Other designated snow area (Class 9)", "その他の指定地域（区分9）")]
                ], q(tr(L, "Not designated", "指定なし")))};`),
                E("clsDesc", `${cls} return ${decodePairs("c", [
                    ["1", tr(L, "Designated under Japan's heavy-snowfall area law as a special zone with the most severe winters.", "豪雪地帯対策特別措置法に基づく、特に積雪の厳しい地域です。")],
                    ["2", tr(L, "Designated under Japan's heavy-snowfall area law.", "豪雪地帯対策特別措置法に基づく豪雪地帯です。")]
                ], q(""))};`),
                stat("temp", "AvgMinTemp", "°C"), stat("snow", "AvgTotSnow", "cm"), stat("depth", "AvgMaxDept", "cm")
            ]
        };
    },

    railStations: (L) => ({
        title: `🚉 ${X("stn")}`,
        content: [...body(
            lead(X("service"), "plain") +
            (L === "EN" ? row("Japanese name", "{N02_005}駅") : "") +
            row(tr(L, "Line", "路線名"), X("line")) +
            row(tr(L, "Operator", "運行会社"), X("operator")) +
            srcNote(L, 2025)
        ), actions(L)],
        expressionInfos: [
            E("line", L === "JA" ? `return ${NZ("N02_003")};` : `var l = ${NZ("N02_003", "")}; return ${decodePairs("l", LINE_PAIRS)};`),
            E("operator", L === "JA" ? `return ${NZ("N02_004")};` : `var o = ${NZ("N02_004", "")}; return ${decodePairs("o", OPERATOR_PAIRS)};`),
            E("service",
                `var l = ${NZ("N02_003", "")}; var o = ${NZ("N02_004", "")}; ` +
                `if (l == '北海道新幹線') { return ${q(tr(L, "🚅 High-speed Shinkansen", "🚅 新幹線"))}; } ` +
                `if (o == '函館市企業局交通部' || o == '函館市') { return ${q(tr(L, "🚃 City tram", "🚃 市電"))}; } ` +
                `return ${q(tr(L, "🚆 Local / regional train", "🚆 在来線・ローカル線"))};`),
            E("stn", L === "JA"
                ? `return ${NZ("N02_005")} + '駅';`
                : `var e = ${NZ("station_en", "")}; if (e == '') { e = ${NZ("N02_005")}; } return e + ' Station';`)
        ]
    }),

    railLines: (L) => ({
        title: `🚆 ${X("line")}`,
        content: body(row(tr(L, "Line", "路線名"), X("line")) + row(tr(L, "Operator", "運行会社"), X("operator")) + srcNote(L, 2025)),
        expressionInfos: [
            E("line", L === "JA" ? `return ${NZ("N02_003")};` : `var l = ${NZ("N02_003", "")}; if (l == '') { return '—'; } return ${decodePairs("l", LINE_PAIRS)};`),
            E("operator", L === "JA" ? `return ${NZ("N02_004")};` : `var o = ${NZ("N02_004", "")}; if (o == '') { return '—'; } return ${decodePairs("o", OPERATOR_PAIRS)};`)
        ]
    }),

    medical: (L) => {
        // The source data mixes full names (内科), official abbreviations (内, 外, 整外, 耳い) and ";" separators,
        // so each department is looked up on its own. Anything not listed stays in Japanese.
        const DEPTS = {
            "内": "Internal Medicine", "内科": "Internal Medicine", "外": "Surgery", "外科": "Surgery", "小": "Pediatrics", "小児科": "Pediatrics",
            "小外": "Pediatric Surgery", "小児外科": "Pediatric Surgery", "整外": "Orthopedic Surgery", "整形外科": "Orthopedic Surgery",
            "脳外": "Neurosurgery", "脳神経外科": "Neurosurgery", "心外": "Cardiac Surgery", "心臓血管外科": "Cardiovascular Surgery",
            "呼外": "Respiratory Surgery", "呼吸器外科": "Respiratory Surgery", "形外": "Plastic Surgery", "形成外科": "Plastic Surgery",
            "皮": "Dermatology", "皮膚科": "Dermatology", "小児皮膚科": "Pediatric Dermatology", "ひ": "Urology", "泌尿器科": "Urology",
            "産婦": "Obstetrics & Gynecology", "産婦人科": "Obstetrics & Gynecology", "産科": "Obstetrics", "婦人科": "Gynecology",
            "眼": "Ophthalmology", "眼科": "Ophthalmology", "耳い": "ENT (Otolaryngology)", "耳鼻咽喉科": "ENT (Otolaryngology)",
            "リハ": "Rehabilitation", "リハビリテーション科": "Rehabilitation", "放": "Radiology", "放射線科": "Radiology",
            "放射線治療科": "Radiation Oncology", "放射線診断科": "Diagnostic Radiology", "病理": "Pathology", "病理診断科": "Pathology",
            "麻": "Anesthesiology", "麻酔科": "Anesthesiology", "精": "Psychiatry", "精神科": "Psychiatry", "児童精神科": "Child Psychiatry",
            "老年精神科": "Geriatric Psychiatry", "神": "Neurology", "神内": "Neurology", "神経内科": "Neurology", "心療内科": "Psychosomatic Medicine",
            "呼": "Respiratory Medicine", "呼内": "Respiratory Medicine", "呼吸器内科": "Respiratory Medicine",
            "循": "Cardiology", "循環器内科": "Cardiology", "消": "Gastroenterology", "胃": "Gastroenterology", "消化器内科": "Gastroenterology",
            "消化器外科": "Gastroenterological Surgery", "内視鏡内科": "Endoscopy", "大腸外科": "Colorectal Surgery",
            "肛門内科": "Proctology", "肛門外科": "Anorectal Surgery", "乳腺外科": "Breast Surgery", "腫瘍外科": "Surgical Oncology",
            "腎臓内科": "Nephrology", "血液内科": "Hematology", "血液腫瘍内科": "Hematology & Oncology", "腫瘍内科": "Medical Oncology",
            "緩和ケア内科": "Palliative Care", "糖尿病内科": "Diabetes Medicine", "糖尿病・内分泌内科": "Diabetes & Endocrinology",
            "救急科": "Emergency Medicine", "歯科": "Dentistry", "歯外": "Oral Surgery", "口腔外科": "Oral Surgery", "歯科口腔外科": "Oral Surgery",
            "小児歯科": "Pediatric Dentistry", "矯正歯科": "Orthodontics",
            "歯": "Dentistry", "小歯": "Pediatric Dentistry", "矯歯": "Orthodontics", "リウ": "Rheumatology", "アレ": "Allergy",
            "心内": "Psychosomatic Medicine", "婦": "Gynecology", "産": "Obstetrics", "こう": "Proctology", "脳内": "Neurology",
            "糖尿病・代謝内科": "Diabetes & Metabolism", "内分泌内科": "Endocrinology", "内分泌・代謝内科": "Endocrinology & Metabolism",
            "人工透析内科": "Dialysis", "透析": "Dialysis", "泌尿器科（人工透析）": "Urology (Dialysis)", "漢方内科": "Kampo (Herbal) Medicine", "漢方外科": "Kampo (Herbal) Medicine",
            "ペインクリニック内科": "Pain Clinic", "美容皮膚科": "Cosmetic Dermatology", "美容皮ふ科": "Cosmetic Dermatology", "美外": "Cosmetic Surgery",
            "老年内科": "Geriatrics", "老年科": "Geriatrics", "胸外": "Thoracic Surgery", "呼吸器・乳腺外科": "Respiratory & Breast Surgery",
            "総合診療内科": "General Medicine", "総合診療科": "General Medicine", "神経精神科": "Neuropsychiatry", "理学療法科": "Physical Therapy",
            "児童思春期精神科": "Child & Adolescent Psychiatry", "その他": "Other departments", "消化器内科（内視鏡）": "Gastroenterology (Endoscopy)"
        };
        // Language codes used by the prefecture's foreign-language support list
        const LANGS = { EN: ["English", "英語"], ZH: ["Chinese", "中国語"], KO: ["Korean", "韓国語"], RU: ["Russian", "ロシア語"], FR: ["French", "フランス語"], DE: ["German", "ドイツ語"], ES: ["Spanish", "スペイン語"], TH: ["Thai", "タイ語"], VI: ["Vietnamese", "ベトナム語"], TL: ["Tagalog", "タガログ語"] };
        const langName = (c) => (LANGS[c] ? tr(L, ...LANGS[c]) : c);
        const deptName = (d) => (L === "JA" ? d : DEPTS[d] || d);
        const deptDict = `{${Object.entries(DEPTS).map(([a, b]) => `${q(a)}: ${q(b)}`).join(", ")}}`;
        const deptBody =
            `var s = ${NZ("診療科目", "")}; if (s == '' && ${NZ("facility_type", "")} == 'Pharmacy') { return ${q(tr(L, "Prescription dispensing", "調剤"))}; } if (s == '') { return ${q(tr(L, "Unspecified", "記載なし"))}; } ` +
            (L === "JA"
                ? "return Replace(s, ';', '、');"
                : `var D = ${deptDict}; var parts = Split(s, ';'); var out = []; ` +
                  "for (var i in parts) { var t = Trim(parts[i]); if (t == '') { continue; } var v = t; if (HasKey(D, t)) { v = D[t]; } if (!Includes(out, v)) { Push(out, v); } } " +
                  "return Concatenate(out, ', ');");
        return {
            title: X("title"),
            content: [custom((g) => {
                const T = { Hospital: ["🏥", "Hospital", "病院"], Clinic: ["🩺", "Clinic", "診療所"], Dental: ["🦷", "Dental clinic", "歯科"], Pharmacy: ["💊", "Pharmacy", "薬局"] };
                const t = T[attr(g, "facility_type")];
                return el("div", { style: "font-size:16px;font-weight:700;margin:0 0 6px", textContent: t ? `${t[0]} ${tr(L, t[1], t[2])}` : "" });
            }), custom((g) => {
                const multi = flagOn(g, "multilingual");
                const box = el("div");
                if (!multi) {
                    box.innerHTML = lead(tr(L, "Standard local facility — Japanese is the primary language", "一般地域医療機関（日本語対応が中心）"), "plain");
                    return box;
                }
                // "内科：EN、RU; 歯科：EN" -> groups of departments by language set
                const groups = new Map();
                const all = new Set();
                for (const part of attr(g, "departments_languages").split(/[;；]/)) {
                    const [dept, langs = ""] = part.split(/[：:]/).map((x) => x.trim());
                    const codes = langs.match(/[A-Z]{2}/g) || [];
                    codes.forEach((c) => all.add(c));
                    if (!dept || !codes.length) continue;
                    const key = codes.join(", ");
                    groups.set(key, [...(groups.get(key) || []), deptName(dept)]);
                }
                (attr(g, "other_langs").match(/[A-Z]{2}/g) || []).forEach((c) => all.add(c));
                const names = [...all].sort((a, b) => (a === "EN" ? -1 : b === "EN" ? 1 : 0)).map(langName).join(tr(L, ", ", "、"));
                box.innerHTML = lead(`🌟 ${tr(L, "Foreign-language support", "外国語対応")}${names ? `: <b>${names}</b>` : ""}`, "good");
                const chips = el("div", { style: "margin:2px 0 4px" });
                if (flagOn(g, "interpreter_onsite")) chips.append(chip(tr(L, "On-site interpreter", "医療通訳者あり")));
                if (flagOn(g, "interpreter_remote")) chips.append(chip(tr(L, "Remote interpreting", "遠隔通訳あり")));
                if (chips.childNodes.length) box.append(chips);
                for (const [key, depts] of groups) {
                    box.append(el("div", { style: "font-size:12.5px;margin:2px 0", textContent: `${key.split(", ").map(langName).join(tr(L, ", ", "、"))} — ${depts.join(tr(L, ", ", "、"))}` }));
                }
                box.append(el("div", { style: "font-size:11px;color:#666;margin-top:4px", textContent: tr(L, "Language availability can vary by time and staff. Call ahead if you can.", "対応可能な言語は時間帯やスタッフにより異なります。事前にご確認ください。") }));
                return box;
            }), custom((g) => {
                const box = el("div", { style: BLOCK });
                const phone = attr(g, "電話番号");
                if (phone) box.append(labeled(tr(L, "Phone", "電話番号"), el("a", { href: `tel:${phone.replace(/[^\d+]/g, "")}`, textContent: phone })));
                const hours = attr(g, "reception_hours");
                if (hours) box.append(labeled(tr(L, "Reception hours", "受付時間"), document.createTextNode(L === "EN" ? translateHours(hours) : hours)));
                const url = safeUrl(attr(g, "website"));
                if (url) box.append(labeled(tr(L, "Website", "公式サイト"), linkEl(url, tr(L, "Official website", "公式サイト"))));
                // Service badges: only shown when the list marks them
                const badges = el("div", { style: "margin-top:6px" });
                if (flagOn(g, "open_24h")) badges.append(chip(tr(L, "Open 24 h / 365 days", "24時間365日対応")));
                if (flagOn(g, "accepts_cards")) badges.append(chip(tr(L, "Credit cards accepted", "クレジットカード可")));
                const ER = { "初期救急医療機関": ["Primary emergency care (first aid)", "初期救急医療機関"], "第二次救急医療機関": ["Secondary emergency hospital", "第二次救急医療機関"], "第三次救急医療機関": ["Tertiary emergency center", "第三次救急医療機関"] };
                const er = attr(g, "emergency_level");
                if (er) badges.append(chip(ER[er] ? tr(L, ...ER[er]) : er));
                if (badges.childNodes.length) box.append(badges);
                box.hidden = !box.childNodes.length;
                return box;
            }), ...body(
                HR +
                row(tr(L, "Address", "所在地"), X("addr")) +
                (L === "EN" ? row("Japanese name", X("jaName")) : "") +
                row(X("deptLabel"), X("depts"))
            ), custom(() => el("div", { style: "font-size:11px;color:#666;margin-top:8px", textContent: tr(L, "Sources: Hokkaido Government open data \"道内医療機関一覧（位置情報付き）\" (CC BY, as of Feb 2026) and the Hokkaido list of facilities with foreign-language support. May include closed or moved facilities: confirm with the facility.", "出典：北海道「道内医療機関一覧（位置情報付き）」（CC BY・2026年2月時点）、北海道「外国語対応可能医療機関一覧」。閉院・移転の可能性があるため、各医療機関にご確認ください。") })),
actions(L, "所在地")],
            expressionInfos: [
                E("title", L === "JA"
                    ? `return nz(${G("名称")}, ${NZ("name_en")});`
                    : `var a = ${NZ("name_en", "")}; if (a != '') { return a; } return ${NZ("名称")};`),
                E("addr", `var a = ${NZ("所在地")}; var z = ${NZ("郵便番号", "")}; if (z == '') { return a; } return ${L === "JA" ? "'〒' + z + ' ' + a" : "a + ' (' + z + ')'"};`),
                E("jaName", `return ${NZ("名称")};`),
                E("deptLabel", `if (${NZ("facility_type", "")} == 'Pharmacy') { return ${q(tr(L, "Services", "業務"))}; } return ${q(tr(L, "Departments", "診療科目"))};`),
                E("depts", deptBody)
            ]
        };
    },

    bus: (L) => {
        // P11: one row per stop; up to 35 routes in P11_003_01..35 with matching type codes in P11_004_01..35.
        const BUS_TYPES = { "1": ["Private route bus", "路線バス（民間）"], "2": ["Public route bus", "路線バス（公営）"], "3": ["Community bus", "コミュニティバス"], "5": ["Other bus service", "その他のバス"] };
        const OPERATORS = [["函館バス", "Hakodate Bus"], ["道南バス", "Donan Bus"], ["ジェイ・アール北海道バス", "JR Hokkaido Bus"], ["函館市企業局交通部", "Hakodate City Transportation Bureau"]];
        const operatorName = (op) => {
            if (L === "JA" || !op) return op;
            // P11 appends the company form, e.g. "函館バス（株）"
            const clean = op.replace(/[（(]株[）)]|株式会社|\s/g, "");
            const known = OPERATORS.find((o) => o[0] === clean);
            if (known) return known[1];
            const muni = municipalities.find((m) => m.ja === clean);
            return muni ? `${muni.en} (community bus)` : op;
        };
        return {
            title: `🚌 ${X("name")}`,
            content: [
                custom((g) => {
                    const box = el("div", { style: BLOCK });
                    const routes = [];
                    for (let i = 1; i <= 35; i++) {
                        const k = String(i).padStart(2, "0");
                        // One cell can hold several routes ("410系統,411系統") with matching type codes ("1,1").
                        const split = (v) => v.split(/[,，、]/).map((x) => x.trim());
                        const names = split(attr(g, `P11_003_${k}`));
                        const types = split(attr(g, `P11_004_${k}`));
                        names.forEach((name, j) => {
                            if (name && !routes.some((r) => r.name === name)) routes.push({ name, type: types[j] || types[0] || "" });
                        });
                    }
                    const headline = routes.length
                        ? tr(L, `${routes.length} bus route${routes.length > 1 ? "s" : ""} stop here`, `${routes.length}系統が停車します`)
                        : tr(L, "No route information for this stop", "このバス停の系統情報はありません");
                    box.append(el("div", { innerHTML: lead(`🚌 ${headline}`, routes.length ? "info" : "plain") }));
                    const shown = routes.slice(0, 12);
                    shown.forEach((r) => box.append(chip(r.name, true)));
                    if (routes.length > shown.length) box.append(chip(`+${routes.length - shown.length}`, true));
                    const op = attr(g, "P11_002");
                    if (op) box.append(labeled(tr(L, "Operator", "運行会社"), document.createTextNode(operatorName(op))));
                    const types = [...new Set(routes.map((r) => r.type).filter((c) => BUS_TYPES[c]))];
                    if (types.length) box.append(labeled(tr(L, "Service type", "種別"), document.createTextNode(types.map((c) => tr(L, ...BUS_TYPES[c])).join(tr(L, ", ", "、")))));
                    const remark = attr(g, "P11_005");
                    if (remark) box.append(labeled(tr(L, "Remarks", "備考"), document.createTextNode(remark)));
                    return box;
                }),
                ...body((L === "EN" ? row("Stop name (Japanese)", X("jname")) : "") + note(tr(L, "Stop and route names are shown in Japanese. Check the operator's timetable for departure times.", "時刻表は各事業者の情報をご確認ください。")) + srcNote(L, 2022)),
                actions(L)
            ],
            expressionInfos: [
                E("name", L === "EN" ? `return ${q("Bus Stop")};` : `return ${NZ("P11_001", "バス停")};`),
                E("jname", `return ${NZ("P11_001", "—")};`)
            ]
        };
    },

    gas: (L) => ({
        title: `⛽ ${tr(L, "Gas Station", "ガソリンスタンド")}`,
        content: [...body(
            lead(tr(L, "⏰ Opening hours are not in the data. Check before a long drive, especially in winter and in rural areas.",
                "⏰ 営業時間はデータに含まれていません。冬季や郊外への長距離移動の前にご確認ください。"), "warn") +
            row(tr(L, "Address", "所在地"), X("addr")) + addrNote(L) +
            srcNote(L, 2010)
        ), actions(L, "P07_002")],
        expressionInfos: [
            E("addr", `return ${NZ("P07_002")};`)
        ]
    }),

    wildlife: (L) => {
        // A15: P-code order follows the MLIT spec (name, prefecture, designating body, protection type, designated, released).
        const TYPES = {
            "1": [tr(L, "Wildlife Protection Area", "鳥獣保護区"), tr(L, "Hunting is prohibited here.", "この区域では狩猟が禁止されています。")],
            "2": [tr(L, "Special Protection Zone", "特別保護区域"), tr(L, "Hunting is prohibited, and building, tree-cutting and similar development need permission.", "狩猟が禁止され、建築・伐採などの開発行為には許可が必要です。")],
            "3": [tr(L, "Closed Hunting Area", "休猟区"), tr(L, "Hunting is temporarily suspended here so wildlife populations can recover.", "個体数の回復のため、狩猟が一時的に禁止されています。")]
        };
        const BODIES = { "1": tr(L, "Ministry of the Environment", "環境省"), "2": tr(L, "Prefectural government (Hokkaido)", "都道府県（北海道）") };
        return {
            title: `🦌 ${X("name")}`,
            content: [
                custom((g) => {
                    const box = el("div", { style: BLOCK });
                    const type = TYPES[attr(g, "A15_004")];
                    box.append(el("div", { innerHTML: lead(type ? `${type[0]}<br><span style="font-weight:500;font-size:13px">${type[1]}</span>` : tr(L, "Wildlife protection area", "鳥獣保護区等"), type ? "good" : "plain") }));
                    const body_ = BODIES[attr(g, "A15_003")];
                    if (body_) box.append(labeled(tr(L, "Designated by", "指定機関"), document.createTextNode(body_)));
                    const from = attr(g, "A15_005"), to = attr(g, "A15_006");
                    if (from) box.append(labeled(tr(L, "Designated on", "指定日"), document.createTextNode(from)));
                    if (to) box.append(labeled(tr(L, "Ends / released on", "解除日・終期"), document.createTextNode(to)));
                    return box;
                }),
                ...body((L === "EN" ? row("Area name (Japanese)", X("jname")) : "") + note(tr(L, "Area names are shown in Japanese. Hunting rules apply to hunters only, but stay on marked trails and keep a distance from wildlife.",
                    "区域名は日本語表記です。狩猟規制は狩猟者が対象ですが、野生動物には近づかず、遊歩道を外れないようご注意ください。")) + srcNote(L, 2015))
            ],
            expressionInfos: [
                E("name", L === "EN" ? `return ${q("Wildlife Protection Area")};` : `return ${NZ("A15_001", "鳥獣保護区")};`),
                E("jname", `return ${NZ("A15_001", "—")};`)
            ]
        };
    },

    avalanche: (L) => hazardPopup(L, "❄️", tr(L,
        "Exercise caution along steep roads and mountain passes during heavy snowfall and rapid spring thaw.",
        "降雪・吹雪・急速な雪解けの時期は、急傾斜地や山間道路での雪崩に十分ご注意ください。")),

    landslide: (L) => hazardPopup(L, "🌧️", tr(L,
        "Monitor weather alerts and use caution during heavy rain, typhoon season and spring snowmelt.",
        "集中豪雨・台風シーズン・春先の雪解けの時期は、地すべりや土砂崩れに警戒してください。")),

    ski: (L) => {
        const loc = (base) => (L === "JA" ? `nz(${G(base + "_ja")}, ${NZ(base)})` : NZ(base));
        const SKI_STATUS = {
            "Verified": ["good", "✅", "Checked against online sources", "オンライン情報で確認済み"],
            "Partly verified": ["info", "🟡", "Partly checked. Confirm hours and conditions locally", "一部のみ確認済み。営業時間・状況は現地情報をご確認ください"],
            "Needs confirmation": ["warn", "⚠️", "Not confirmed. Call before you go; it may not be operating", "未確認です。営業していない可能性があるため事前にお問い合わせください"]
        };
        return {
            title: `⛷️ ${X("name")}`,
            content: [...body(
                lead(X("feat"), "info") +
                (L === "EN" ? row("Japanese name", X("nameJa")) : "") +
                row(tr(L, "Municipality", "自治体"), X("muni")) +
                row(tr(L, "Subprefecture", "振興局"), X("sub")) +
                row(tr(L, "Lifts & facilities", "リフト・設備"), X("lifts")) +
                row(tr(L, "Lift fee", "リフト料金"), X("cost")) +
                row(tr(L, "Season & hours", "シーズン・営業時間"), X("season"))
            ), custom((g) => {
                const box = el("div", { style: `${BLOCK};margin-top:6px` });
                const phone = attr(g, "phone");
                if (phone) {
                    const d = el("div");
                    d.append(el("b", { textContent: `${tr(L, "Phone (Japanese)", "電話")}: ` }), el("a", { href: `tel:${phone}`, textContent: phone }));
                    box.append(d);
                }
                const url = safeUrl(attr(g, "source_url"));
                if (url) { const d = el("div"); d.append("🔗 ", linkEl(url, tr(L, "Source ↗", "情報元 ↗"))); box.append(d); }
                const st = SKI_STATUS[attr(g, "status")];
                if (st) {
                    // GeoJSON date strings are converted to epoch milliseconds by the layer
                    let checked = attr(g, "checked");
                    if (/^\d{10,}$/.test(checked)) checked = new Date(Number(checked)).toISOString().slice(0, 10);
                    box.insertAdjacentHTML("beforeend", lead(`${st[1]} ${tr(L, st[2], st[3])}${checked ? ` (${checked})` : ""}`, st[0]));
                }
                if (/^UNVERIFIED/i.test(attr(g, "coord_status"))) {
                    box.append(el("i", { textContent: tr(L, "📍 Map position is approximate.", "📍 地図上の位置は目安です。"), style: "font-size:11px;color:#666;display:block" }));
                }
                box.hidden = !box.childNodes.length;
                return box;
            }), actions(L, "address_ja")],
            expressionInfos: [
                E("name", L === "JA" ? `return nz(${G("name_ja")}, ${NZ("name_en")});` : `return nz(${G("name_en")}, ${NZ("name_ja")});`),
                E("nameJa", `return ${NZ("name_ja")};`),
                E("sub", `return ${loc("subprefecture")};`),
                E("muni", `return ${loc("municipality")};`),
                E("feat", `return ${loc("key_features")};`),
                E("lifts", `return ${loc("lifts")};`),
                E("cost", `return ${loc("cost")};`),
                E("season", `return ${loc("season")};`)
            ]
        };
    },

    communityEvents: (L) => {
        // Multi-select answers are stored as one comma-separated string and codes can be truncated,
        // so match on keywords rather than whole values.
        const BRING = [
            ["food", "Food to share", "料理（シェア用）"], ["snacks", "Snacks", "お菓子"], ["drinks", "Drinks", "飲み物"],
            ["games", "Games", "ゲーム"], ["futons", "Futons / blankets / bedding", "布団・毛布・寝具"],
            ["spending money", "Spending money", "お小遣い（現金）"],
            ["adventure gear", "Adventure gear (see additional information)", "アドベンチャー用装備（詳細は追加情報）"],
            ["something else", "Something else (see additional information)", "その他の持ち物（詳細は追加情報）"],
            ["just bring yourself", "Just yourself", "手ぶらでOK"], ["unknown", "Unknown at this time", "未定"]
        ];
        const bringBody =
            `var raw = ${NZ("are_participants_expected_to_br", "")}; if (raw == '') { return '—'; } var l = Lower(Replace(raw, '_', ' ')); var out = ''; ` +
            BRING.map(([k, en, ja]) => `if (Find(${q(k)}, l) > -1) { if (out != '') { out += ', '; } out += ${q(tr(L, en, ja))}; }`).join(" ") +
            ` if (out == '') { return raw; } return out;`;
        const choice = (field, rules, unknown) =>
            `var raw = ${NZ(field, "")}; if (raw == '') { return '—'; } var l = Lower(raw); ` +
            rules.map(([k, en, ja]) => `if (Find(${q(k)}, l) > -1) { return ${q(tr(L, en, ja))}; }`).join(" ") +
            ` return ${q(tr(L, ...unknown))};`;
        return {
            title: `🎉 ${X("type")}`,
            content: body(
                lead(`📅 ${X("date")}<br><span style="font-weight:500;font-size:13px">${X("when")} · 🌙 ${tr(L, "Overnight", "宿泊")}: ${X("overnight")}</span>`, "good") +
                row(tr(L, "What to bring", "持ち物"), X("bring")) +
                row(tr(L, "Carpooling", "相乗り"), X("carpool")) +
                row(`👤 ${tr(L, "Contact", "連絡先")}`, X("contact")) + HR +
                `<b>📝 ${tr(L, "Additional information", "追加情報")}:</b><p style="margin:4px 0">${X("info")}</p>` +
                note(tr(L, "Submitted by a community member via the ForeignHokkaido survey and not verified. Free-text details are shown as the submitter wrote them.", "コミュニティ会員がフォームから投稿した情報で、内容は確認されていません。自由記述は投稿者の入力どおりに表示されます。"))
            ),
            expressionInfos: [
                // Keyword match (Survey123 can truncate stored codes). "Other" shows the person's own text as written.
                E("type", `var c = ${NZ("what_type_of_event_is_this", "")}; var o = ${NZ("what_type_of_event_is_thi_other", "")}; var l = Lower(c); ` +
                    `if (c == '') { if (o != '') { return o; } return ${q(tr(L, "Community event", "地域のイベント"))}; } ` +
                    `if (Find('other', l) == 0) { if (o != '') { return o; } return ${q(tr(L, "Other event", "その他のイベント"))}; } ` +
                    [
                        ["holiday", "Holiday Party", "ホリデーパーティー"],
                        ["weekend", "Weekend Meetup", "週末の集まり"],
                        ["game", "Game Night", "ゲームナイト"],
                        ["movie", "Movie Night", "映画の夜"],
                        ["multi", "Multi-day Adventure", "複数日のアドベンチャー"],
                        ["english", "English Language Event", "英語イベント"],
                        ["japanese", "Japanese Language Event", "日本語イベント"],
                        ["town", "Town Festival / Event", "町のお祭り・イベント"],
                        ["festival", "Town Festival / Event", "町のお祭り・イベント"]
                    ].map(([k, en, ja]) => `if (Find(${q(k)}, l) > -1) { return ${q(tr(L, en, ja))}; }`).join(" ") +
                    ` return c;`),
                E("date", `var d = ${G("date_and_time")}; if (IsEmpty(d)) { return '—'; } if (TypeOf(d) == 'Number') { d = Date(d); } ` +
                    `if (TypeOf(d) == 'Date') { return Text(d, '${tr(L, "MMM D, YYYY h:mm A", "YYYY/MM/DD HH:mm")}'); } return Text(d);`),
                E("when", `var d = ${G("date_and_time")}; if (IsEmpty(d)) { return ''; } if (TypeOf(d) == 'Number') { d = Date(d); } ` +
                    `if (TypeOf(d) == 'Date') { if (d < Now()) { return ${q(tr(L, "⌛ Already took place", "⌛ 開催済み"))}; } return ${q(tr(L, "⏳ Upcoming", "⏳ 開催予定"))}; } return '';`),
                E("overnight", choice("is_an_overnight_stay_expected", [
                    ["accomodation will be", "Yes — accommodation provided (see additional information)", "あり（宿泊先あり・詳細は追加情報）"],
                    ["arrange your ow", "Yes — arrange your own accommodation", "あり（宿泊先は各自で手配）"],
                    ["no.", "No", "なし"]
                ], ["Unknown at this time", "未定"])),
                E("bring", bringBody),
                E("carpool", choice("will_carpooling_be_available", [
                    ["please contact", "Yes — contact the person or group listed below", "あり（下記の連絡先へ）"],
                    ["arrange transportati", "No — arrange your own transportation", "なし（各自で移動手段を手配）"]
                ], ["Unknown at this time", "未定"])),
                E("contact", `return ${NZ("who_should_participants_contact")};`),
                E("info", `return ${NZ("additional_information_optional")};`)
            ]
        };
    },

    localInterests: (L) => ({
        title: `📍 ${X("type")}`,
        content: body(
            lead(`${tr(L, "Recommendation", "おすすめ度")}: ${X("rating")}`, "good") +
            `<b>📝 ${tr(L, "Additional information", "追加情報")}:</b><p style="margin:4px 0">${X("info")}</p>` +
            note(tr(L, "Submitted by a community member via the ForeignHokkaido survey and not verified. Free-text details are shown as the submitter wrote them.", "コミュニティ会員がフォームから投稿した情報で、内容は確認されていません。自由記述は投稿者の入力どおりに表示されます。"))
        ),
        expressionInfos: [
            E("type", `var c = ${NZ("what_type_of_interest_are_you_a", "")}; var o = ${NZ("what_type_of_interest_are_other", "")}; ` +
                `if (c == '' || (Lower(c) == 'other' && o != '')) { c = o; } if (c == '') { return ${q(tr(L, "Local interest", "地域のおすすめスポット"))}; } ` +
                (L === "JA" ? `return ${decodePairs("c", [
                    ["Nature", "自然"], ["Recreation", "レクリエーション"], ["Must-See Novelty", "必見スポット"],
                    ["Food Recs", "グルメのおすすめ"], ["Wildlife Viewing", "野生動物観察"], ["Store/Shopping", "店舗・ショッピング"], ["Other", "その他"]
                ])};` : "return c;")),
            E("rating", `var r = ${NZ("on_a_scale_of_1_5_how_strongly", "")}; if (r == '') { return '—'; } if (Lower(r) == 'n/a') { return 'N/A'; } ` +
                `var n = Number(r); if (IsNan(n) || n < 1 || n > 5) { return r; } return Left('★★★★★', n) + Left('☆☆☆☆☆', 5 - n) + ' (' + r + '/5)';`),
            E("info", `return ${NZ("additional_information")};`)
        ]
    })
};

// Avalanche and landslide popups share a layout.
function hazardPopup(L, icon, notice) {
    return {
        title: X("title"),
        content: body(
            lead(`${icon} ${notice}`, "warn") +
            row(`📍 ${tr(L, "Location", "場所")}`, X("loc")) +
            row(`🆔 ${tr(L, "Site ID", "箇所番号")}`, X("id")) +
            (L === "EN" ? note("Place names are shown in Japanese.") : "") +
            `<small style="color:gray;display:block;margin-top:6px">${tr(L, "Source", "出典")}: ${X("src")}</small>`
        ),
        expressionInfos: [
            E("title", L === "JA"
                ? `var j = ${NZ("hazard_type_jp", "")}; var e = ${NZ("hazard_type_en", "")}; if (j == '') { return nz(e, '—'); } if (e == '') { return j; } return j + ' (' + e + ')';`
                : `var e = ${NZ("hazard_type_en", "")}; if (e == '') { return ${NZ("hazard_type_jp")}; } return e;`),
            E("loc", `var m = ${NZ("市町村", "")}; ${L === "EN" ? `m = ${MUNI_EN};` : ""} ` +
                `var a = ${NZ("字", "")}; var d = ${NZ("地区名", "")}; var out = m + ' ' + a; ` +
                `if (d != '') { out += ${L === "JA" ? "' (' + d + ' 地区)'" : "' (' + d + ' District)'"}; } return Trim(out);`),
            E("id", `return ${NZ("箇所番号")};`),
            E("src", `return esc(${NZ("source_attr")});`)
        ]
    };
}

const LINE_PAIRS = [
    ["北海道新幹線", "Hokkaido Shinkansen"], ["道南いさりび鉄道線", "Donan Isaribi Railway Line"],
    ["函館本線", "Hakodate Main Line"], ["海峡線", "Kaikyo Line"], ["江差線", "Esashi Line"],
    ["室蘭本線", "Muroran Main Line"], ["函館市電", "Hakodate Tram"],
    ["室蘭線", "Muroran Main Line"], ["函館線", "Hakodate Main Line"], ["大森線", "Omori Line (tram)"], ["湯の川線", "Yunokawa Line (tram)"],
    ["宝来・谷地頭線", "Horai-Yachigashira Line (tram)"], ["本線", "Main Line (tram)"]
];
const OPERATOR_PAIRS = [
    ["北海道旅客鉄道", "JR Hokkaido"], ["道南いさりび鉄道", "Donan Isaribi Railway"],
    ["函館市企業局交通部", "Hakodate City Transportation Bureau (tram)"],
    ["函館市", "Hakodate City Transportation Bureau (tram)"]
];

/* ==========================================================================
   LAYER DEFINITIONS
   `z` sets stacking (low = bottom). Season defaults are set in SEASON_LAYERS below.
   ========================================================================== */

/* ---- Symbology -------------------------------------------------------------
   Colors come from the Okabe-Ito palette (safe for red-green and blue-yellow
   color blindness). Color is never the only cue: every point layer also has its
   own shape, and the two hazard polygons use different fill patterns.
   Color families:  blue = public services, green = safety/nature, orange = roads,
   vermillion = medical, purple/yellow = community, gray = rail.
   -------------------------------------------------------------------------- */
const C = {
    blue: [0, 114, 178], sky: [86, 180, 233], green: [0, 158, 115], orange: [230, 159, 0],
    yellow: [240, 228, 66], vermillion: [213, 94, 0], purple: [204, 121, 167], dark: [51, 51, 51]
};
const WHITE = [255, 255, 255, 1];
const rgba = (c, a = 1) => [...c, a];

const marker = (style, color, size, outline = WHITE, width = 1.25, extra = {}) =>
    ({ type: "simple-marker", style, color: rgba(color, 0.95), size: `${size}px`, outline: { color: outline, width }, ...extra });
const fill = (color, alpha, outlineColor = color, width = 1.2, extra = {}) =>
    ({ type: "simple-fill", color: rgba(color, alpha), outline: { color: rgba(outlineColor, 0.9), width }, ...extra });
const single = (symbol) => ({ type: "simple", symbol });

const starPath = (R = 10, r = 4.3) => {
    const pts = Array.from({ length: 10 }, (_, i) => {
        const a = -Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 ? r : R;
        return `${(rad * Math.cos(a)).toFixed(2)} ${(rad * Math.sin(a)).toFixed(2)}`;
    });
    return `M ${pts.join(" L ")} Z`;
};
const HEART = "M 0 -4 C -2 -10 -12 -8 -10 0 C -9 4 -3 8 0 12 C 3 8 9 4 10 0 C 12 -8 2 -10 0 -4 Z";

const RENDERERS = {
    // --- polygons ---
    subprefecture: single(fill(C.dark, 0, C.dark, 1.75)),
    municipality: single({ type: "simple-fill", color: [0, 0, 0, 0.03], outline: { color: [90, 90, 90, 0.85], width: 1, style: "dash" } }),
    trash: single(fill(C.sky, 0.22, C.blue, 2.6)),                       // translucent highlight for the garbage lookup
    snow: {
        type: "unique-value", field: "A22_100005",                       // one hue, three lightness steps
        defaultSymbol: fill([200, 220, 240], 0.3, [100, 100, 100], 1),
        uniqueValueInfos: [
            { value: "1", label: "Special Heavy Snow Zone (特別豪雪地帯)", symbol: fill([25, 60, 120], 0.5, [10, 30, 80], 1.6) },
            { value: "2", label: "Heavy Snow Zone (豪雪地帯)", symbol: fill([65, 125, 190], 0.4, [30, 80, 140], 1.3) },
            { value: "9", label: "Other designated area (指定地域)", symbol: fill([140, 190, 230], 0.35, [70, 130, 180], 1.1) }
        ]
    },
    avalanche: single(fill(C.vermillion, 0.3, C.vermillion, 1.3, { style: "forward-diagonal" })),
    landslide: single(fill(C.orange, 0.35, [150, 95, 0], 1.3, { style: "backward-diagonal" })),

    // --- lines ---
    railLines: single({ type: "simple-line", color: [90, 90, 90, 0.9], width: 1.25, style: "solid" }),

    // --- points ---
    municipal: single(marker("square", C.blue, 10)),
    schools: single(marker("triangle", C.blue, 11)),
    post: single(marker("circle", C.blue, 8)),
    shelters: single(marker("square", C.green, 9, [255, 255, 255, 1], 1)),
    police: single(marker("diamond", [0, 45, 110], 12, [255, 255, 255, 1], 1.5)),
    railStations: single({ type: "simple-marker", style: "circle", color: [255, 255, 255, 1], size: "10px", outline: { color: rgba(C.dark), width: 1.5 } }),
    bus: single(marker("circle", C.sky, 7, [0, 60, 100, 1], 1)),
    roadside: single(marker("diamond", C.orange, 13, [120, 75, 0, 1], 1.25)),
    gas: single(marker("square", C.yellow, 9, [80, 70, 0, 1], 1.25)),
    ski: single(marker("triangle", C.purple, 13, [100, 40, 75, 1], 1.25)),
    communityEvents: single(marker("path", C.yellow, 20, [110, 95, 0, 1], 1.2, { path: starPath() })),
    localInterests: single(marker("path", C.purple, 17, [100, 40, 75, 1], 1.1, { path: HEART })),
    medical: {
        type: "unique-value", field: "facility_type",                    // one color, four shapes
        defaultSymbol: marker("circle", [120, 120, 120], 8),
        uniqueValueInfos: [
            { value: "Hospital", label: "Hospital (病院)", symbol: marker("cross", C.vermillion, 15, C.vermillion, 2.5) },
            { value: "Clinic", label: "Clinic (診療所)", symbol: marker("circle", C.vermillion, 10) },
            { value: "Dental", label: "Dental Clinic (歯科)", symbol: marker("diamond", C.vermillion, 10) },
            { value: "Pharmacy", label: "Pharmacy (薬局)", symbol: marker("square", C.vermillion, 8) }
        ]
    }
};

// Wildlife reserves: styled after the layer loads, because the geometry type isn't known up front.
const WILDLIFE_BY_GEOMETRY = {
    polygon: single(fill(C.green, 0.25, C.green, 1.6)),
    polyline: single({ type: "simple-line", color: rgba(C.green), width: 2.5 }),
    point: single(marker("circle", C.green, 11))
};

const feature = (key, labelKey, z, url, extra = {}) => ({ key, labelKey, z, type: "feature", url, ...extra });
const geojson = (key, labelKey, z, url, extra = {}) => ({ key, labelKey, z, type: "geojson", url, ...extra });
const FS = `${SERVICES}`;

/* Community layers (Survey123 results) are re-queried while the map is open, so new
   submissions appear without a page reload. Minutes; 0 turns it off. */
const LIVE_REFRESH_MIN = 1;
const SPECS = [
    feature("snow", "layerSnow", 10, `${FS}/ForeignHokkaido_OshimaHiyama_SnowStats/FeatureServer/0`, { props: { renderer: RENDERERS.snow }, popup: POPUPS.snow }),
    geojson("landslide", "layerLandslide", 11, "datasets/oshima_hiyama_landslides.geojson", { props: { definitionExpression: "hazard_code = 'LANDSLIDE'", renderer: RENDERERS.landslide }, popup: POPUPS.landslide }),
    geojson("avalanche", "layerAvalanche", 12, "datasets/oshima_hiyama_avalanches.geojson", { props: { definitionExpression: "hazard_code = 'AVALANCHE'", renderer: RENDERERS.avalanche }, popup: POPUPS.avalanche }),
    // Garbage lookup: not in the layer list. The search box in the panel is the only way to show it.
    feature("trash", "layerTrash", 13, `${FS}/ForeignHokkaido_TrashRegs_EN_JA/FeatureServer/0`, { props: { renderer: RENDERERS.trash }, popup: POPUPS.trash }),
    feature("wildlife", "layerWildlife", 15, `${FS}/ForeignHokkaido_OshimaHiyama_WildlifeReserves/FeatureServer/0`, { byGeometry: WILDLIFE_BY_GEOMETRY, popup: POPUPS.wildlife }),
    feature("muniBoundaries", "layerMuniBoundaries", 22, `${FS}/ForeignHokkaido_AdminBoundaries/FeatureServer/1`, { props: { renderer: RENDERERS.municipality }, popup: POPUPS.muniBoundaries }),
    feature("oshhiBoundaries", "layerOshHiBoundaries", 21, `${FS}/ForeignHokkaido_AdminBoundaries/FeatureServer/2`, { props: { renderer: RENDERERS.subprefecture }, popup: POPUPS.oshhiBoundaries }),
    feature("railLines", "layerRailLines", 30, `${FS}/ForeignHokkaido_OshimaHiyama_Railroad/FeatureServer/1`, { props: { renderer: RENDERERS.railLines }, popup: POPUPS.railLines }),
    feature("bus", "layerBus", 40, `${FS}/ForeignHokkaido_OshimaHiyama_BusStops/FeatureServer`, { props: { renderer: RENDERERS.bus, minScale: 150000 }, popup: POPUPS.bus }),
    feature("gas", "layerGas", 41, `${FS}/ForeignHokkaido_OshimaHiyama_RoadsideStations/FeatureServer/2`, { props: { renderer: RENDERERS.gas }, popup: POPUPS.gas }),
    feature("roadside", "layerRoadside", 42, `${FS}/ForeignHokkaido_OshimaHiyama_MichiNoEki_EN_Names/FeatureServer`, { props: { renderer: RENDERERS.roadside }, popup: POPUPS.roadside }),
    feature("post", "layerPost", 43, `${FS}/ForeignHokkaido_OshimaHiyama_PostOffices/FeatureServer/`, { props: { renderer: RENDERERS.post }, popup: POPUPS.post }),
    feature("schools", "layerSchools", 44, `${FS}/ForeignHokkaido_OshimaHiyama_Schools/FeatureServer`, { props: { renderer: RENDERERS.schools }, popup: POPUPS.schools }),
    feature("municipal", "layerMunicipal", 45, `${FS}/ForeignHokkaido_Municipal_Offices_etc_and_Public_Meeting_Facilities/FeatureServer`, { props: { definitionExpression: "P05_002 IN ('1', '2', '4')", renderer: RENDERERS.municipal }, popup: POPUPS.municipal }),
    feature("shelters", "layerShelters", 46, `${FS}/ForeignHokkaido_DisasterPrevention/FeatureServer`, { props: { renderer: RENDERERS.shelters, minScale: 280000 }, popup: POPUPS.shelters }),
    feature("police", "layerPolice", 47, `${FS}/ForeignHokkaido_OshimaHiyama_Police/FeatureServer/1`, { props: { renderer: RENDERERS.police }, popup: POPUPS.police }),
    feature("railStations", "layerRailStations", 48, `${FS}/ForeignHokkaido_OshimaHiyama_TrainStations_EN_Names/FeatureServer`, { props: { renderer: RENDERERS.railStations }, popup: POPUPS.railStations }),
    geojson("medical", "layerMedical", 49, "datasets/oshima_hiyama_medical_master_v2.geojson", { props: { renderer: RENDERERS.medical, minScale: 200000 }, popup: POPUPS.medical }),
    geojson("ski", "layerSki", 50, "datasets/ski_resorts_v2.geojson", { props: { renderer: RENDERERS.ski }, popup: POPUPS.ski }),
    feature("communityEvents", "layerCommunityEvents", 55, `${FS}/survey123_ce59397e2ce24ba9825b39f151844c21_results/FeatureServer`, { props: { renderer: RENDERERS.communityEvents, refreshInterval: LIVE_REFRESH_MIN }, popup: POPUPS.communityEvents }),
    feature("localInterests", "layerLocalInterests", 56, `${FS}/survey123_4d7f38da81374bb8b57cd737de7fe630_results/FeatureServer`, { props: { renderer: RENDERERS.localInterests, refreshInterval: LIVE_REFRESH_MIN }, popup: POPUPS.localInterests })
];
const SPEC = Object.fromEntries(SPECS.map((s) => [s.key, s]));

/* ---- Attribution -----------------------------------------------------------
   Shown in the map's attribution bar (bottom edge) while the layer is visible.
   Identical strings are merged by the SDK, so every MLIT layer uses the same text.
   Layers with no entry (snow, hazards, medical) show nothing; add one when the source is settled.
   -------------------------------------------------------------------------- */
const MLIT_CREDIT = ["MLIT National Land Numerical Information", "国土数値情報（国土交通省）"];
const HOKKAIDO_HAZARD_CREDIT = ["Hazard areas: Hokkaido Forestry Bureau, Mountain Disaster Hazard Areas (CC BY 4.0)", "危険地区：北海道水産林務部林務局治山課「山地災害危険地区」（CC BY 4.0）"];
const CREDITS = {
    municipal: MLIT_CREDIT, police: MLIT_CREDIT, post: MLIT_CREDIT, schools: MLIT_CREDIT, roadside: MLIT_CREDIT,
    bus: MLIT_CREDIT, gas: MLIT_CREDIT, shelters: MLIT_CREDIT, wildlife: MLIT_CREDIT,
    muniBoundaries: MLIT_CREDIT, oshhiBoundaries: MLIT_CREDIT, railStations: MLIT_CREDIT, railLines: MLIT_CREDIT,
    medical: ["Medical facilities: Hokkaido Government open data (CC BY) and foreign-language support list", "医療機関：北海道オープンデータ（CC BY）・外国語対応可能医療機関一覧"],
    snow: MLIT_CREDIT, // A22 snowfall statistics
    avalanche: HOKKAIDO_HAZARD_CREDIT, landslide: HOKKAIDO_HAZARD_CREDIT,
    trash: ["Garbage rules: each town's official website (checked Nov 2026)", "ごみ分別：各自治体の公式サイト（2026年11月確認）"],
    ski: ["Ski areas: town and resort listings (checked Nov 2026)", "スキー場：自治体・施設の公開情報（2026年11月確認）"],
    communityEvents: ["Community submissions", "コミュニティ投稿"],
    localInterests: ["Community submissions", "コミュニティ投稿"]
};
const creditFor = (key, L) => { const c = CREDITS[key]; return c ? (L === "JA" ? c[1] : c[0]) : undefined; };

/* ---- Season baselines ------------------------------------------------------
   Switching season turns that season's layers on and the other season's off.
   Layers in neither list (medical, schools, ...) keep whatever the user chose.
   ALWAYS_ON layers are visible from the start in both seasons.
   -------------------------------------------------------------------------- */
const ALWAYS_ON = ["oshhiBoundaries"];
const SEASON_LAYERS = {
    summer: ["muniBoundaries"],
    winter: ["snow", "avalanche", "ski"]
};
const isBaseline = (key, season) => ALWAYS_ON.includes(key) || SEASON_LAYERS[season].includes(key);

// Control-panel grouping (independent of stacking order)
const CATEGORIES = [
    { key: "catAdmin", layers: ["oshhiBoundaries", "muniBoundaries"] },
    { key: "catLogistics", layers: ["municipal", "schools", "post"] },
    { key: "catSafety", layers: ["shelters", "police", "medical"] },
    { key: "catTransit", layers: ["railStations", "railLines", "bus", "roadside", "gas"] },
    { key: "catHazards", layers: ["snow", "avalanche", "landslide"] },
    { key: "catNature", layers: ["ski", "wildlife"] },
    { key: "catCommunity", layers: ["communityEvents", "localInterests"] }
];

/* ==========================================================================
   SDK LOADING
   ========================================================================== */

function load(modules) {
    return new Promise((resolve, reject) => {
        if (typeof window.require !== "function") {
            reject(new Error("ArcGIS SDK is not loaded (check the <script> tag in index.html)."));
            return;
        }
        window.require(modules, (...loaded) => resolve(loaded));
    });
}

/* ==========================================================================
   LAYERS
   ========================================================================== */

// Legend entries are written "English (日本語)"; in Japanese mode show only the Japanese part.
const legendLabels = new Map(); // layer key -> original labels
function relabelLegend(key, L = currentLang) {
    const layer = layers[key];
    const infos = layer?.renderer?.uniqueValueInfos;
    if (!infos) return;
    if (!legendLabels.has(key)) legendLabels.set(key, infos.map((i) => i.label));
    const orig = legendLabels.get(key);
    const r = layer.renderer.clone();
    r.uniqueValueInfos.forEach((info, i) => {
        const m = /^(.*) \((.*)\)$/.exec(orig[i] ?? "");
        info.label = m && L === "JA" ? m[2] : orig[i];
    });
    layer.renderer = r;
}

/** Re-query a live community layer when its data is older than the refresh interval. */
function refreshIfStale(layer) {
    if (!layer?.refreshInterval || typeof layer.refresh !== "function") return;
    if (Date.now() - (layer.__fhRefreshed || 0) < layer.refreshInterval * 60000) return;
    layer.__fhRefreshed = Date.now();
    try { layer.refresh(); } catch (e) { console.warn(`[layer] refresh failed for "${layer.id}":`, e?.message || e); }
}

/** Phones pause timers in background tabs, so also refresh when the user comes back to the page. */
function watchLiveLayers() {
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState !== "visible") return;
        Object.values(layers).forEach((l) => { if (l?.visible) refreshIfStale(l); });
    });
}

function createLayer(spec) {
    const Ctor = spec.type === "geojson" ? esri.GeoJSONLayer : esri.FeatureLayer;
    const layer = new Ctor({
        id: spec.key,
        url: spec.url,
        title: t(spec.labelKey, currentLang),
        outFields: ["*"],
        visible: isBaseline(spec.key, currentSeason),
        ...(creditFor(spec.key, currentLang) ? { copyright: creditFor(spec.key, currentLang) } : {}),
        ...spec.props
    });
    layers[spec.key] = layer;
    applyPopup(spec);
    relabelLegend(spec.key);

    layer.watch("visible", (visible) => {
        const checkbox = panelEl?.querySelector(`#toggle-${spec.key}`);
        if (checkbox) checkbox.checked = visible;
        if (visible) { syncFilter(layer); refreshIfStale(layer); }
        updateScaleHints();
    });
    if (spec.props?.refreshInterval) {
        layer.__fhRefreshed = Date.now();
        layer.on("refresh", () => { layer.__fhRefreshed = Date.now(); });
    }
    layer.when(
        () => {
            if (spec.byGeometry?.[layer.geometryType]) layer.renderer = spec.byGeometry[layer.geometryType];
            applyPopup(spec);
            auditPopupFields(spec);
        },
        (err) => console.warn(`[layer] "${spec.key}" failed to load:`, err?.message || err)
    );
    return layer;
}

function applyPopup(spec) {
    const layer = layers[spec.key];
    // lastEditInfoEnabled:false keeps the "Last edited by <account>" line (a submitter's email) out of every popup.
    if (layer) layer.popupTemplate = { ...spec.popup(currentLang, layer), lastEditInfoEnabled: false };
}

/** Console report of popup fields that do not exist on the layer (typos, renamed fields). */
function auditPopupFields(spec) {
    const layer = layers[spec.key];
    if (!layer?.fields?.length || spec.popup === undefined) return;
    const have = new Set(layer.fields.map((f) => f.name.toLowerCase()));
    const used = new Set();
    const strings = (o, out = []) => {
        if (typeof o === "string") out.push(o);
        else if (o && typeof o === "object") Object.values(o).forEach((v) => strings(v, out));
        return out;
    };
    for (const L of ["EN", "JA"]) {
        const tpl = spec.popup(L, layer);
        for (const s of strings({ title: tpl.title, content: tpl.content })) {
            for (const m of s.matchAll(/\{([^{}\s"'<>]+)\}/g)) if (!m[1].startsWith("expression/")) used.add(m[1]);
        }
        for (const s of strings(tpl.expressionInfos)) {
            for (const m of s.matchAll(/\bg\(\$feature,\s*'([^']+)'\)/g)) used.add(m[1]);
        }
    }
    const missing = [...used].filter((f) => !have.has(f.toLowerCase()));
    if (missing.length) {
        console.warn(`[popup audit] ${spec.key}: fields not found on layer → ${missing.join(", ")}\n` +
            `Fields that DO exist: ${layer.fields.map((f) => f.name).join(", ")}`);
    }
}

/* ==========================================================================
   SPATIAL FILTER (municipality) & TRASH LOOKUP
   ========================================================================== */

const sqlLike = (town) => `${TRASH_MUNI_FIELD} LIKE '%${town.replace(/'/g, "''")}%'`;

async function syncFilter(layer) {
    if (layer.id === "trash") return; // the garbage highlight is driven only by its own search
    try {
        const layerView = await view.whenLayerView(layer);
        layerView.filter = spatialFilter;
    } catch { /* layer failed or has no view yet */ }
}

async function townGeometry(town) {
    if (townGeometryCache.has(town)) return townGeometryCache.get(town);
    const layer = layers.muniBoundaries;
    const query = layer.createQuery();
    query.where = sqlLike(town).replace(TRASH_MUNI_FIELD, "N03_004");
    query.returnGeometry = true;
    query.outSpatialReference = view.spatialReference;
    const { features } = await layer.queryFeatures(query);
    const geoms = features.map((f) => f.geometry).filter((g) => g?.type === "polygon");
    const geometry = geoms.length > 1 ? esri.geometryEngine.union(geoms) : geoms[0] ?? null;
    townGeometryCache.set(town, geometry);
    return geometry;
}

/* ---- Municipality summary (shown in the municipality polygon popup) ---- */
const SUMMARY_ITEMS = [
    { layer: "medical", own: true, icon: "🏥", en: "Medical facilities", ja: "医療機関", keepZero: true },
    { layer: "medical", own: true, where: "multilingual = 1", icon: "🌟", en: "…with foreign-language support", ja: "うち外国語対応", keepZero: true },
    { layer: "shelters", icon: "🛡️", en: "Emergency shelters", ja: "避難所" },
    { layer: "schools", icon: "🏫", en: "Schools", ja: "学校" },
    { layer: "municipal", icon: "🏛️", en: "Town / city offices & facilities", ja: "役場・公共施設" },
    { layer: "post", icon: "✉️", en: "Post offices", ja: "郵便局" },
    { layer: "police", icon: "👮", en: "Police boxes / stations", ja: "交番・警察署" },
    { layer: "railStations", unique: "N02_005", icon: "🚉", en: "Train stations", ja: "駅" },
    { layer: "bus", icon: "🚌", en: "Bus stops", ja: "バス停" },
    { layer: "roadside", icon: "🚗", en: "Michi-no-Eki", ja: "道の駅" },
    { layer: "gas", icon: "⛽", en: "Gas stations", ja: "ガソリンスタンド" }
];
const townCountsCache = new Map();

async function townCounts(ja) {
    if (townCountsCache.has(ja)) return townCountsCache.get(ja);
    const geometry = await townGeometry(ja);
    if (!geometry) return null;
    const counts = await Promise.all(SUMMARY_ITEMS.map(async (it) => {
        const layer = layers[it.layer];
        if (!layer) return 0;
        try {
            const q = layer.createQuery(); // carries the layer's own definitionExpression
            q.geometry = geometry;
            q.spatialRelationship = "intersects";
            if (it.own) q.where = it.where || "1=1"; // ignore the multilingual-only toggle
            if (it.unique) {
                q.outFields = [it.unique];
                q.returnGeometry = false;
                const { features } = await layer.queryFeatures(q);
                return new Set(features.map((f) => f.attributes[it.unique])).size; // a station on two lines counts once
            }
            return await layer.queryFeatureCount(q);
        } catch (e) { console.warn(`Summary count failed for ${it.layer}:`, e); return null; }
    }));
    const trashLayer = layers.trash;
    let hasTrash = false;
    try { const q = trashLayer.createQuery(); q.where = sqlLike(ja); hasTrash = (await trashLayer.queryFeatureCount(q)) > 0; } catch { /* no trash layer */ }
    const result = { counts, hasTrash };
    townCountsCache.set(ja, result);
    return result;
}

function muniSummary(graphic, L) {
    const ja = String(graphic.attributes?.N03_004 ?? "").trim();
    const wrap = el("div", { style: "font-size:13px;line-height:1.5;margin-top:6px" });
    if (!ja) return wrap;
    const head = el("div", { style: "font-weight:700;border-top:1px solid #ddd;padding-top:8px;margin-bottom:4px", textContent: tr(L, "Mapped in this town", "この町にある施設（地図上）") });
    const status = el("div", { style: "color:#666;font-size:12px", textContent: tr(L, "Counting…", "集計中…") });
    wrap.append(head, status);
    townCounts(ja).then((res) => {
        if (!res) { status.textContent = tr(L, "Summary unavailable.", "集計できませんでした。"); return; }
        status.remove();
        const grid = el("div", { style: "display:grid;grid-template-columns:1fr auto;gap:2px 12px" });
        SUMMARY_ITEMS.forEach((it, i) => {
            const n = res.counts[i];
            if (n === null || (!n && !it.keepZero)) return;
            grid.append(el("span", { textContent: `${it.icon} ${tr(L, it.en, it.ja)}` }), el("b", { style: "text-align:right", textContent: String(n) }));
        });
        wrap.append(grid, el("div", { style: "color:#666;font-size:11px;margin-top:4px", textContent: tr(L, "Counts of places on this map; not every business or facility is included.", "このマップに載っている施設の数です。すべての施設を網羅しているわけではありません。") }));
        const btnStyle = "padding:6px 10px;font:inherit;font-size:12px;font-weight:600;color:#fff;background:#1b365d;border:0;border-radius:6px;cursor:pointer";
        const btns = el("div", { style: "display:flex;flex-wrap:wrap;gap:6px;margin-top:8px" });
        btns.append(el("button", { type: "button", style: btnStyle, textContent: tr(L, "Show only this town", "この町だけ表示"), onclick: async () => { await applyMuniFilter(ja); renderPanel(); view.closePopup(); } }));
        if (res.hasTrash) btns.append(el("button", { type: "button", style: btnStyle, textContent: `🗑️ ${tr(L, "Garbage rules", "ごみ分別")}`, onclick: () => { showTrash(ja); renderPanel(); } }));
        wrap.append(btns);
    }).catch((e) => { console.warn("Municipality summary failed:", e); status.textContent = tr(L, "Summary unavailable.", "集計できませんでした。"); });
    return wrap;
}

// Outline the chosen town so people can see which one is selected.
function drawTownHighlight(geometry) {
    if (!townGfx) return;
    townGfx.removeAll();
    if (!geometry) return;
    townGfx.add(new esri.Graphic({ geometry, symbol: { type: "simple-fill", color: [37, 99, 235, 0.08], outline: { color: [37, 99, 235, 1], width: 3 } } }));
}

async function applyMuniFilter(town, { zoom = true } = {}) {
    muniFilter = town;
    const token = ++filterToken;
    if (town === "ALL") {
        spatialFilter = null;
        drawTownHighlight(null);
    } else {
        const geometry = await townGeometry(town).catch((e) => { console.warn("Municipality query failed:", e); return null; });
        if (token !== filterToken || !geometry) return;
        spatialFilter = { geometry, spatialRelationship: "intersects" };
        drawTownHighlight(geometry);
        if (zoom && geometry.extent) view.goTo(geometry.extent.expand(1.15), EASE);
    }
    Object.values(layers).forEach((layer) => { if (layer.visible) syncFilter(layer); });
    if (town === "ALL" && zoom) view.goTo(homeView(view.width), EASE);
}

async function showTrash(town) {
    trashTown = town;
    const layer = layers.trash;
    if (town === "ALL") {
        layer.visible = false;
        layer.definitionExpression = null;
        if (view.popup?.selectedFeature?.layer === layer) view.closePopup();
        return;
    }
    layer.definitionExpression = sqlLike(town);
    layer.visible = true;
    try {
        const geometry = await townGeometry(town);
        if (trashTown !== town) return;
        if (geometry?.extent) await view.goTo(geometry.extent.expand(1.5), EASE);
        const query = layer.createQuery();
        query.where = sqlLike(town);
        query.outFields = ["*"];
        const { features } = await layer.queryFeatures(query);
        if (features.length && trashTown === town) {
            view.openPopup({ features: [features[0]], location: geometry?.extent?.center ?? features[0].geometry?.extent?.center });
        }
    } catch (err) {
        console.warn("Trash lookup failed:", err);
    }
}

/* ==========================================================================
   CONTROL PANEL (one render function; one set of delegated listeners)
   ========================================================================== */

const muniOptions = (L, allLabel, selected) =>
    `<option value="ALL">${allLabel}</option>` +
    Object.entries(subprefectures).map(([group, sp]) =>
        `<optgroup label="${tr(L, sp.en, sp.ja)}">` +
        municipalities.filter((m) => m.group === group)
            .map((m) => `<option value="${m.ja}"${m.ja === selected ? " selected" : ""}>${tr(L, m.en, m.ja)}</option>`).join("") +
        `</optgroup>`).join("");

function renderPanel() {
    if (!panelEl) return;
    const L = currentLang;
    const scroll = panelEl.scrollTop;
    panelEl.innerHTML = `
        <div class="fh-panel-head"><h3>${t("panelTitle", L)}</h3><button type="button" class="fh-panel-close" data-panel-close aria-label="${tr(L, "Close panel", "パネルを閉じる")}">✕</button></div>
        <div class="fh-field" id="tour-muni">
            <label for="muni-filter-select">${t("muniFilterLabel", L)}</label>
            <select id="muni-filter-select" class="fh-select">${muniOptions(L, t("muniAll", L), muniFilter)}</select>
        </div>
        <div class="fh-field" id="tour-trash">
            <label for="trash-filter-select">🗑️ ${t("trashLookupLabel", L)}</label>
            <select id="trash-filter-select" class="fh-select">${muniOptions(L, t("trashAll", L), trashTown)}</select>
        </div>
        <div id="tour-nearest">
        <div class="fh-section-title">📍 ${tr(L, "Find the nearest…", "近くの施設を探す")}</div>
        <div class="fh-field">
            <select id="nearest-cat" class="fh-select" aria-label="${tr(L, "What are you looking for?", "探したい施設")}">
                ${NEAREST.map((c) => `<option value="${c.key}"${c.key === nearest.cat ? " selected" : ""}>${c.icon} ${tr(L, c.en, c.ja)}</option>`).join("")}
            </select>
        </div>
        <div class="fh-btn-row">
            <button type="button" class="fh-btn${nearestActive() === "locate" ? " is-active" : ""}" data-nearest="locate" aria-pressed="${nearestActive() === "locate"}">📍 ${tr(L, "Use my location", "現在地から")}</button>
            <button type="button" class="fh-btn${nearestActive() === "pick" ? " is-active" : ""}" data-nearest="pick" aria-pressed="${nearestActive() === "pick"}">🗺️ ${tr(L, "Pick on map", "地図で選ぶ")}</button>
        </div>
        <div id="nearest-results" aria-live="polite">${nearestResultsHtml(L)}</div>
        </div>
        <div class="fh-section-title">${t("layersLabel", L)}</div>
        ${CATEGORIES.map((c, i) => `
            <div class="fh-cat"${i === 0 ? ' id="tour-layers"' : ""}>
                <div class="fh-cat-title">${t(c.key, L)}</div>
                ${c.layers.map((key) => `
                    <label class="fh-check">
                        <input type="checkbox" id="toggle-${key}" data-layer="${key}"${layers[key].visible ? " checked" : ""}>
                        <span class="fh-check-text"><span id="toggle-${key}-lbl">${t(SPEC[key].labelKey, L)}</span>${SPEC[key].props?.minScale ? `<small class="fh-hint" id="hint-${key}" hidden>${t("zoomHint", L)}</small>` : ""}</span>
                    </label>${key === "medical" ? `
                    <label class="fh-check fh-sub"><input type="checkbox" id="medical-multi"${medicalMultiOnly ? " checked" : ""}><span class="fh-check-text"><span>🌟 ${t("medicalMultiOnly", L)}</span></span></label>` : ""}`).join("")}
            </div>`).join("")}
        <div class="fh-section-title">${t("crowdsourceHeader", L)}</div>
        <div class="fh-links" id="tour-links">
            <a class="fh-link is-survey" href="${FORM_LINKS.survey}" target="_blank" rel="noopener noreferrer">${t("surveyBtn", L)}</a>
            <a class="fh-link is-report" href="${FORM_LINKS.report}" target="_blank" rel="noopener noreferrer">${t("reportBtn", L)}</a>
            <a class="fh-link is-bug" href="${FORM_LINKS.bug}" target="_blank" rel="noopener noreferrer">${t("reportAppBtn", L)}</a>
        </div>
        <div class="fh-about-link"><button type="button" class="fh-linkbtn" data-about>ⓘ ${tr(L, "About & data sources", "このアプリについて・データの出典")}</button></div>`;
    panelEl.scrollTop = scroll;
    toggleBtn.textContent = t("mapControlsBtn", L);
    updateScaleHints();
}

function updateScaleHints() {
    if (!view || !panelEl) return;
    for (const spec of SPECS) {
        if (!spec.props?.minScale) continue;
        const minScale = layers[spec.key]?.minScale; // current value (0 = no limit)
        const hidden = !(layers[spec.key]?.visible && minScale && view.scale > minScale);
        const hint = panelEl.querySelector(`#hint-${spec.key}`);
        if (hint) hint.hidden = hidden;
        panelEl.querySelector(`#toggle-${spec.key}-lbl`)?.classList.toggle("is-muted", !hidden);
    }
}

// Show only facilities with foreign-language support. The four matches would vanish when zoomed out, so minScale is lifted while this is on.
function setMedicalMultiOnly(on) {
    medicalMultiOnly = on;
    const layer = layers.medical;
    if (!layer) return;
    layer.definitionExpression = on ? "multilingual = 1" : null;
    layer.minScale = on ? 0 : SPEC.medical.props.minScale;
    if (on) layer.visible = true;
    updateScaleHints();
}

/* ==========================================================================
   FIND THE NEAREST
   Asks the layers themselves (queryFeatures with a distance), so it works whether or not a layer is
   switched on. The search widens 3 -> 10 -> 30 -> 100 km until at least three are found.
   Distances are straight-line.
   ========================================================================== */

const SEARCH_STEPS_KM = [3, 10, 30, 100];
const RESULT_COUNT = 3;
const medName = (a, L) => (L === "JA" ? a["名称"] : a.name_en || a["名称"]);
const medDetail = (a, L) => (Number(a.multilingual) === 1 ? `🌟 ${tr(L, "Foreign-language support", "外国語対応")}` : "");
const MED_OWN = { layer: "medical", own: true, name: medName, detail: medDetail }; // own: ignore the multilingual-only toggle's filter
const NEAREST = [
    { key: "hospital", icon: "🏥", en: "Hospital", ja: "病院", where: "facility_type = 'Hospital'", ...MED_OWN },
    { key: "clinic", icon: "🩺", en: "Clinic", ja: "診療所", where: "facility_type = 'Clinic'", ...MED_OWN },
    { key: "dental", icon: "🦷", en: "Dental clinic", ja: "歯科", where: "facility_type = 'Dental'", ...MED_OWN },
    { key: "pharmacy", icon: "💊", en: "Pharmacy", ja: "薬局", where: "facility_type = 'Pharmacy'", ...MED_OWN },
    { key: "multilingual", icon: "🌟", en: "Medical facility with foreign-language support", ja: "外国語対応の医療機関", where: "multilingual = 1", ...MED_OWN },
    { key: "shelter", icon: "🛡️", en: "Emergency shelter", ja: "避難所", layer: "shelters", name: (a) => a.P20_002 },
    { key: "police", icon: "👮", en: "Police box / station", ja: "交番・警察署", layer: "police", name: (a) => a.P18_001 },
    { key: "post", icon: "✉️", en: "Post office", ja: "郵便局", layer: "post", name: (a) => a.P30_005 },
    { key: "office", icon: "🏛️", en: "Town / city office", ja: "役場・市役所", layer: "municipal", name: (a) => a.P05_003 },
    { key: "school", icon: "🏫", en: "School", ja: "学校", layer: "schools", name: (a, L) => (L === "JA" ? a.P29_004 : a.name_en || a.P29_004) },
    { key: "station", icon: "🚉", en: "Train station", ja: "駅", layer: "railStations", name: (a, L) => (L === "JA" || !a.station_en ? `${a.N02_005}駅` : `${a.station_en} Station`) },
    { key: "bus", icon: "🚌", en: "Bus stop", ja: "バス停", layer: "bus", name: (a) => a.P11_001 },
    { key: "roadside", icon: "🚗", en: "Michi-no-Eki (roadside station)", ja: "道の駅", layer: "roadside", name: (a, L) => (L === "JA" ? a.P35_006 : a.name_en || a.P35_006) },
    { key: "gas", icon: "⛽", en: "Gas station", ja: "ガソリンスタンド", layer: "gas", name: (a, L) => tr(L, "Gas station", "ガソリンスタンド"), detail: (a) => a.P07_002 || "" }
];

let nearest = { cat: "hospital", origin: null, source: null, results: [], status: "" }; // source: "locate" | "pick"
let locating = false; // waiting for the browser's location answer

// Which start-point button is lit: the one being waited on, otherwise the one the current results came from.
const nearestActive = () => (pickingOrigin ? "pick" : locating ? "locate" : nearest.origin ? nearest.source : null);
function syncNearestButtons() {
    const active = nearestActive();
    panelEl?.querySelectorAll("[data-nearest='locate'], [data-nearest='pick']").forEach((b) => {
        const on = b.dataset.nearest === active;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", String(on));
    });
}

const escHtml = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function distanceKm(lat1, lon1, lat2, lon2) {
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(a));
}
const formatDistance = (km) => (km < 1 ? `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m` : `${km.toFixed(1)} km`);

async function findNearest(cat, origin) {
    const layer = layers[cat.layer];
    const clauses = [cat.own ? "" : layer.definitionExpression, cat.where].filter(Boolean).map((w) => `(${w})`);
    for (const km of SEARCH_STEPS_KM) {
        const q = layer.createQuery();
        q.geometry = { type: "point", longitude: origin.lon, latitude: origin.lat };
        q.distance = km;
        q.units = "kilometers";
        q.spatialRelationship = "intersects";
        q.where = clauses.join(" AND ") || "1=1";
        q.outFields = ["*"];
        q.returnGeometry = true;
        q.outSpatialReference = { wkid: 4326 };
        const { features } = await layer.queryFeatures(q);
        const seen = new Set();
        const list = [];
        for (const f of features) {
            const g = f.geometry;
            if (!g || g.latitude === undefined) continue;
            const name = String(cat.name(f.attributes, "EN") ?? "");
            const key = `${name}|${g.latitude.toFixed(3)}|${g.longitude.toFixed(3)}`; // same place listed twice (e.g. a station on two lines)
            if (seen.has(key)) continue;
            seen.add(key);
            list.push({ feature: f, lat: g.latitude, lon: g.longitude, km: distanceKm(origin.lat, origin.lon, g.latitude, g.longitude) });
        }
        list.sort((a, b) => a.km - b.km);
        if (list.length >= RESULT_COUNT || km === SEARCH_STEPS_KM[SEARCH_STEPS_KM.length - 1]) return list.slice(0, RESULT_COUNT);
    }
    return [];
}

function nearestResultsHtml(L) {
    const cat = NEAREST.find((c) => c.key === nearest.cat) || NEAREST[0];
    let html = "";
    if (nearest.status) html += `<div class="fh-note">${escHtml(nearest.status)}</div>`;
    nearest.results.forEach((r, i) => {
        const a = r.feature.attributes;
        const name = cat.name(a, L) || "—";
        const detail = cat.detail?.(a, L) || "";
        const o = nearest.origin;
        const dir = `https://www.google.com/maps/dir/?api=1${o ? `&origin=${o.lat},${o.lon}` : ""}&destination=${r.lat},${r.lon}&hl=${L === "JA" ? "ja" : "en"}`;
        html += `
        <div class="fh-result">
            <span class="fh-result-num">${i + 1}</span>
            <div class="fh-result-body">
                <b>${escHtml(name)}</b>
                <div class="fh-result-meta">${formatDistance(r.km)}${detail ? ` · ${escHtml(detail)}` : ""}</div>
                <div class="fh-result-links">
                    <button type="button" class="fh-linkbtn" data-nearest-go="${i}">${tr(L, "Show on map", "地図で見る")}</button> ·
                    <a href="${dir}" target="_blank" rel="noopener noreferrer">🧭 ${tr(L, "Directions", "経路")}</a>
                </div>
            </div>
        </div>`;
    });
    if (nearest.results.length) {
        html += `<div class="fh-note">${tr(L, "Straight-line distances. Real travel time is longer, especially in winter.", "直線距離です。実際の移動時間は、特に冬は長くなります。")}</div>
        <button type="button" class="fh-linkbtn" data-nearest="clear">${tr(L, "Clear", "クリア")}</button>`;
    }
    return html;
}

function renderNearest() {
    const box = panelEl?.querySelector("#nearest-results");
    if (box) box.innerHTML = nearestResultsHtml(currentLang);
    syncNearestButtons();
    syncChip();
}

function drawNearest() {
    if (!nearestGfx) return;
    nearestGfx.removeAll();
    const { Graphic } = esri;
    const o = nearest.origin;
    if (o) {
        nearestGfx.add(new Graphic({
            geometry: { type: "point", longitude: o.lon, latitude: o.lat },
            symbol: { type: "simple-marker", style: "circle", color: [0, 90, 200, 1], size: 14, outline: { color: [255, 255, 255, 1], width: 2.5 } }
        }));
    }
    nearest.results.forEach((r, i) => {
        const geometry = { type: "point", longitude: r.lon, latitude: r.lat };
        nearestGfx.add(new Graphic({ geometry, symbol: { type: "simple-marker", style: "circle", color: [213, 94, 0, 1], size: 22, outline: { color: [255, 255, 255, 1], width: 2 } } }));
        nearestGfx.add(new Graphic({ geometry, symbol: { type: "text", text: String(i + 1), color: [255, 255, 255, 1], font: { size: 11, weight: "bold" }, yoffset: -2.5 } }));
    });
}

async function runNearest() {
    const L = currentLang;
    const cat = NEAREST.find((c) => c.key === nearest.cat) || NEAREST[0];
    nearest.results = [];
    nearest.status = tr(L, "Searching…", "検索中…");
    renderNearest();
    try {
        nearest.results = await findNearest(cat, nearest.origin);
        nearest.status = nearest.results.length ? "" : tr(L, `Nothing found within ${SEARCH_STEPS_KM[SEARCH_STEPS_KM.length - 1]} km.`, `${SEARCH_STEPS_KM[SEARCH_STEPS_KM.length - 1]} km以内に見つかりませんでした。`);
    } catch (e) {
        console.warn("Nearest search failed:", e);
        nearest.status = tr(L, "The search failed. Please try again.", "検索に失敗しました。もう一度お試しください。");
    }
    drawNearest();
    renderNearest();
    fitNearest();
    // On phones the panel would cover the markers: close it and let the chip bring the list back.
    if (isMobile() && nearest.results.length) setPanelOpen(false);
    syncChip();
}

const isMobile = () => window.matchMedia(MOBILE_QUERY).matches;

// Zoom to the start point and all results with some breathing room.
function fitNearest() {
    const pts = [...(nearest.origin ? [{ lon: nearest.origin.lon, lat: nearest.origin.lat }] : []), ...nearest.results];
    if (!pts.length) return;
    const lons = pts.map((p) => p.lon), lats = pts.map((p) => p.lat);
    const pad = 0.0015; // ~150 m, so a single point still gets a sensible extent
    const ext = new esri.Graphic({ geometry: { type: "extent", xmin: Math.min(...lons) - pad, ymin: Math.min(...lats) - pad, xmax: Math.max(...lons) + pad, ymax: Math.max(...lats) + pad, spatialReference: { wkid: 4326 } } }).geometry;
    view.goTo(ext.expand(1.6), { duration: 1000 }).catch(() => {});
}

// Floating "3 nearest" chip: shown on phones while results exist, the panel is closed and no popup is open.
let chipEl = null;
function syncChip() {
    const show = view?.container && isMobile() && nearest.results.length && !panelOpen && !view.popup?.visible && !pickingOrigin;
    if (!show) { chipEl?.remove(); chipEl = null; return; }
    const cat = NEAREST.find((c) => c.key === nearest.cat) || NEAREST[0];
    const L = currentLang;
    const label = tr(L, `${cat.icon} ${nearest.results.length} nearest · tap for list`, `${cat.icon} 近くの${cat.ja} ${nearest.results.length}件 · タップで一覧`);
    if (!chipEl) {
        chipEl = document.createElement("button");
        chipEl.type = "button";
        chipEl.className = "fh-chip";
        chipEl.addEventListener("click", () => {
            setPanelOpen(true);
            panelEl?.querySelector("#nearest-results")?.scrollIntoView({ block: "center" });
        });
        view.container.appendChild(chipEl);
    }
    chipEl.textContent = label;
}

function setNearestOrigin(lon, lat, source) {
    nearest.origin = { lon, lat };
    nearest.source = source;
    runNearest();
}

function useMyLocation() {
    const L = currentLang;
    if (!navigator.geolocation) { nearest.status = tr(L, "Your browser can't share a location. Try \"Pick on map\".", "位置情報を取得できません。「地図で選ぶ」をお試しください。"); renderNearest(); return; }
    nearest.status = tr(L, "Finding your location…", "現在地を取得中…");
    locating = true;
    pickingOrigin = false;
    hideToast();
    renderNearest();
    navigator.geolocation.getCurrentPosition(
        (pos) => { locating = false; setNearestOrigin(pos.coords.longitude, pos.coords.latitude, "locate"); },
        () => { locating = false; nearest.status = tr(currentLang, "Couldn't get your location. Check the location permission, or try \"Pick on map\".", "現在地を取得できませんでした。位置情報の許可を確認するか、「地図で選ぶ」をお試しください。"); renderNearest(); },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
}

function showToast(text, onCancel) {
    hideToast();
    toastEl = el("div", { style: "position:absolute;top:12px;left:50%;transform:translateX(-50%);z-index:60;background:#111827;color:#fff;padding:8px 8px 8px 14px;border-radius:999px;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;gap:10px;align-items:center;max-width:90%" },
        el("span", { textContent: text }),
        el("button", { type: "button", textContent: "✕", "aria-label": "Cancel", style: "background:transparent;border:0;color:#fff;font-size:15px;cursor:pointer", onclick: () => { pickingOrigin = false; hideToast(); syncNearestButtons(); } }));
    view.container.appendChild(toastEl);
}
function hideToast() { toastEl?.remove(); toastEl = null; }

function startPick() {
    pickingOrigin = true;
    locating = false;
    syncNearestButtons();
    showToast(tr(currentLang, "Tap the map to set your starting point", "地図をタップして出発地点を選択"));
    if (window.matchMedia(MOBILE_QUERY).matches) setPanelOpen(false);
}

function showNearestResult(i) {
    const r = nearest.results[i];
    if (!r) return;
    if (window.matchMedia(MOBILE_QUERY).matches) setPanelOpen(false);
    view.goTo({ center: [r.lon, r.lat], zoom: 15 }, { duration: 900 })
        .catch(() => {})
        .then(() => view.openPopup({ features: [r.feature], location: r.feature.geometry }))
        .catch(() => {});
}

function clearNearest() {
    pickingOrigin = false;
    locating = false;
    hideToast();
    nearest = { ...nearest, origin: null, source: null, results: [], status: "" };
    nearestGfx?.removeAll();
    renderPanel();
    syncChip();
}

/* ==========================================================================
   ABOUT & DATA SOURCES (opened from the link at the bottom of the control panel)
   ========================================================================== */

const KSJ = (code, tail) => `https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-${code}${tail ? `-${tail}` : ""}.html`;
// [layers EN, layers JA, dataset code, edition, url]
const MLIT_SOURCES = [
    ["Municipal and subprefecture boundaries", "市区町村・振興局の境界", "N03", "2026", KSJ("N03", "2026")],
    ["Municipal offices & public meeting facilities", "市町村役場等及び公的集会施設", "P05", "2022", KSJ("P05", "2022")],
    ["Police stations & boxes", "警察署・交番", "P18", "2012", KSJ("P18")],
    ["Post offices", "郵便局", "P30", "2013", KSJ("P30")],
    ["Schools", "学校", "P29", "2023", KSJ("P29", "2023")],
    ["Roadside stations (Michi-no-Eki)", "道の駅", "P35", "2018", KSJ("P35")],
    ["Bus stops", "バス停留所", "P11", "2022", KSJ("P11", "2022")],
    ["Gas stations", "燃料給油所", "P07", "2010", KSJ("P07", "2016")],
    ["Emergency shelters", "避難施設", "P20", "2012", KSJ("P20")],
    ["Snowfall statistics & snow-damage zones", "雪害指定区分・積雪統計", "A22-m", "2014", KSJ("A22", "m")],
    ["Wildlife protection areas", "鳥獣保護区", "A15", "2015", KSJ("A15")],
    ["Railway lines & stations", "鉄道（路線・駅）", "N02", "2025", KSJ("N02", "2025")]
];
let aboutEl = null;

function closeAbout() {
    aboutEl?.remove();
    aboutEl = null;
    document.removeEventListener("keydown", onAboutKey);
}
function onAboutKey(e) { if (e.key === "Escape") closeAbout(); }

function openAbout() {
    const L = currentLang;
    const a = (url, label) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    const html = `
        <div class="fh-about-head"><h2 id="fh-about-title">${tr(L, "About & data sources", "このアプリについて・データの出典")}</h2><button type="button" class="fh-about-close" aria-label="${tr(L, "Close", "閉じる")}">✕</button></div>
        <p>${tr(L,
            "ForeignHokkaido is a bilingual map for foreign Assistant Language Teachers living in the Oshima and Hiyama subprefectures of Hokkaido. It was built as a University of Wisconsin–Madison Geography 778 practicum project by H. McBride in the Fall 2026 semester.",
            "ForeignHokkaido は、北海道の渡島・檜山地域に住む外国人ALT向けの日英対応マップです。ウィスコンシン大学マディソン校 地理学778の実習プロジェクトとして、H. McBride が2026年秋学期に制作しました。")}</p>

        <h3>${tr(L, "Japan National Land Numerical Information (MLIT)", "国土数値情報（国土交通省）")}</h3>
        <p class="fh-about-note">${tr(L,
            "Source: MLIT National Land Numerical Information Download Site (links below). Each layer was edited and processed (clipped to the study area, joined, translated) by ForeignHokkaido from the dataset named in the list. It is not an official MLIT product. Edition years come from the downloaded files and some are several years old.",
            "出典：国土交通省国土数値情報ダウンロードサイト（下記各ページ）。以下の「国土数値情報」（国土交通省）をもとに、ForeignHokkaidoが編集・加工（範囲の切り出し・結合・英訳）して作成しました。国土交通省が作成した情報ではありません。年は取得したファイルの版で、数年前のものもあります。")}</p>
        <ul class="fh-about-list">${MLIT_SOURCES.map(([en, ja, code, year, url]) =>
            `<li>${a(url, tr(L, en, ja))} <span class="fh-about-code">${code}${year ? ` · ${year}` : ""}</span></li>`).join("")}</ul>

        <h3>${tr(L, "Other sources", "その他の出典")}</h3>
        <ul class="fh-about-list">
            <li><b>${tr(L, "Landslide & avalanche risk areas", "山地災害危険地区（地すべり・雪崩）")}</b>: ${tr(L,
                "Hokkaido Forestry Bureau, Soil Conservation Division, Mountain Disaster Hazard Area GIS data (end of 2020), CC BY 4.0. Clipped to the study area by ForeignHokkaido. ",
                "北海道水産林務部林務局治山課「山地災害危険地区 GISデータ」（2020年末時点）、CC BY 4.0。調査範囲に合わせてForeignHokkaidoが切り出し。")}${a("https://ckan.hoda.jp/dataset/sanchisaigaikikenchiku_hokkaido", tr(L, "Dataset ↗", "データセット ↗"))}</li>
            <li><b>${tr(L, "Medical facilities", "医療機関")}</b>: ${tr(L,
                "Based on \"Hokkaido Medical Institutions List with Coordinates\" (道内医療機関一覧（位置情報付き）, data as of Feb 9, 2026), published by the Hokkaido Government DX Promotion Division on the Hokkaido Open Data Portal under CC BY, which adds coordinates to the Hokkaido Bureau of Health and Welfare (MHLW) medical institution list. Filtered to Oshima and Hiyama and matched with the Hokkaido list of facilities with foreign-language support by ForeignHokkaido. It may include closed or moved facilities. Check opening hours and language support by phone. ",
                "北海道「道内医療機関一覧（位置情報付き）」（2026年2月9日現在、北海道経済部DX推進課、北海道オープンデータポータル、CC BY）をもとに作成。元データは厚生労働省北海道厚生局の医療機関一覧に位置情報を付与したものです。ForeignHokkaidoが渡島・檜山地域に絞り込み、北海道の外国語対応可能医療機関一覧と照合しました。閉院・移転した施設が含まれる場合があります。診療時間や対応言語は電話でご確認ください。")}${a("https://www.harp.lg.jp/opendata/dataset/1243.html", tr(L, "Dataset page ↗", "データセット ↗"))} ${a("https://www.pref.hokkaido.lg.jp/fs/1/0/7/7/4/3/0/4/_/iryoukikanenglish.pdf", tr(L, "Foreign-language list (PDF) ↗", "外国語対応リスト（PDF） ↗"))}</li>
            <li><b>${tr(L, "Garbage rules", "ごみ分別")}</b>: ${tr(L,
                "Each town's official website, checked November 2026. Rules change, so confirm with your town office or supervisor.",
                "各自治体の公式サイト（2026年11月確認）。ルールは変更されることがあるため、役場や担当者にご確認ください。")}</li>
            <li><b>${tr(L, "Ski areas", "スキー場")}</b>: ${tr(L,
                "Compiled by ForeignHokkaido from town and resort websites. Each popup shows how well an entry was checked; some positions are approximate.",
                "自治体・施設の公開情報をもとにForeignHokkaidoが作成。各ポップアップに確認状況を表示しており、位置が目安のものもあります。")}</li>
            <li><b>${tr(L, "Community events & local interests", "コミュニティイベント・地域のおすすめ")}</b>: ${tr(L,
                "Submitted by users through Esri Survey123. They are not verified.",
                "ユーザーが Esri Survey123 で投稿した情報です。内容は確認されていません。")}</li>
            <li><b>${tr(L, "Basemaps", "ベースマップ")}</b>: Esri, ${tr(L, "with the contributors listed at the bottom of the map.", "ほか、地図下部に表示のデータ提供者。")}</li>
        </ul>

        <h3>${tr(L, "Please note", "ご注意")}</h3>
        <p class="fh-about-note">${tr(L,
            "This map is a guide, not an official source. Locations and details can be out of date: please confirm with the facility or your town office before you rely on them, especially for emergencies. Straight-line distances are not travel times.",
            "このマップは参考情報であり、公式情報ではありません。位置や内容が古い場合があります。特に緊急時は、利用前に施設や役場でご確認ください。距離は直線距離で、移動時間ではありません。")}</p>
        <p>${a(FORM_LINKS.report, tr(L, "Report an error or add a place ↗", "誤りの報告・場所の追加 ↗"))}</p>`;
    closeAbout();
    aboutEl = el("div", { className: "fh-about-overlay" });
    const card = el("div", { className: "fh-about", role: "dialog" });
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-labelledby", "fh-about-title");
    card.innerHTML = html;
    aboutEl.append(card);
    aboutEl.addEventListener("click", (e) => { if (e.target === aboutEl || e.target.closest(".fh-about-close")) closeAbout(); });
    document.addEventListener("keydown", onAboutKey);
    document.body.append(aboutEl);
    card.querySelector(".fh-about-close").focus();
}

export function setPanelOpen(open) {
    panelOpen = open;
    if (!panelEl) return;
    if (!open) panelEl.scrollTop = 0; // reopen at the top (the tour scrolls the panel)
    panelEl.hidden = !open;
    toggleBtn.classList.toggle("is-open", open);
    toggleBtn.setAttribute("aria-expanded", String(open));
    syncChip();
}

function buildControls() {
    toggleBtn = document.createElement("button");
    toggleBtn.id = "controlPanelCustomBtn";
    toggleBtn.type = "button";
    toggleBtn.className = "esri-widget esri-widget--button";
    toggleBtn.setAttribute("aria-controls", "controlPanelDiv");

    panelEl = document.createElement("div");
    panelEl.id = "controlPanelDiv";
    panelEl.className = "fh-panel";

    const container = document.createElement("div");
    container.className = "fh-controls";
    container.append(toggleBtn, panelEl);

    toggleBtn.addEventListener("click", () => setPanelOpen(!panelOpen));
    panelEl.addEventListener("click", (e) => {
        const btn = e.target.closest?.("[data-nearest], [data-nearest-go], [data-about], [data-panel-close]");
        if (!btn) return;
        if (btn.dataset.about !== undefined) { openAbout(); return; }
        if (btn.dataset.panelClose !== undefined) { setPanelOpen(false); return; }
        if (btn.dataset.nearest === "locate") useMyLocation();
        else if (btn.dataset.nearest === "pick") startPick();
        else if (btn.dataset.nearest === "clear") clearNearest();
        else if (btn.dataset.nearestGo !== undefined) showNearestResult(Number(btn.dataset.nearestGo));
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && panelOpen) setPanelOpen(false); });
    panelEl.addEventListener("change", (e) => {
        const el = e.target;
        if (el.dataset?.layer) layers[el.dataset.layer].visible = el.checked;
        else if (el.id === "medical-multi") setMedicalMultiOnly(el.checked);
        else if (el.id === "nearest-cat") { nearest.cat = el.value; if (nearest.origin) runNearest(); else renderNearest(); }
        else if (el.id === "muni-filter-select") applyMuniFilter(el.value);
        else if (el.id === "trash-filter-select") {
            showTrash(el.value);
            if (el.value !== "ALL" && isMobile()) setPanelOpen(false); // on phones the panel would cover the garbage popup
        }
    });

    renderPanel();
    setPanelOpen(false);
    return container;
}

/* ==========================================================================
   BASEMAP, LOCALE, SEASON, LANGUAGE
   ========================================================================== */

function applyBasemap() {
    if (!map) return;
    const id = currentSeason === "winter" ? "arcgis/light-gray" : "arcgis/topographic";
    const language = currentLang === "JA" ? "ja" : "en";
    if (basemapKey === id + language) return;
    basemapKey = id + language;
    const plain = currentSeason === "winter" ? "arcgis-light-gray" : "arcgis-topographic";
    const useFallback = (why) => {
        console.warn("[basemap] localized style failed, using the default style instead:", why?.message || why);
        if (basemapKey === id + language) map.basemap = plain;
    };
    try {
        // Basemap `style` support depends on the SDK build, and failures are asynchronous,
        // so load it and fall back to the plain named basemap if anything goes wrong.
        const basemap = new esri.Basemap({ style: { id, language } });
        map.basemap = basemap;
        basemap.load()
            .then(() => { if (!basemap.baseLayers.length) useFallback("this SDK version ignores Basemap.style (needs 4.27+)"); })
            .catch(useFallback);
    } catch (err) {
        useFallback(err);
    }
}

function applyLocale() {
    try { esri.intl.setLocale(currentLang === "JA" ? "ja" : "en"); }
    catch (err) { console.warn("Could not change SDK locale:", err); }
}

function refreshOpenPopup() {
    const popup = view?.popup;
    if (!popup?.visible || !popup.selectedFeature) return;
    const { selectedFeature, location } = popup;
    view.closePopup();
    view.openPopup({ features: [selectedFeature], location });
}

export function setSeason(season) {
    currentSeason = season === "winter" ? "winter" : "summer";
    const next = currentSeason;
    const prev = next === "winter" ? "summer" : "winter";
    SEASON_LAYERS[prev].filter((k) => !SEASON_LAYERS[next].includes(k)).forEach((k) => { if (layers[k]) layers[k].visible = false; });
    SEASON_LAYERS[next].forEach((k) => { if (layers[k]) layers[k].visible = true; });
    applyBasemap();
    emit();
}

export function setLanguage(lang) {
    currentLang = lang === "JA" ? "JA" : "EN";
    store.set("fh-lang", currentLang);
    document.documentElement.lang = currentLang === "JA" ? "ja" : "en";
    if (view) {
        applyLocale();
        applyBasemap();
        SPECS.forEach((s) => { layers[s.key].title = t(s.labelKey, currentLang); relabelLegend(s.key); const c = creditFor(s.key, currentLang); if (c) layers[s.key].copyright = c; applyPopup(s); });
        renderPanel();
        setPanelOpen(panelOpen);
        refreshOpenPopup();
        if (aboutEl) openAbout(); // keep an open About card in the new language
    }
    emit();
    return currentLang;
}

export function resetView() {
    if (!view) return;
    muniFilter = "ALL";
    trashTown = "ALL";
    showTrash("ALL");
    setMedicalMultiOnly(false);
    clearNearest();
    view.closePopup();
    // Back to the default layers for the current season (undoes any layers the user switched on or off)
    SPECS.forEach((s) => { if (layers[s.key]) layers[s.key].visible = isBaseline(s.key, currentSeason); });
    applyMuniFilter("ALL");
    renderPanel();
}

/* ==========================================================================
   INIT
   ========================================================================== */

export async function initMap(containerId, apiKey) {
    const [
        esriConfig, intl, EsriMap, MapView, FeatureLayer, GeoJSONLayer,
        Basemap, geometryEngine, Legend, Expand, Zoom, Graphic, GraphicsLayer
    ] = await load([
        "esri/config", "esri/intl", "esri/Map", "esri/views/MapView",
        "esri/layers/FeatureLayer", "esri/layers/GeoJSONLayer", "esri/Basemap",
        "esri/geometry/geometryEngine", "esri/widgets/Legend", "esri/widgets/Expand", "esri/widgets/Zoom",
        "esri/Graphic", "esri/layers/GraphicsLayer"
    ]);
    esri = { intl, Basemap, FeatureLayer, GeoJSONLayer, geometryEngine, Graphic, GraphicsLayer };
    if (apiKey) esriConfig.apiKey = apiKey;

    document.documentElement.lang = currentLang === "JA" ? "ja" : "en";
    applyLocale();

    map = new EsriMap();
    applyBasemap();
    map.addMany([...SPECS].sort((a, b) => a.z - b.z).map(createLayer));
    watchLiveLayers();
    townGfx = new GraphicsLayer({ id: "townHighlight", listMode: "hide", title: "Selected town" });
    map.add(townGfx);
    nearestGfx = new GraphicsLayer({ id: "nearest", listMode: "hide", title: "Nearest" });
    map.add(nearestGfx);

    view = new MapView({
        container: containerId,
        map,
        center: homeView().center,
        zoom: homeView().zoom,
        ui: { components: ["attribution"] }
    });

    // Top-left stack: controls button + panel, zoom, (locate is added by location.js at index 2), legend
    view.ui.add(buildControls(), { position: "top-left", index: 0 });
    view.ui.add(new Zoom({ view }), { position: "top-left", index: 1 });
    const legendExpand = new Expand({ view, content: new Legend({ view }), expandIcon: "legend", group: "top-left" });
    view.ui.add(legendExpand, { position: "top-left", index: 3 });
    view.when(() => legendExpand.container?.setAttribute?.("id", "fh-legend")); // lets the app tour point at it

    // Responsive popup docking and bottom padding (the header ribbon sits at the bottom on mobile)
    const applyBreakpoint = (bp) => {
        const mobile = bp === "xsmall" || bp === "small";
        view.padding = { bottom: mobile ? 96 : 0 };
        view.ui.padding = { top: 15, left: 15, right: 15, bottom: 0 }; // default edge gaps, but no bottom gap: keeps the attribution at the very bottom, under the ribbon
        view.popup.dockEnabled = !mobile;
        view.popup.dockOptions = { buttonEnabled: false, breakpoint: false, position: "bottom-right" };
    };
    view.watch("scale", updateScaleHints);
    view.watch("popup.visible", syncChip); // path watch: works even while the popup is lazily created
    // Outline the town whose popup is showing; fall back to the filtered town (or nothing) otherwise.
    view.watch("popup.selectedFeature", async (f) => {
        const fallback = spatialFilter?.geometry ?? null;
        if (f?.layer?.id !== "muniBoundaries") { drawTownHighlight(fallback); return; }
        const ja = String(f.attributes?.N03_004 ?? "").trim();
        const geometry = (ja && (await townGeometry(ja).catch(() => null))) || f.geometry;
        if (view.popup.selectedFeature === f) drawTownHighlight(geometry);
    });
    view.watch("widthBreakpoint", applyBreakpoint);
    applyBreakpoint(view.widthBreakpoint);

    // "Pick on map" for the nearest-X tool: takes the next click and keeps it from opening a popup.
    view.on("click", (event) => {
        // Tapping a numbered result marker opens that place's popup (checked on screen so the default popup can be stopped in time).
        if (!pickingOrigin && nearest.results.length) {
            const hit = nearest.results.findIndex((r) => {
                const p = view.toScreen(new esri.Graphic({ geometry: { type: "point", longitude: r.lon, latitude: r.lat } }).geometry); // needs a real Point
                return p && Math.hypot(p.x - event.x, p.y - event.y) <= 16;
            });
            if (hit >= 0) {
                event.stopPropagation();
                const r = nearest.results[hit];
                view.openPopup({ features: [r.feature], location: r.feature.geometry });
                return;
            }
        }
        if (!pickingOrigin) return;
        event.stopPropagation();
        pickingOrigin = false;
        hideToast();
        setNearestOrigin(event.mapPoint.longitude, event.mapPoint.latitude, "pick");
        if (!isMobile()) setPanelOpen(true); // on phones the chip brings the list back after the search
    });

    // Clicking a municipality polygon (when it is the topmost feature) zooms to it.
    view.on("click", async (event) => {
        if (window.matchMedia(MOBILE_QUERY).matches) setPanelOpen(false);
        const { results } = await view.hitTest(event);
        const top = results.find((r) => r.graphic?.layer && !["townHighlight", "nearest"].includes(r.graphic.layer.id));
        if (top?.graphic.layer.id === "muniBoundaries" && top.graphic.geometry?.extent) {
            view.goTo(top.graphic.geometry.extent.expand(1.2), { duration: 1200, easing: "in-out-cubic" });
        }
    });

    view.on("layerview-create-error", (e) => console.warn(`[layerview] "${e.layer?.id}" could not be drawn:`, e.error?.message || e.error));

    window.__fh = { map, view }; // debugging handle: inspect in the console
    await view.when();
    return { map, view };
}