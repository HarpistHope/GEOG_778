// localization.js

export const translations = {
    EN: {
        appTitle: "ForeignHokkaido",
        appSubtitle: "Oshima & Hiyama Network Map for ALTs",
        seasonBtnWinter: "❄️ Winter Mode",
        seasonBtnSummer: "☀️ Summer Mode",
        resetBtn: "🎯 Reset Extent",
        muniFilterLabel: "FILTER BY MUNICIPALITY:",
        muniAll: "Show All Municipalities",
        layersLabel: "TOGGLE LAYERS:",
        crowdsourceHeader: "COMMUNITY CONTRIBUTIONS:",
        surveyBtn: "Add Community Event",
        reportBtn: "Add Local Interests",
        layerMunicipal: "Municipal Offices",
        layerPolice: "Police Stations/Koban",
        layerPost: "Post Offices",
        layerSchools: "Schools & Facilities",
        layerRoadside: "Michi-no-Eki/Roadside Stations",
        layerBus: "Bus Stops",
        layerGas: "Gas Stations",
        layerShelters: "Disaster Shelters",
        layerWildlife: "Wildlife Reserves",
        layerSnow: "Snow Statistics & Hazard Classifications",
        layerMuniBoundaries: "Municipal Boundaries",
        layerOshHiBoundaries: "Subprefectural Boundaries",
        layerRailStations: "Railway Stations",
        layerRailLines: "Railway Lines",
        layerMedical: "Medical Facilities (Hospitals, Clinics, Dentists, Pharmacies)",
        layerTrash: "Garbage & Recycling Regulations",
        layerAvalanche: "Avalanche Hazard Zones",
        layerLandslide: "Landslide Hazard Zones"
    },
    JA: {
        appTitle: "北海道の異国情緒",
        appSubtitle: "外国語指導助手(ALT) 向け地域生活防災マップ",
        seasonBtnWinter: "❄️ 冬季モード",
        seasonBtnSummer: "☀️ 夏季モード",
        resetBtn: "🎯 全域表示",
        muniFilterLabel: "市町村エリア絞り込み:",
        muniAll: "全自治体を表示",
        layersLabel: "表示レイヤー:",
        crowdsourceHeader: "情報提供・コミュニティ投稿:",
        surveyBtn: "📍 地域のイベントを投稿・報告",
        reportBtn: "📍 地域のおすすめスポットを投稿・報告",
        layerMunicipal: "役所・役場・公民館",
        layerPolice: "警察署・交番・駐在所",
        layerPost: "郵便局",
        layerSchools: "学校・教育施設",
        layerRoadside: "道の駅",
        layerBus: "バス停留所",
        layerGas: "ガソリンスタンド",
        layerShelters: "避難所・防災施設",
        layerWildlife: "鳥獣保護区・自然公園",
        layerSnow: "雪害統計・指定区分",
        layerMuniBoundaries: "渡島・檜山 町村境界線",
        layerOshHiBoundaries: "渡島・檜山 振興局境界線",
        layerRailStations: "鉄道駅",
        layerRailLines: "鉄道路線",
        layerMedical: "医療施設 (病院・診療所・歯科・薬局)",
        layerTrash: "ごみ・リサイクル分別ルール",
        layerAvalanche: "雪崩危険区域",
        layerLandslide: "土砂災害危険区域"
    }
};

// Helper function to fetch translation safely
export function t(key, lang = "EN") {
    return translations[lang]?.[key] || translations["EN"][key] || key;
}