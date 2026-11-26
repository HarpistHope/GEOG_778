// localization.js — all UI strings plus shared place-name data

export const translations = {
    EN: {
        appTitle: "ForeignHokkaido",
        appSubtitle: "Oshima & Hiyama Network Map for ALTs",
        langBtn: "🇯🇵 日本語",
        seasonBtnWinter: "❄️ Winter Mode",
        seasonBtnSummer: "☀️ Summer Mode",
        resetBtn: "🎯 Reset Extent",
        tourBtn: "❓ App Tour",
        panelTitle: "Interactive Control Panel",
        mapControlsBtn: "Map Controls",
        muniFilterLabel: "Filter by Municipality",
        muniAll: "Show All Municipalities",
        trashLookupLabel: "Garbage Rules Lookup",
        trashAll: "Select a Municipality for Trash Rules",
        layersLabel: "Toggle Layers",
        crowdsourceHeader: "Community Contributions",
        surveyBtn: "📅 Add Community Event",
        reportBtn: "📍 Add Local Interests",
        reportAppBtn: "🚩 Report Issue with App",

        layerMunicipal: "Municipal Offices",
        layerPolice: "Police Stations/Koban",
        layerPost: "Post Offices",
        layerSchools: "Schools & Facilities",
        layerRoadside: "Michi-no-Eki/Roadside Stations",
        layerBus: "Bus Stops",
        layerGas: "Gas Stations",
        layerShelters: "Emergency Shelters",
        layerWildlife: "Wildlife Reserves",
        layerSnow: "Snow Zones & Statistics",
        layerMuniBoundaries: "Municipal Boundaries",
        layerOshHiBoundaries: "Subprefectural Boundaries",
        layerRailStations: "Railway Stations",
        layerRailLines: "Railway Lines",
        layerMedical: "Medical Facilities (Hospitals, Clinics, Dentists, Pharmacies)",
        medicalMultiOnly: "Only facilities with foreign-language support",   // EN
        hidePastEvents: "Hide past events",
        layerTrash: "Garbage & Recycling Regulations",
        layerAvalanche: "Avalanche Hazard Zones",
        layerLandslide: "Landslide Hazard Zones",
        layerSki: "Ski Resorts & Winter Recreation",
        layerCommunityEvents: "Community Events (Crowdsourced)",
        layerLocalInterests: "Local Interests (Crowdsourced)",

        catAdmin: "🏛️ Administrative Boundaries",
        catLogistics: "🏢 Local Logistics",
        catSafety: "🚨 Health & Public Safety",
        catTransit: "🚌 Transit",
        catHazards: "⚠️ Natural Hazard Zones",
        catNature: "🏔️ Nature & Recreation",
        catCommunity: "👥 Community Network",

        tourBack: "Back",
        tourSkip: "Skip tour",
        tourNext: "Next",
        tourFinish: "Finish",
        tourStep: "Step {n} of {total}",

        zoomHint: "Zoom in to see these on the map",

        locDenied: "Location access was denied. Enable location permission in your browser settings to find your position.",
        locUnavailable: "Your position could not be determined. Check your device's location settings.",
        locTimeout: "The location request timed out. Try again or check your GPS connection.",

        mapLoadError: "The map could not be loaded. Check your connection and API key, then reload the page."
    },
    JA: {
        appTitle: "ForeignHokkaido",
        appSubtitle: "渡島・檜山 ALT向けネットワークマップ",
        langBtn: "🇬🇧 English",
        seasonBtnWinter: "❄️ 冬季モード",
        seasonBtnSummer: "☀️ 夏季モード",
        resetBtn: "🎯 全域表示",
        tourBtn: "❓ アプリツアー",
        panelTitle: "マップ操作パネル",
        mapControlsBtn: "マップ操作",
        muniFilterLabel: "市町村で絞り込み",
        muniAll: "全自治体を表示",
        trashLookupLabel: "ごみ収集ルール検索",
        trashAll: "ごみ規則を調べる自治体を選択",
        layersLabel: "表示レイヤー",
        crowdsourceHeader: "情報提供・コミュニティ投稿",
        surveyBtn: "📅 地域のイベントを投稿・報告",
        reportBtn: "📍 地域のおすすめスポットを投稿・報告",
        reportAppBtn: "🚩 アプリの不具合を報告",

        layerMunicipal: "役所・役場・公民館",
        layerPolice: "警察署・交番・駐在所",
        layerPost: "郵便局",
        layerSchools: "学校・教育施設",
        layerRoadside: "道の駅",
        layerBus: "バス停留所",
        layerGas: "ガソリンスタンド",
        layerShelters: "避難所・防災施設",
        layerWildlife: "鳥獣保護区",
        layerSnow: "豪雪地帯区分・積雪統計",
        layerMuniBoundaries: "市町村境界線",
        layerOshHiBoundaries: "振興局境界線",
        layerRailStations: "鉄道駅",
        layerRailLines: "鉄道路線",
        layerMedical: "医療施設（病院・診療所・歯科・薬局）",
        medicalMultiOnly: "外国語対応の施設のみ表示", 
        hidePastEvents: "開催済みのイベントを非表示",
        layerTrash: "ごみ・リサイクル分別ルール",
        layerAvalanche: "雪崩危険区域",
        layerLandslide: "土砂災害危険区域",
        layerSki: "スキー場・冬季レクリエーション",
        layerCommunityEvents: "地域のイベント（コミュニティ投稿）",
        layerLocalInterests: "地域のおすすめスポット（コミュニティ投稿）",

        catAdmin: "🏛️ 行政区画",
        catLogistics: "🏢 生活インフラ",
        catSafety: "🚨 防災・安全",
        catTransit: "🚌 交通・公共輸送",
        catHazards: "⚠️ 自然災害危険区域",
        catNature: "🏔️ 自然・レクリエーション",
        catCommunity: "👥 コミュニティ・ネットワーク",

        tourBack: "戻る",
        tourSkip: "ツアーをスキップ",
        tourNext: "次へ",
        tourFinish: "完了",
        tourStep: "ステップ {n} / {total}",

        zoomHint: "地図を拡大すると表示されます",

        locDenied: "位置情報へのアクセスが拒否されました。現在地を表示するには、ブラウザの設定で位置情報を許可してください。",
        locUnavailable: "現在地を取得できませんでした。端末の位置情報設定をご確認ください。",
        locTimeout: "位置情報の取得がタイムアウトしました。もう一度お試しいただくか、GPS接続をご確認ください。",

        mapLoadError: "地図を読み込めませんでした。通信状況とAPIキーを確認して、ページを再読み込みしてください。"
    }
};

export const tourSteps = {
    EN: [
        { title: "Welcome to ForeignHokkaido!", text: "This bilingual map covers services, safety information, and community resources for ALTs in Oshima and Hiyama. Proceed through the tour for an overview of main features.", target: null },
        { title: "Switch Language", text: "Switch the entire app between English and Japanese on demand.", target: "#btn-lang-toggle" },
        { title: "Map Controls", text: "Open the control panel to filter by municipality, look up garbage rules, find nearby facilities, and turn layers on or off.", target: "#controlPanelCustomBtn" },
        { title: "Municipality Filter", text: "Select a municipality to show only its features. Choose “Show All Municipalities” or select Reset Extent to reset.", target: "#tour-muni", panel: true },
        { title: "Garbage Lookup", text: "Select a municipality to view its garbage sorting rules, put-out times, and a link to the official town page.", target: "#tour-trash", panel: true },
        { title: "Find the Nearest", text: "Choose a service type, then select Use My Location or Pick on Map. The three closest results in a straight-line distance will be provided.", target: "#tour-nearest", panel: true },
        { title: "Toggle Layers", text: "Toggle layers on or off to fit your needs. Under Medical Facilities, 🌟 limits results to places with foreign-language support. Under Community Events, ⏳ hides past events. Dense layers appear as you zoom in.", target: "#tour-layers", panel: true },
        { title: "Community Contributions", text: "Submit a community event or local interest, or report a problem with the app. Each button opens a form in a new tab. New entries will appear on the map within a few minutes.", target: "#tour-links", panel: true },
        { title: "Legend", text: "Open the legend to identify map symbols. Only layers that have been toggled on are listed.", target: "#fh-legend, .esri-ui-top-left .esri-expand" },
        { title: "Winter Mode", text: "Winter Mode adds official snow zone classifications and statistics, avalanche hazard zones, and winter recreation areas to the map.", target: "#btn-season-toggle" },
        { title: "Reset Extent", text: "Return to the starting view and clear all filters. Now go have fun exploring!", target: "#btn-reset-view" }
    ],
    JA: [
        { title: "ForeignHokkaido へようこそ", text: "渡島・檜山地域のALTのための、生活情報・防災情報・地域コミュニティ情報をまとめた日英対応マップです。主な機能をご紹介します。", target: null },
        { title: "言語の切り替え", text: "ポップアップや凡例を含むアプリ全体の表示を、日本語と英語で切り替えます。", target: "#btn-lang-toggle" },
        { title: "マップ操作", text: "コントロールパネルを開くと、市町村での絞り込み、ごみ収集ルールの検索、近くの施設の検索、レイヤーの表示切替ができます。", target: "#controlPanelCustomBtn" },
        { title: "市町村フィルター", text: "市町村を選ぶと、その地域にズームし、該当する情報のみを表示します。「全自治体を表示」を選ぶか「全域表示」を押すと解除されます。", target: "#tour-muni", panel: true },
        { title: "ごみ収集の検索", text: "市町村を選ぶと、分別ルール、出す時間、町の公式ページへのリンクが表示されます。", target: "#tour-trash", panel: true },
        { title: "近くの施設を探す", text: "施設の種類を選び、「現在地から」または「地図で選ぶ」を押してください。直線距離が近い順に3件が表示されます。", target: "#tour-nearest", panel: true },
        { title: "レイヤー", text: "レイヤーのオン・オフで地図の表示を切り替えます。「医療施設」の🌟は外国語対応の施設のみ、「地域のイベント」の⏳は開催済みのイベントを非表示にします。数の多いレイヤーは、拡大すると表示されます。", target: "#tour-layers", panel: true },
        { title: "コミュニティ投稿", text: "地域のイベントやおすすめスポットの投稿、アプリの不具合の報告ができます。各ボタンは新しいタブでフォームを開き、投稿は数分以内に地図に反映されます。", target: "#tour-links", panel: true },
        { title: "凡例", text: "凡例を開くと、地図の記号の意味を確認できます。表示中のレイヤーのみが一覧に表示されます。", target: "#fh-legend, .esri-ui-top-left .esri-expand" },
        { title: "冬季モード", text: "冬季モードでは、豪雪地帯区分と積雪統計、雪崩危険区域、冬季レクリエーション施設が表示されます。", target: "#btn-season-toggle" },
        { title: "全域表示", text: "南西北海道の全体表示に戻り、すべての絞り込みを解除します。それでは、地域の探索をお楽しみください。", target: "#btn-reset-view" }
    ]
};

// Translation lookup: selected language → English → the key itself
export function t(key, lang = "EN") {
    return translations[lang]?.[key] ?? translations.EN[key] ?? key;
}

// ==========================================
// SHARED PLACE-NAME DATA
// ==========================================

// 18 municipalities: Oshima (11) + Hiyama (7). `ja` matches the N03_004 field.
export const municipalities = [
    { ja: "函館市", en: "Hakodate City", group: "oshima" },
    { ja: "北斗市", en: "Hokuto City", group: "oshima" },
    { ja: "知内町", en: "Shiriuchi Town", group: "oshima" },
    { ja: "木古内町", en: "Kikonai Town", group: "oshima" },
    { ja: "松前町", en: "Matsumae Town", group: "oshima" },
    { ja: "福島町", en: "Fukushima Town", group: "oshima" },
    { ja: "七飯町", en: "Nanae Town", group: "oshima" },
    { ja: "鹿部町", en: "Shikabe Town", group: "oshima" },
    { ja: "森町", en: "Mori Town", group: "oshima" },
    { ja: "八雲町", en: "Yakumo Town", group: "oshima" },
    { ja: "長万部町", en: "Oshamambe Town", group: "oshima" },
    { ja: "江差町", en: "Esashi Town", group: "hiyama" },
    { ja: "上ノ国町", en: "Kaminokuni Town", group: "hiyama" },
    { ja: "厚沢部町", en: "Assabu Town", group: "hiyama" },
    { ja: "乙部町", en: "Otobe Town", group: "hiyama" },
    { ja: "奥尻町", en: "Okushiri Town", group: "hiyama" },
    { ja: "今金町", en: "Imakane Town", group: "hiyama" },
    { ja: "せたな町", en: "Setana Town", group: "hiyama" }
];

// Districts (郡) found in N03_003
export const districts = {
    "松前郡": "Matsumae District",
    "上磯郡": "Kamiiso District",
    "亀田郡": "Kameda District",
    "茅部郡": "Kayabe District",
    "山越郡": "Yamakoshi District",
    "二海郡": "Nikai District",
    "檜山郡": "Hiyama District",
    "爾志郡": "Nishi District",
    "奥尻郡": "Okushiri District",
    "瀬棚郡": "Setana District",
    "久遠郡": "Kudo District"
};

export const subprefectures = {
    oshima: {
        match: "渡島", ja: "渡島総合振興局", en: "Oshima Subprefecture",
        hubJa: "函館市", hubEn: "Hakodate City",
        descJA: "函館市を中心に11市町で構成されています。",
        descEN: "Covers 11 municipalities centered on Hakodate."
    },
    hiyama: {
        match: "檜山", ja: "檜山振興局", en: "Hiyama Subprefecture",
        hubJa: "江差町", hubEn: "Esashi Town",
        descJA: "日本海沿岸部と奥尻島を含む7町で構成されています。",
        descEN: "Covers 7 municipalities along the southwestern coast and Okushiri Island."
    }
};