// map.js — ForeignHokkaido map engine
// ArcGIS Maps SDK 4.26 is loaded from the CDN <script> in index.html (AMD), so every
// SDK class is obtained through the global `require`, never through ES-module imports.

import { t, municipalities, districts, subprefectures } from "./localization.js";

/* ==========================================================================
   CONSTANTS & STATE
   ========================================================================== */

const HOME = { center: [140.3, 42.09], zoom: 7 };
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
            row(tr(L, "District / County", "郡"), X("district")) +
            row(tr(L, "JIS code", "全国地方公共団体コード"), X("jis"))
        ),
        expressionInfos: [
            E("name", muniNameBody(L, "N03_004")),
            E("sub", subBy((x) => tr(L, x.en, x.ja), "s")),
            E("district",
                `var d = ${NZ("N03_003", "")}; if (d == '') { return ${q(tr(L, "Independent city", "市部（郡に属さない）"))}; } ` +
                (L === "JA" ? "return d;" : `return ${DISTRICT_EN};`)),
            E("jis", `return ${NZ("N03_007")};`)
        ]
    }),

    trash: (L) => {
        const s = L === "JA" ? "_ja" : "";
        const section = (color, icon, label, daysExpr, notesExpr) =>
            `<div style="margin-bottom:8px"><b style="color:${color}">${icon} ${label}:</b><br>` +
            (daysExpr ? `🗓️ <b>${tr(L, "Days", "収集日")}:</b> ${X(daysExpr)}<br>` : "") +
            `ℹ️ <i style="color:#4b5563">${X(notesExpr)}</i></div>`;
        const field = (name, base, dflt = "—") => E(name, `return ${NZ(base + s, dflt)};`);
        return {
            title: `🗑️ ${X("muni")} ${tr(L, "Garbage & Recycling Guide", "ごみ・リサイクル分別ガイド")}`,
            content: [
                ...body(`<div style="background:#fef3c7;border:1px solid #fde68a;padding:7px 9px;border-radius:5px;margin-bottom:8px;color:#92400e"><b>${X("disc")}</b></div>`),
                custom((g) => {
                    const url = safeUrl(attr(g, "trash_url"));
                    const box = el("div", { style: `${BLOCK};background:#eff6ff;border:1px solid #bfdbfe;padding:8px 10px;border-radius:5px;margin-bottom:12px;text-align:center` });
                    if (url) box.append("🔗 ", linkEl(url, tr(L, "Official town website / PDF calendar ↗", "自治体サイト・PDFカレンダーを開く ↗")));
                    else box.hidden = true;
                    return box;
                }),
                ...body(section("#b91c1c", "🔥", tr(L, "Burnable waste", "燃やせるごみ"), "bd", "br") +
                section("#047857", "♻️", tr(L, "Plastics", "プラ容器包装"), "pd", "pr") +
                section("#1d4ed8", "🍾", tr(L, "Recyclables", "資源物"), "rd", "rr") +
                section("#6b21a8", "🛋️", tr(L, "Bulky waste", "粗大ごみ"), null, "bw"))
            ],
            expressionInfos: [
                E("muni", L === "JA"
                    ? `return ${NZ(TRASH_MUNI_FIELD)};`
                    : `var m = ${NZ(TRASH_MUNI_FIELD, "")}; if (m == '') { m = ${NZ("municipali", "—")}; } else { m = ${MUNI_EN}; } return m;`),
                E("disc", `return ${NZ("disclaimer" + s, tr(L,
                    "Collection rules vary by area. Check your town's official calendar.",
                    "収集ルールは地域により異なります。自治体の公式カレンダーをご確認ください。"))};`),
                field("bd", "burnable_s"), field("br", "burnable_r"),
                field("pd", "plastic_sc"), field("pr", "plastic_ru"),
                field("rd", "recyclab_1"), field("rr", "recyclable"),
                field("bw", "bulky_wast")
            ]
        };
    },

    municipal: (L) => ({
        title: `🏛️ ${X("name")}`,
        content: body(
            `<b>${tr(L, "What you can do here", "主な利用目的")}:</b><p style="margin:4px 0 8px">${X("desc")}</p>` +
            row(tr(L, "Address", "所在地"), X("addr")) + addrNote(L)
        ),
        expressionInfos: [
            E("name", byCode("P05_002", [
                ["1", tr(L, "Town / City Hall", "役場・市役所")],
                ["2", tr(L, "Branch & Liaison Office", "支所・出張所")],
                ["4", tr(L, "Public Community Center", "公立公民館")]
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
            `else if (c == '1') { k = 'hq'; } else if (c == '3') { k = 'branch'; } ` +
            `else if (Find('警察署', raw) > -1 || c == '2') { k = 'station'; } `;
        const pick = (pairs, dflt) => `${kind} return ${decodePairs("k", pairs, q(dflt))};`;
        return {
            title: `👮 ${X("title")}`,
            content: body(
                row(tr(L, "Name", "名称"), X("name")) +
                `<b>${tr(L, "What you can do here", "主な利用目的")}:</b><p style="margin:4px 0 8px">${X("desc")}</p>` +
                row(tr(L, "Address", "所在地"), X("addr")) + addrNote(L)
            ),
            expressionInfos: [
                E("title", pick([
                    ["hq", tr(L, "Prefectural Police Headquarters", "北海道警察本部")],
                    ["station", tr(L, "Police Station", "警察署")],
                    ["branch", tr(L, "Police Sub-station", "分庁舎")],
                    ["koban", tr(L, "Police Box (Koban)", "交番")],
                    ["chuzai", tr(L, "Residential Police Box (Chuzaisho)", "駐在所")]
                ], tr(L, "Police Facility", "警察施設"))),
                E("desc", pick([
                    ["koban", tr(L,
                        "Urban police box (Koban). Report lost or found items, ask for directions, or get immediate local emergency help.",
                        "街頭の警察拠点（交番）です。道案内、落とし物の届出、緊急時の初期対応を行います。")],
                    ["chuzai", tr(L,
                        "Rural police box (Chuzaisho) where a resident officer lives and patrols. Go here for lost and found, community safety concerns or neighborhood emergencies.",
                        "地域密着型の駐在所です。防犯巡回、道案内、落とし物の届出、緊急時の初期対応を行います。")],
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
        content: body(row(tr(L, "Type", "種別"), X("type")) + row(tr(L, "Address", "所在地"), X("addr")) + addrNote(L)),
        expressionInfos: [
            E("name", `return ${NZ("P30_005", tr(L, "Post Office", "郵便局"))};`),
            E("type", byCode("P30_004", [
                ["18004", tr(L, "Simple Post Office (簡易郵便局)", "簡易郵便局")],
                ["18006", tr(L, "Direct-managed Post Office (直営郵便局)", "直営郵便局")]
            ], tr(L, "Post Office", "郵便局"))),
            E("addr", `return ${NZ("P30_006")};`)
        ]
    }),

    schools: (L) => ({
        title: `🏫 ${X("name")}`,
        content: body(row(tr(L, "Level", "校種"), X("type")) + row(tr(L, "Address", "所在地"), X("addr")) + addrNote(L)),
        expressionInfos: [
            E("name", `return ${NZ("P29_004")};`),
            E("type", byCode("P29_003", [
                ["16001", tr(L, "Elementary School (小学校)", "小学校")],
                ["16002", tr(L, "Junior High School (中学校)", "中学校")],
                ["16004", tr(L, "High School (高等学校)", "高等学校")],
                ["16005", tr(L, "College of Technology (高専)", "高等専門学校")],
                ["16007", tr(L, "University (大学)", "大学")],
                ["16011", tr(L, "Kindergarten (幼稚園)", "幼稚園")],
                ["16012", tr(L, "Special Needs School (特別支援学校)", "特別支援学校")]
            ], tr(L, "Educational Facility", "教育施設"))),
            E("addr", `return ${NZ("P29_005")};`)
        ]
    }),

    roadside: (L) => ({
        title: `🚗 ${tr(L, "Michi-no-Eki", "道の駅")}: ${X("name")}`,
        content: [...body(
            row(tr(L, "Municipality", "市町村"), X("muni")) +
            `<b>${tr(L, "Available amenities", "設備・サービス")}:</b><br>` +
            `• 🏪 ${tr(L, "Shops", "売店")}: ${X("shop")}<br>` +
            `• 🍱 ${tr(L, "Restaurant / café", "飲食")}: ${X("food")}<br>` +
            `• ♨️ ${tr(L, "Hot spring", "温泉")}: ${X("onsen")}<br>` +
            `• 🛜 ${tr(L, "Public Wi-Fi", "公衆Wi-Fi")}: ${X("wifi")}<br>` +
            `• ⚡ ${tr(L, "EV charging", "EV充電")}: ${X("ev")}<br>` +
            `• 🏧 ATM: ${X("atm")}`
        ), custom((g) => {
            const url = safeUrl(attr(g, "P35_007"));
            const box = el("div", { style: `${BLOCK};margin-top:6px` });
            if (url) box.append(labeled(tr(L, "Website", "公式サイト"), linkEl(url, tr(L, "Visit official page", "公式ページを開く"))));
            else box.hidden = true;
            return box;
        })],
        expressionInfos: [
            E("name", `return ${NZ("P35_006")};`),
            E("muni", `return ${NZ("P35_004")};`),
            E("shop", yesNo(L, "P35_028")),
            E("food", yesNo(L, "P35_013", "P35_014")),
            E("onsen", yesNo(L, "P35_016")),
            E("wifi", yesNo(L, "P35_023")),
            E("ev", yesNo(L, "P35_022")),
            E("atm", yesNo(L, "P35_011"))
        ]
    }),

    shelters: (L) => {
        const flag = (name, field) => E(name,
            `if (on(${G(field)})) { return ${q(tr(L, "✅ Designated", "✅ 対応"))}; } return ${q(tr(L, "❌ Not designated", "❌ 非対応"))};`);
        return {
            title: `🛡️ ${X("name")}`,
            content: body(
                row(tr(L, "Facility type", "施設種別"), X("type")) +
                row(tr(L, "Address", "所在地"), X("addr")) +
                row(tr(L, "Capacity", "想定収容人数"), X("cap")) +
                HR + `<b>${tr(L, "Designated for", "指定災害種別")}:</b><br>` +
                `• 🏚️ ${tr(L, "Earthquake", "地震")}: ${X("eq")}<br>` +
                `• 🌊 ${tr(L, "Tsunami", "津波")}: ${X("tsu")}<br>` +
                `• 🌧️ ${tr(L, "Flood / storm surge", "洪水・高潮")}: ${X("fld")}<br>` +
                `• 🌋 ${tr(L, "Volcanic activity", "火山現象")}: ${X("vol")}<br>` +
                `• ⛰️ ${tr(L, "Landslide / mudflow", "土砂災害")}: ${X("ls")}`
            ),
            expressionInfos: [
                E("name", `return ${NZ("P20_002")};`),
                E("type", `return ${NZ("P20_004")};`),
                E("addr", `return ${NZ("P20_003")};`),
                E("cap", `var c = num(${G("P20_005")}); if (IsEmpty(c) || c <= 0) { return ${q(tr(L, "Unspecified", "未定・記載なし"))}; } return Text(c, '#,###') + ${q(tr(L, " persons", " 人"))};`),
                flag("eq", "P20_007"), flag("tsu", "P20_008"), flag("fld", "P20_009"),
                flag("vol", "P20_010"), flag("ls", "P20_011")
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
                row(tr(L, "Snow designation", "雪害指定区分"), X("cls")) +
                note(X("clsDesc")) + HR +
                `<b>${tr(L, "Climate averages", "気候平均値")}:</b>` +
                `<ul style="margin:4px 0 0 18px;padding:0"><li>${tr(L, "Avg. minimum temperature", "平均最低気温")}: ${X("temp")}</li>` +
                `<li>${tr(L, "Avg. total snowfall", "平均年間降雪量")}: ${X("snow")}</li>` +
                `<li>${tr(L, "Avg. maximum snow depth", "平均最大積雪深")}: ${X("depth")}</li></ul>`
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
        title: `🚉 ${L === "JA" ? "{N02_005}駅" : "{N02_005} Station"}`,
        content: body(
            row(tr(L, "Station", "駅名"), `{N02_005}${L === "JA" ? "駅" : ""}`) +
            row(tr(L, "Line", "路線名"), X("line")) +
            row(tr(L, "Operator", "運行会社"), X("operator")) +
            row(tr(L, "Service type", "種別"), X("service"))
        ),
        expressionInfos: [
            E("line", L === "JA" ? `return ${NZ("N02_003")};` : `var l = ${NZ("N02_003", "")}; return ${decodePairs("l", LINE_PAIRS)};`),
            E("operator", L === "JA" ? `return ${NZ("N02_004")};` : `var o = ${NZ("N02_004", "")}; return ${decodePairs("o", OPERATOR_PAIRS)};`),
            E("service",
                `var l = ${NZ("N02_003", "")}; var o = ${NZ("N02_004", "")}; ` +
                `if (l == '北海道新幹線') { return ${q(tr(L, "🚅 High-speed Shinkansen", "🚅 新幹線"))}; } ` +
                `if (o == '函館市企業局交通部') { return ${q(tr(L, "🚃 City tram", "🚃 市電"))}; } ` +
                `return ${q(tr(L, "🚆 Local / regional train", "🚆 在来線・ローカル線"))};`)
        ]
    }),

    railLines: (L) => ({
        title: `🚆 ${X("line")}`,
        content: body(row(tr(L, "Line", "路線名"), X("line")) + row(tr(L, "Operator", "運行会社"), X("operator"))),
        expressionInfos: [
            E("line", L === "JA" ? `return ${NZ("N02_003")};` : `var l = ${NZ("N02_003", "")}; if (l == '') { return '—'; } return ${decodePairs("l", LINE_PAIRS)};`),
            E("operator", L === "JA" ? `return ${NZ("N02_004")};` : `var o = ${NZ("N02_004", "")}; if (o == '') { return '—'; } return ${decodePairs("o", OPERATOR_PAIRS)};`)
        ]
    }),

    medical: (L) => {
        // Longer department names first so "整形外科" is not clipped by "外科".
        const DEPTS = [
            ["小児歯科", "Pediatric Dentistry"], ["矯正歯科", "Orthodontics"], ["口腔外科", "Oral Surgery"],
            ["整形外科", "Orthopedic Surgery"], ["脳神経外科", "Neurosurgery"], ["心臓血管外科", "Cardiovascular Surgery"],
            ["形成外科", "Plastic Surgery"], ["消化器内科", "Gastroenterology"], ["循環器内科", "Cardiology"],
            ["呼吸器内科", "Respiratory Medicine"], ["神経内科", "Neurology"], ["心療内科", "Psychosomatic Medicine"],
            ["精神科", "Psychiatry"], ["小児科", "Pediatrics"], ["皮膚科", "Dermatology"], ["眼科", "Ophthalmology"],
            ["耳鼻咽喉科", "ENT (Otolaryngology)"], ["産婦人科", "Obstetrics & Gynecology"], ["泌尿器科", "Urology"],
            ["放射線科", "Radiology"], ["麻酔科", "Anesthesiology"], ["リハビリテーション科", "Rehabilitation"],
            ["内科", "Internal Medicine"], ["外科", "Surgery"], ["歯科", "Dentistry"], ["、", ", "]
        ];
        const deptBody =
            `var s = ${NZ("診療科目", "")}; if (s == '') { return ${q(tr(L, "Unspecified", "記載なし"))}; } ` +
            (L === "JA" ? "return s;" : DEPTS.map(([a, b]) => `s = Replace(s, ${q(a)}, ${q(b)});`).join(" ") + " return s;");
        return {
            title: X("title"),
            content: [...body(
                row(tr(L, "Facility type", "施設種別"), X("ftype")) +
                row(tr(L, "Address", "所在地"), X("addr")) +
                (L === "EN" ? note(`Romaji: ${X("romaji")}`) : "") +
                row(tr(L, "Departments", "診療科目"), X("depts")) +
                row(tr(L, "Beds", "病床数"), X("beds")) + HR +
                row(tr(L, "Support status", "対応状況"), X("badge"))
            ), custom((g) => {
                const box = el("div", { style: BLOCK });
                const phone = attr(g, "電話番号");
                if (phone) box.append(labeled(tr(L, "Phone", "電話番号"), el("a", { href: `tel:${phone.replace(/[^\d+]/g, "")}`, textContent: phone })));
                const hours = attr(g, "reception_hours");
                if (hours) box.append(labeled(tr(L, "Reception hours", "受付時間"), document.createTextNode(hours)));
                const langs = attr(g, "departments_languages");
                if (langs) box.append(labeled(tr(L, "Supported languages", "対応言語"), document.createTextNode(langs)));
                const url = safeUrl(attr(g, "website"));
                if (url) box.append(labeled(tr(L, "Website", "公式サイト"), linkEl(url, tr(L, "Official website", "公式サイト"))));
                box.hidden = !box.childNodes.length;
                return box;
            })],
            expressionInfos: [
                E("title", L === "JA"
                    ? `return nz(${G("名称")}, ${NZ("name_en")});`
                    : `var a = ${NZ("name_en", "")}; if (a != '') { return a; } var b = ${NZ("name_romaji", "")}; if (b != '') { return b; } return ${NZ("名称")};`),
                E("ftype", L === "JA"
                    ? `var f = ${NZ("facility_type", "")}; return ${decodePairs("f", [["Hospital", "病院"], ["Clinic", "診療所"], ["Dental", "歯科"], ["Pharmacy", "薬局"]], "f")};`
                    : `return ${NZ("facility_type")};`),
                E("addr", `var a = ${NZ("所在地")}; var z = ${NZ("郵便番号", "")}; if (z == '') { return a; } return ${L === "JA" ? "'〒' + z + ' ' + a" : "a + ' (' + z + ')'"};`),
                E("romaji", `return ${NZ("address_romaji")};`),
                E("depts", deptBody),
                E("beds", `var b = num(${G("病床数")}); if (IsEmpty(b) || b <= 0) { return '—'; } return Text(b) + '${tr(L, "", " 床")}';`),
                E("badge", `if (on(${G("is_multilingual")})) { return ${q(tr(L, "🌟 Multilingual (English support available)", "🌟 多言語対応・外国語サポートあり"))}; } return ${q(tr(L, "Standard local facility — Japanese is the primary language.", "一般地域医療機関（日本語対応が中心）"))};`)
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
        return {
            title: `⛷️ ${X("name")}`,
            content: body(
                row(tr(L, "Subprefecture", "振興局"), X("sub")) +
                row(tr(L, "Municipality", "自治体"), X("muni")) +
                row(tr(L, "Key features", "特徴"), X("feat")) +
                row(tr(L, "Lifts & facilities", "リフト・設備"), X("lifts"))
            ),
            expressionInfos: [
                E("name", L === "JA" ? `return nz(${G("name_ja")}, ${NZ("name_en")});` : `return nz(${G("name_en")}, ${NZ("name_ja")});`),
                E("sub", `return ${loc("subprefecture")};`),
                E("muni", `return ${loc("municipality")};`),
                E("feat", `return ${loc("key_features")};`),
                E("lifts", `return ${loc("lifts")};`)
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
            `var raw = ${NZ("are_participants_expected_to_br", "")}; if (raw == '') { return '—'; } var l = Lower(raw); var out = ''; ` +
            BRING.map(([k, en, ja]) => `if (Find(${q(k)}, l) > -1) { if (out != '') { out += ', '; } out += ${q(tr(L, en, ja))}; }`).join(" ") +
            ` if (out == '') { return raw; } return out;`;
        const choice = (field, rules, unknown) =>
            `var raw = ${NZ(field, "")}; if (raw == '') { return '—'; } var l = Lower(raw); ` +
            rules.map(([k, en, ja]) => `if (Find(${q(k)}, l) > -1) { return ${q(tr(L, en, ja))}; }`).join(" ") +
            ` return ${q(tr(L, ...unknown))};`;
        return {
            title: `🎉 ${X("type")}`,
            content: body(
                row(`📅 ${tr(L, "Date / time", "開催日時")}`, X("date")) +
                row(tr(L, "Overnight stay", "宿泊"), X("overnight")) +
                row(tr(L, "What to bring", "持ち物"), X("bring")) +
                row(tr(L, "Carpooling", "相乗り"), X("carpool")) +
                row(`👤 ${tr(L, "Contact", "連絡先")}`, X("contact")) + HR +
                `<b>📝 ${tr(L, "Additional information", "追加情報")}:</b><p style="margin:4px 0">${X("info")}</p>` +
                note(tr(L, "Submitted via the ForeignHokkaido community survey", "コミュニティ投稿フォームより"))
            ),
            expressionInfos: [
                E("type", `var c = ${NZ("what_type_of_event_is_this", "")}; var o = ${NZ("what_type_of_event_is_thi_other", "")}; ` +
                    `if (c == '' || (Lower(c) == 'other' && o != '')) { c = o; } if (c == '') { return ${q(tr(L, "Community event", "地域のイベント"))}; } ` +
                    (L === "JA" ? `return ${decodePairs("c", [["Holiday Party", "ホリデーパーティー"], ["Weekend Meetup", "週末の集まり"], ["Game Night", "ゲームナイト"], ["Other", "その他"]])};` : "return c;")),
                E("date", `var d = ${G("date_and_time")}; if (IsEmpty(d)) { return '—'; } if (TypeOf(d) == 'Number') { d = Date(d); } ` +
                    `if (TypeOf(d) == 'Date') { return Text(d, '${tr(L, "MMM D, YYYY h:mm A", "YYYY/MM/DD HH:mm")}'); } return Text(d);`),
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
            row(tr(L, "Recommendation", "おすすめ度"), X("rating")) + HR +
            `<b>📝 ${tr(L, "Additional information", "追加情報")}:</b><p style="margin:4px 0">${X("info")}</p>` +
            note(tr(L, "Submitted via the ForeignHokkaido community survey", "コミュニティ投稿フォームより"))
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
            row(`📍 ${tr(L, "Location", "場所")}`, X("loc")) +
            row(`🆔 ${tr(L, "Site ID", "箇所番号")}`, X("id")) + HR +
            `<b>${icon} ${tr(L, "Safety notice", "注意")}:</b> ${notice}<br>` +
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
    ["室蘭本線", "Muroran Main Line"], ["函館市電", "Hakodate Tram"]
];
const OPERATOR_PAIRS = [
    ["北海道旅客鉄道", "JR Hokkaido"], ["道南いさりび鉄道", "Donan Isaribi Railway"],
    ["函館市企業局交通部", "Hakodate City Transportation Bureau (tram)"]
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
    subprefecture: single(fill(C.dark, 0, C.dark, 1.5)),
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
    railLines: single({ type: "simple-line", color: rgba(C.dark, 0.9), width: 2.5, style: "solid" }),

    // --- points ---
    municipal: single(marker("square", C.blue, 10)),
    schools: single(marker("triangle", C.blue, 11)),
    post: single(marker("circle", C.blue, 8)),
    police: single(marker("diamond", C.blue, 11)),
    shelters: single(marker("square", C.green, 12, [255, 255, 255, 1], 1.5)),
    railStations: single({ type: "simple-marker", style: "circle", color: [255, 255, 255, 1], size: "10px", outline: { color: rgba(C.dark), width: 2.5 } }),
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
            { value: "Hospital", label: "Hospital (病院)", symbol: marker("cross", C.vermillion, 15, [255, 255, 255, 1], 2) },
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

const SPECS = [
    feature("snow", "layerSnow", 10, `${FS}/ForeignHokkaido_OshimaHiyama_SnowStats/FeatureServer/0`, { props: { renderer: RENDERERS.snow }, popup: POPUPS.snow }),
    geojson("landslide", "layerLandslide", 11, "datasets/oshima_hiyama_landslides.geojson", { props: { definitionExpression: "hazard_code = 'LANDSLIDE'", renderer: RENDERERS.landslide }, popup: POPUPS.landslide }),
    geojson("avalanche", "layerAvalanche", 12, "datasets/oshima_hiyama_avalanches.geojson", { props: { definitionExpression: "hazard_code = 'AVALANCHE'", renderer: RENDERERS.avalanche }, popup: POPUPS.avalanche }),
    // Garbage lookup: not in the layer list. The search box in the panel is the only way to show it.
    feature("trash", "layerTrash", 13, `${FS}/ForeignHokkaido_TrashRegs_EN_JA/FeatureServer/0`, { props: { renderer: RENDERERS.trash }, popup: POPUPS.trash }),
    feature("wildlife", "layerWildlife", 15, `${FS}/ForeignHokkaido_OshimaHiyama_WildlifeReserves/FeatureServer/0`, { byGeometry: WILDLIFE_BY_GEOMETRY, popup: genericPopup("layerWildlife") }),
    feature("muniBoundaries", "layerMuniBoundaries", 20, `${FS}/ForeignHokkaido_AdminBoundaries/FeatureServer/1`, { props: { renderer: RENDERERS.municipality }, popup: POPUPS.muniBoundaries }),
    feature("oshhiBoundaries", "layerOshHiBoundaries", 21, `${FS}/ForeignHokkaido_AdminBoundaries/FeatureServer/2`, { props: { renderer: RENDERERS.subprefecture }, popup: POPUPS.oshhiBoundaries }),
    feature("railLines", "layerRailLines", 30, `${FS}/ForeignHokkaido_OshimaHiyama_Railroad/FeatureServer/1`, { props: { renderer: RENDERERS.railLines }, popup: POPUPS.railLines }),
    feature("bus", "layerBus", 40, `${FS}/ForeignHokkaido_OshimaHiyama_RoadsideStations/FeatureServer/1`, { props: { renderer: RENDERERS.bus }, popup: genericPopup("layerBus") }),
    feature("gas", "layerGas", 41, `${FS}/ForeignHokkaido_OshimaHiyama_RoadsideStations/FeatureServer/2`, { props: { renderer: RENDERERS.gas }, popup: genericPopup("layerGas") }),
    feature("roadside", "layerRoadside", 42, `${FS}/ForeignHokkaido_OshimaHiyama_RoadsideStations/FeatureServer/0`, { props: { renderer: RENDERERS.roadside }, popup: POPUPS.roadside }),
    feature("post", "layerPost", 43, `${FS}/ForeignHokkaido_OshimaHiyama_PostOffices/FeatureServer/`, { props: { renderer: RENDERERS.post }, popup: POPUPS.post }),
    feature("schools", "layerSchools", 44, `${FS}/ForeignHokkaido_OshimaHiyama_Schools/FeatureServer/0`, { props: { renderer: RENDERERS.schools }, popup: POPUPS.schools }),
    feature("municipal", "layerMunicipal", 45, `${FS}/ForeignHokkaido_Municipal_Offices_etc_and_Public_Meeting_Facilities/FeatureServer`, { props: { definitionExpression: "P05_002 IN ('1', '2', '4')", renderer: RENDERERS.municipal }, popup: POPUPS.municipal }),
    feature("police", "layerPolice", 46, `${FS}/ForeignHokkaido_OshimaHiyama_Police/FeatureServer/1`, { props: { renderer: RENDERERS.police }, popup: POPUPS.police }),
    feature("shelters", "layerShelters", 47, `${FS}/ForeignHokkaido_DisasterPrevention/FeatureServer/1`, { props: { renderer: RENDERERS.shelters }, popup: POPUPS.shelters }),
    feature("railStations", "layerRailStations", 48, `${FS}/ForeignHokkaido_OshimaHiyama_Railroad/FeatureServer/0`, { props: { renderer: RENDERERS.railStations }, popup: POPUPS.railStations }),
    geojson("medical", "layerMedical", 49, "datasets/oshima_hiyama_medical_master.geojson", { props: { renderer: RENDERERS.medical }, popup: POPUPS.medical }),
    geojson("ski", "layerSki", 50, "datasets/hokkaido_ski_resorts.geojson", { props: { renderer: RENDERERS.ski }, popup: POPUPS.ski }),
    feature("communityEvents", "layerCommunityEvents", 55, `${FS}/survey123_ce59397e2ce24ba9825b39f151844c21_results/FeatureServer/0`, { props: { renderer: RENDERERS.communityEvents }, popup: POPUPS.communityEvents }),
    feature("localInterests", "layerLocalInterests", 56, `${FS}/survey123_4d7f38da81374bb8b57cd737de7fe630_results/FeatureServer/0`, { props: { renderer: RENDERERS.localInterests }, popup: POPUPS.localInterests })
];
const SPEC = Object.fromEntries(SPECS.map((s) => [s.key, s]));

/* ---- Season baselines ------------------------------------------------------
   Switching season turns that season's layers on and the other season's off.
   Layers in neither list (medical, schools, ...) keep whatever the user chose.
   ALWAYS_ON layers are visible from the start in both seasons.
   -------------------------------------------------------------------------- */
const ALWAYS_ON = ["oshhiBoundaries"];
const SEASON_LAYERS = {
    summer: ["muniBoundaries", "landslide", "roadside"],
    winter: ["snow", "avalanche", "shelters", "ski"]
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

function createLayer(spec) {
    const Ctor = spec.type === "geojson" ? esri.GeoJSONLayer : esri.FeatureLayer;
    const layer = new Ctor({
        id: spec.key,
        url: spec.url,
        title: t(spec.labelKey, currentLang),
        outFields: ["*"],
        visible: isBaseline(spec.key, currentSeason),
        ...spec.props
    });
    layers[spec.key] = layer;
    applyPopup(spec);

    layer.watch("visible", (visible) => {
        const checkbox = panelEl?.querySelector(`#toggle-${spec.key}`);
        if (checkbox) checkbox.checked = visible;
        if (visible) syncFilter(layer);
    });
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
    if (layer) layer.popupTemplate = spec.popup(currentLang, layer);
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

async function applyMuniFilter(town, { zoom = true } = {}) {
    muniFilter = town;
    const token = ++filterToken;
    if (town === "ALL") {
        spatialFilter = null;
    } else {
        const geometry = await townGeometry(town).catch((e) => { console.warn("Municipality query failed:", e); return null; });
        if (token !== filterToken || !geometry) return;
        spatialFilter = { geometry, spatialRelationship: "intersects" };
        if (zoom && geometry.extent) view.goTo(geometry.extent.expand(1.15), EASE);
    }
    Object.values(layers).forEach((layer) => { if (layer.visible) syncFilter(layer); });
    if (town === "ALL" && zoom) view.goTo(HOME, EASE);
}

async function showTrash(town) {
    trashTown = town;
    const layer = layers.trash;
    if (town === "ALL") {
        layer.visible = false;
        layer.definitionExpression = null;
        if (view.popup.selectedFeature?.layer === layer) view.popup.close();
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
            view.popup.open({ features: [features[0]], location: geometry?.extent?.center ?? features[0].geometry?.extent?.center });
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
        <h3>${t("panelTitle", L)}</h3>
        <div class="fh-field">
            <label for="muni-filter-select">${t("muniFilterLabel", L)}</label>
            <select id="muni-filter-select" class="fh-select">${muniOptions(L, t("muniAll", L), muniFilter)}</select>
        </div>
        <div class="fh-field">
            <label for="trash-filter-select">🗑️ ${t("trashLookupLabel", L)}</label>
            <select id="trash-filter-select" class="fh-select">${muniOptions(L, t("trashAll", L), trashTown)}</select>
        </div>
        <div class="fh-section-title">${t("layersLabel", L)}</div>
        ${CATEGORIES.map((c) => `
            <div class="fh-cat">
                <div class="fh-cat-title">${t(c.key, L)}</div>
                ${c.layers.map((key) => `
                    <label class="fh-check">
                        <input type="checkbox" id="toggle-${key}" data-layer="${key}"${layers[key].visible ? " checked" : ""}>
                        <span id="toggle-${key}-lbl">${t(SPEC[key].labelKey, L)}</span>
                    </label>`).join("")}
            </div>`).join("")}
        <div class="fh-section-title">${t("crowdsourceHeader", L)}</div>
        <div class="fh-links">
            <a class="fh-link is-survey" href="${FORM_LINKS.survey}" target="_blank" rel="noopener noreferrer">${t("surveyBtn", L)}</a>
            <a class="fh-link is-report" href="${FORM_LINKS.report}" target="_blank" rel="noopener noreferrer">${t("reportBtn", L)}</a>
            <a class="fh-link is-bug" href="${FORM_LINKS.bug}" target="_blank" rel="noopener noreferrer">${t("reportAppBtn", L)}</a>
        </div>`;
    panelEl.scrollTop = scroll;
    toggleBtn.textContent = t("mapControlsBtn", L);
}

export function setPanelOpen(open) {
    panelOpen = open;
    if (!panelEl) return;
    panelEl.hidden = !open;
    toggleBtn.classList.toggle("is-open", open);
    toggleBtn.setAttribute("aria-expanded", String(open));
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
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && panelOpen) setPanelOpen(false); });
    panelEl.addEventListener("change", (e) => {
        const el = e.target;
        if (el.dataset?.layer) layers[el.dataset.layer].visible = el.checked;
        else if (el.id === "muni-filter-select") applyMuniFilter(el.value);
        else if (el.id === "trash-filter-select") showTrash(el.value);
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
    popup.close();
    popup.open({ features: [selectedFeature], location });
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
        SPECS.forEach((s) => { layers[s.key].title = t(s.labelKey, currentLang); applyPopup(s); });
        renderPanel();
        setPanelOpen(panelOpen);
        refreshOpenPopup();
    }
    emit();
    return currentLang;
}

export function resetView() {
    if (!view) return;
    muniFilter = "ALL";
    trashTown = "ALL";
    showTrash("ALL");
    renderPanel();
    applyMuniFilter("ALL");
}

/* ==========================================================================
   INIT
   ========================================================================== */

export async function initMap(containerId, apiKey) {
    const [
        esriConfig, intl, EsriMap, MapView, FeatureLayer, GeoJSONLayer,
        Basemap, geometryEngine, Legend, Expand, Zoom
    ] = await load([
        "esri/config", "esri/intl", "esri/Map", "esri/views/MapView",
        "esri/layers/FeatureLayer", "esri/layers/GeoJSONLayer", "esri/Basemap",
        "esri/geometry/geometryEngine", "esri/widgets/Legend", "esri/widgets/Expand", "esri/widgets/Zoom"
    ]);
    esri = { intl, Basemap, FeatureLayer, GeoJSONLayer, geometryEngine };
    if (apiKey) esriConfig.apiKey = apiKey;

    document.documentElement.lang = currentLang === "JA" ? "ja" : "en";
    applyLocale();

    map = new EsriMap();
    applyBasemap();
    map.addMany([...SPECS].sort((a, b) => a.z - b.z).map(createLayer));

    view = new MapView({
        container: containerId,
        map,
        center: HOME.center,
        zoom: HOME.zoom,
        ui: { components: ["attribution"] }
    });

    // Top-left stack: controls button + panel, zoom, (locate is added by location.js at index 2), legend
    view.ui.add(buildControls(), { position: "top-left", index: 0 });
    view.ui.add(new Zoom({ view }), { position: "top-left", index: 1 });
    view.ui.add(new Expand({ view, content: new Legend({ view }), expandIcon: "legend", group: "top-left" }), { position: "top-left", index: 3 });

    // Responsive popup docking and bottom padding (the header ribbon sits at the bottom on mobile)
    const applyBreakpoint = (bp) => {
        const mobile = bp === "xsmall" || bp === "small";
        view.padding = { bottom: mobile ? 96 : 0 };
        view.popup.dockEnabled = !mobile;
        view.popup.dockOptions = { buttonEnabled: false, breakpoint: false, position: "bottom-right" };
    };
    view.watch("widthBreakpoint", applyBreakpoint);
    applyBreakpoint(view.widthBreakpoint);

    // Clicking a municipality polygon (when it is the topmost feature) zooms to it.
    view.on("click", async (event) => {
        if (window.matchMedia(MOBILE_QUERY).matches) setPanelOpen(false);
        const { results } = await view.hitTest(event);
        const top = results.find((r) => r.graphic?.layer);
        if (top?.graphic.layer.id === "muniBoundaries" && top.graphic.geometry?.extent) {
            view.goTo(top.graphic.geometry.extent.expand(1.2), { duration: 1200, easing: "in-out-cubic" });
        }
    });

    view.on("layerview-create-error", (e) => console.warn(`[layerview] "${e.layer?.id}" could not be drawn:`, e.error?.message || e.error));

    window.__fh = { map, view }; // debugging handle: inspect in the console
    await view.when();
    return { map, view };
}