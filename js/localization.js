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
        layerShelters: "Emergency Shelters",
        layerWildlife: "Wildlife Reserves",
        layerSnow: "Snow Hazard Zone Classifications",
        layerMuniBoundaries: "Municipal Boundaries",
        layerOshHiBoundaries: "Subprefectural Boundaries",
        layerRailStations: "Railway Stations",
        layerRailLines: "Railway Lines",
        layerMedical: "Medical Facilities (Hospitals, Clinics, Dentists, Pharmacies)",
        layerTrash: "Garbage & Recycling Regulations",
        layerAvalanche: "Avalanche Hazard Zones",
        layerLandslide: "Landslide Hazard Zones",
        layerSki: "Ski Resorts & Winter Recreation"
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
        layerSnow: "雪害危険区域",
        layerMuniBoundaries: "渡島・檜山 町村境界線",
        layerOshHiBoundaries: "渡島・檜山 振興局境界線",
        layerRailStations: "鉄道駅",
        layerRailLines: "鉄道路線",
        layerMedical: "医療施設 (病院・診療所・歯科・薬局)",
        layerTrash: "ごみ・リサイクル分別ルール",
        layerAvalanche: "雪崩危険区域",
        layerLandslide: "土砂災害危険区域",
        layerSki: "スキー場・冬季レクリエーション"
    }
};

// ==========================================
// SPATIAL DATA TRANSLATION DICTIONARIES
// ==========================================

// 1. All 18 Municipalities in Oshima & Hiyama Subprefectures
export const oshimaHiyamaMunicipalities = {
    // Oshima Subprefecture (渡島総合振興局 - 11 Municipalities)
    "函館市": { EN: "Hakodate City", JA: "函館市" },
    "北斗市": { EN: "Hokuto City", JA: "北斗市" },
    "知内町": { EN: "Shiriuchi Town", JA: "知内町" },
    "木古内町": { EN: "Kikonai Town", JA: "木古内町" },
    "松前町": { EN: "Matsumae Town", JA: "松前町" },
    "福島町": { EN: "Fukushima Town", JA: "福島町" },
    "七飯町": { EN: "Nanae Town", JA: "七飯町" },
    "鹿部町": { EN: "Shikabe Town", JA: "鹿部町" },
    "森町": { EN: "Mori Town", JA: "森町" },
    "八雲町": { EN: "Yakumo Town", JA: "八雲町" },
    "長万部町": { EN: "Oshamambe Town", JA: "長万部町" },

    // Hiyama Subprefecture (檜山振興局 - 7 Municipalities)
    "江差町": { EN: "Esashi Town", JA: "江差町" },
    "上ノ国町": { EN: "Kaminokuni Town", JA: "上ノ国町" },
    "厚沢部町": { EN: "Assabu Town", JA: "厚沢部町" },
    "乙部町": { EN: "Otobe Town", JA: "乙部町" },
    "奥尻町": { EN: "Okushiri Town", JA: "奥尻町" },
    "今金町": { EN: "Imakane Town", JA: "今金町" },
    "せたな町": { EN: "Setana Town", JA: "せたな町" }
};

// 2. Institutional & Infrastructure Facility Suffixes
export const facilitySuffixes = {
    // Police
    "警察署": { EN: " Police Station", JA: "警察署" },
    "交番": { EN: " Police Box (Koban)", JA: "交番" },
    "駐在所": { EN: " Residential Police Box (Chuzaisho)", JA: "駐在所" },
    
    // Schools
    "小学校": { EN: " Elementary School", JA: "小学校" },
    "中学校": { EN: " Junior High School", JA: "中学校" },
    "高等学校": { EN: " High School", JA: "高等学校" },
    "高校": { EN: " High School", JA: "高校" },
    "大学": { EN: " University", JA: "大学" },
    "幼稚園": { EN: " Kindergarten", JA: "幼稚園" },
    
    // Municipal / Government
    "役場": { EN: " Town Hall", JA: "役場" },
    "市役所": { EN: " City Hall", JA: "市役所" },
    "支所": { EN: " Branch Office", JA: "支所" },
    "出張所": { EN: " Liaison Office", JA: "出張所" },
    "公民館": { EN: " Community Center", JA: "公民館" },
    
    // Postal
    "郵便局": { EN: " Post Office", JA: "郵便局" }
};

// 3. Administrative Prefixes & Descriptors
export const adminDescriptors = {
    EN: {
        townPrefix: " Town",
        cityPrefix: " City",
        municipal: "Municipal ",
        prefectural: "Prefectural "
    },
    JA: {
        townPrefix: "町",
        cityPrefix: "市",
        municipal: "町立",
        prefectural: "道立"
    }
};

// Helper function to fetch translation safely
export function t(key, lang = "EN") {
    return translations[lang]?.[key] || translations["EN"][key] || key;
}