// map.js - ForeignHokkaido Core Map Application Engine
import { t, translations } from './localization.js';

let mapInstance = null;
let viewInstance = null;
export let currentSeason = "summer"; // 'summer' | 'winter'
export let currentLang = "EN"; // 'EN' | 'JA'

// Module-scoped layer references for global popup & language updates
// export let snowHazardLayer, oshHiBoundariesLayer, oshHiMuniBoundariesLayer, railwayStationsLayer, medicalLayer, avalancheLayer, landslideLayer, skiResortsLayer;

// Module-scoped layer references for global popup & language updates
export let snowHazardLayer, oshHiBoundariesLayer, oshHiMuniBoundariesLayer, 
           railwayStationsLayer, medicalLayer, avalancheLayer, landslideLayer, 
           skiResortsLayer, evacuationSheltersLayer, municipalOfficesLayer, 
           policeStationsLayer, postOfficesLayer, schoolsLayer, 
           roadsideStationsLayer, wildlifeReservesLayer, gasStationsLayer, 
           busStopsLayer, oshHiTrashLayer, railwayLinesLayer;

           // Function to set language state
export function setLanguage(lang) {
    currentLang = lang;
    return currentLang;
}

// ==========================================
// POPUP TEMPLATES (Module-Scoped)
// ==========================================

const adminPopup = {
    title: "{N03_004}",
    content: [{
        type: "fields",
        fieldInfos: [
            { fieldName: "N03_001", label: "Prefecture (都道府県)" },
            { fieldName: "N03_002", label: "Subprefecture (振興局)" },
            { fieldName: "N03_003", label: "District / County (郡)" },
            { fieldName: "N03_004", label: "Municipality Name (市区町村)" },
            { fieldName: "N03_007", label: "JIS Code" }
        ]
    }]
};

export const subprefecturePopupEN = {
    title: "{expression/subNameEN}",
    content: [{
        type: "text",
        text: `
            <div style="font-size: 13px; line-height: 1.5;">
                <b>Subprefecture:</b> {expression/subNameEN}<br>
                <b>Prefecture:</b> Hokkaido<br>
                <b>Regional Hub:</b> {expression/subHubEN}<br>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 8px 0;">
                <i style="font-size: 11px; color: #555;">{expression/subDescEN}</i>
            </div>
        `
    }],
    expressionInfos: [
        { name: "subNameEN", expression: "var s = $feature.N03_002; if (Find('渡島', s) != -1) return 'Oshima Subprefecture'; if (Find('檜山', s) != -1) return 'Hiyama Subprefecture'; return s;" },
        { name: "subHubEN", expression: "var s = $feature.N03_002; if (Find('渡島', s) != -1) return 'Hakodate City'; if (Find('檜山', s) != -1) return 'Esashi Town'; return 'Sapporo City';" },
        { name: "subDescEN", expression: "var s = $feature.N03_002; if (Find('渡島', s) != -1) return 'Oshima Subprefecture encompasses 11 municipalities centered around Hakodate.'; if (Find('檜山', s) != -1) return 'Hiyama Subprefecture encompasses 7 municipalities along the southwestern coast and Okushiri Island.'; return '';" }
    ]
};

export const subprefecturePopupJA = {
    title: "{N03_002}",
    content: [{
        type: "text",
        text: `
            <div style="font-size: 13px; line-height: 1.5;">
                <b>振興局:</b> {N03_002}<br>
                <b>都道府県:</b> 北海道<br>
                <b>振興局所在地:</b> {expression/subHubJA}<br>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 8px 0;">
                <i style="font-size: 11px; color: #555;">{expression/subDescJA}</i>
            </div>
        `
    }],
    expressionInfos: [
        { name: "subHubJA", expression: "var s = $feature.N03_002; if (Find('渡島', s) != -1) return '函館市'; if (Find('檜山', s) != -1) return '江差町'; return '札幌市';" },
        { name: "subDescJA", expression: "var s = $feature.N03_002; if (Find('渡島', s) != -1) return '渡島総合振興局は函館市を中心に11市町で構成されています。'; if (Find('檜山', s) != -1) return '檜山振興局は日本海沿岸部および奥尻島を含む7町で構成されています。'; return '';" }
    ]
};

export const municipalBoundaryPopupEN = {
    title: "{expression/muniNameEN}",
    content: [{
        type: "text",
        text: `
            <div style="font-size: 13px; line-height: 1.6;">
                <b>Municipality:</b> {expression/muniNameEN}<br>
                <b>Subprefecture:</b> {expression/subNameEN}<br>
                <b>District / County:</b> {expression/districtEN}<br>
                <b>JIS Code:</b> {N03_007}
            </div>
        `
    }],
    expressionInfos: [
        {
            name: "muniNameEN",
            expression: `
                var m = $feature.N03_004;
                return Decode(m,
                    '函館市', 'Hakodate City', '北斗市', 'Hokuto City', '松前町', 'Matsumae Town',
                    '福島町', 'Fukushima Town', '知内町', 'Shiriuchi Town', '木古内町', 'Kikonai Town',
                    '七飯町', 'Nanae Town', '鹿部町', 'Shikabe Town', '森町', 'Mori Town',
                    '八雲町', 'Yakumo Town', '長万部町', 'Oshamambe Town', '江差町', 'Esashi Town',
                    '上ノ国町', 'Kaminokuni Town', '厚沢部町', 'Assabu Town', '乙部町', 'Otobe Town',
                    '奥尻町', 'Okushiri Town', '今金町', 'Imakane Town', 'せたな町', 'Setana Town', m
                );
            `
        },
        { name: "subNameEN", expression: "var s = $feature.N03_002; if (Find('渡島', s) != -1) return 'Oshima Subprefecture'; if (Find('檜山', s) != -1) return 'Hiyama Subprefecture'; return s;" },
        {
            name: "districtEN",
            expression: `
                var d = $feature.N03_003;
                if (IsEmpty(d) || Trim(Text(d)) == '' || Text(d) == 'null') return 'Independent City';
                return Decode(d,
                    '松前郡', 'Matsumae District', '上磯郡', 'Kamiiso District', '亀田郡', 'Kameda District',
                    '茅部郡', 'Kayabe District', '山越郡', 'Yamakoshi District', '檜山郡', 'Hiyama District',
                    '爾志郡', 'Nishi District', '奥尻郡', 'Okushiri District', '瀬棚郡', 'Setana District',
                    '久遠郡', 'Kudo District', d
                );
            `
        }
    ]
};

export const municipalBoundaryPopupJA = {
    title: "{N03_004}",
    content: [{
        type: "text",
        text: `
            <div style="font-size: 13px; line-height: 1.6;">
                <b>市区町村:</b> {N03_004}<br>
                <b>振興局:</b> {N03_002}<br>
                <b>郡:</b> {expression/districtJA}<br>
                <b>全国地方公共団体コード:</b> {N03_007}
            </div>
        `
    }],
    expressionInfos: [{
        name: "districtJA",
        expression: "var d = $feature.N03_003; if (IsEmpty(d) || Trim(Text(d)) == '' || Text(d) == 'null') return '市部 (指定なし)'; return d;"
    }]
};

export const municipalOfficePopupEN = {
    title: "🏛️ {expression/facNameEN}",
    content: [{
        type: "text",
        text: `
            <div style="font-family: system-ui, sans-serif; line-height: 1.5; font-size: 13px;">
                <b>What you can do here:</b><br>
                <p style="margin: 4px 0 8px 0; color: #333; line-height: 1.4;">
                    {expression/facDescEN}
                </p>
                <b>Address:</b> {P05_004}<br>
                <i style="font-size: 11px; color: #666; display: block; margin-top: 4px;">
                    💡 Address (only available in Japanese)
                </i>
            </div>
        `
    }],
    expressionInfos: [
        {
            name: "facNameEN",
            expression: `
                var code = Text($feature.P05_002);
                if (code == '1') { return 'Town / City Hall'; }
                if (code == '2') { return 'Branch & Liaison Office'; }
                if (code == '4') { return 'Public Community Center'; }
                return 'Municipal Facility';
            `
        },
        {
            name: "facDescEN",
            expression: `
                var code = Text($feature.P05_002);
                if (code == '1') {
                    return 'Main municipal headquarters. Handle residence registration (Juminhyo), My Number card setup, National Health Insurance, local taxes, and official certificate issuance.';
                } else if (code == '2') {
                    return 'Local administrative branch office. Convenient for routine certificate issuance and minor municipal paperwork closer to your neighborhood without visiting the main hall.';
                } else if (code == '4') {
                    return 'Public community gathering facility (Kouminkan). Used for local Japanese classes, cultural clubs, town meetings, and community events.';
                }
                return 'General municipal service location.';
            `
        }
    ]
};

export const municipalOfficePopupJA = {
    title: "🏛️ {expression/facNameJA}",
    content: [{
        type: "text",
        text: `
            <div style="font-family: sans-serif; line-height: 1.5; font-size: 13px;">
                <b>主な利用目的:</b><br>
                <p style="margin: 4px 0 8px 0; color: #333; line-height: 1.4;">
                    {expression/facDescJA}
                </p>
                <b>所在地:</b> {P05_004}
            </div>
        `
    }],
    expressionInfos: [
        {
            name: "facNameJA",
            expression: `
                var code = Text($feature.P05_002);
                if (code == '1') { return '役場・市役所'; }
                if (code == '2') { return '支所・出張所'; }
                if (code == '4') { return '公立公民館'; }
                return '行政施設';
            `
        },
        {
            name: "facDescJA",
            expression: `
                var code = Text($feature.P05_002);
                if (code == '1') {
                    return '住民登録、マイナンバー、国民健康保険、税金手続き、各種証明書の発行を行う本庁舎です。';
                } else if (code == '2') {
                    return '証明書の交付や地域の行政手続きを行う身近な支所・出張所です。';
                } else if (code == '4') {
                    return '地域の集会、講座、サークル活動などに利用される公立公民館です。';
                }
                return '地域の公共施設です。';
            `
        }
    ]
};

export const policePopupEN = {
    title: "👮 {expression/policeTitleEN}",
    content: [{
        type: "text",
        text: `
            <div style="font-family: system-ui, sans-serif; line-height: 1.5; font-size: 13px;">
                <b>What you can do here:</b><br>
                <p style="margin: 4px 0 8px 0; color: #333; line-height: 1.4;">
                    {expression/policeDescEN}
                </p>
                <b>Address:</b> {P18_004}<br>
                <i style="font-size: 11px; color: #666; display: block; margin-top: 4px;">
                    💡 Address (only available in Japanese)
                </i>
            </div>
        `
    }],
    expressionInfos: [
        {
            name: "policeTitleEN",
            expression: `
                var raw = $feature.P18_001;
                var code = $feature.P18_003;
                if (IsEmpty(raw)) { raw = ""; }
                
                if (code == 1 || code == '1') { return 'Prefectural Police Headquarters'; }
                if (code == 2 || code == '2' || (Find('警察署', raw) > -1 && Find('交番', raw) == -1 && Find('駐在所', raw) == -1)) { return 'Main Police Station'; }
                if (code == 3 || code == '3') { return 'Police Sub-station'; }
                if (code == 4 || code == '4' || Find('交番', raw) > -1) { return 'Police Box (Koban)'; }
                if (code == 5 || code == '5' || Find('駐在所', raw) > -1) { return 'Residential Police Box (Chuzaisho)'; }
                
                return 'Police Facility';
            `
        },
        {
            name: "policeDescEN",
            expression: `
                var raw = $feature.P18_001;
                var code = $feature.P18_003;
                if (IsEmpty(raw)) { raw = ""; }

                if (code == 4 || code == '4' || Find('交番', raw) > -1) {
                    return "Urban police box (Koban). Go here to report lost or found items, ask for walking directions, or seek immediate local emergency aid.";
                }
                if (code == 5 || code == '5' || Find('駐在所', raw) > -1) {
                    return "Rural residential police box (Chuzaisho) where a resident officer lives and patrols. Go here for local lost and found, community safety concerns, or neighborhood emergencies.";
                }
                if (code == 3 || code == '3') {
                    return "Regional police branch office providing administrative police services and local emergency response.";
                }
                if (code == 1 || code == '1' || code == 2 || code == '2' || Find('警察署', raw) > -1) {
                    return "Full-service police headquarters. Visit here for criminal matters, filing formal crime/lost property reports, updating driver's licenses, and obtaining official certificates.";
                }

                return "Police facility for local safety, reporting lost items, and emergency assistance.";
            `
        }
    ]
};

export const policePopupJA = {
    title: "👮 {expression/policeTitleJA}",
    content: [{
        type: "text",
        text: `
            <div style="font-family: sans-serif; line-height: 1.5; font-size: 13px;">
                <b>主な利用目的:</b><br>
                <p style="margin: 4px 0 8px 0; color: #333; line-height: 1.4;">
                    {expression/policeDescJA}
                </p>
                <b>所在地:</b> {P18_004}
            </div>
        `
    }],
    expressionInfos: [
        {
            name: "policeTitleJA",
            expression: `
                var raw = $feature.P18_001;
                var code = $feature.P18_003;
                if (IsEmpty(raw)) { raw = ""; }
                
                if (code == 1 || code == '1') { return '北海道警察本部'; }
                if (code == 2 || code == '2' || (Find('警察署', raw) > -1 && Find('交番', raw) == -1 && Find('駐在所', raw) == -1)) { return '警察署'; }
                if (code == 3 || code == '3') { return '分庁舎'; }
                if (code == 4 || code == '4' || Find('交番', raw) > -1) { return '交番'; }
                if (code == 5 || code == '5' || Find('駐在所', raw) > -1) { return '駐在所'; }
                
                return '警察施設';
            `
        },
        {
            name: "policeDescJA",
            expression: `
                var raw = $feature.P18_001;
                var code = $feature.P18_003;
                if (IsEmpty(raw)) { raw = ""; }

                if (code == 4 || code == '4' || Find('交番', raw) > -1) {
                    return "街頭の警察拠点（交番）です。道案内、落とし物の届出、緊急時の初期対応を行います。";
                }
                if (code == 5 || code == '5' || Find('駐在所', raw) > -1) {
                    return "地域密着型の駐在所です。地域の防犯巡回、道案内、落とし物の届出、緊急時の初期対応を行います。";
                }
                if (code == 3 || code == '3') {
                    return "地域警察の分庁舎です。行政手続きや地域の安全窓口として機能しています。";
                }
                if (code == 1 || code == '1' || code == 2 || code == '2' || Find('警察署', raw) > -1) {
                    return "警察の総合庁舎です。事件・事故の届出、落とし物の捜索・届出、運転免許手続きなどの窓口業務を行っています。";
                }

                return "地域の安全・防犯・緊急対応を行う警察施設です。";
            `
        }
    ]
};

const postOfficePopup = {
    title: "{P30_005}",
    content: [{ type: "text", text: "<b>Address:</b> {P30_006}<br><b>Type:</b> {expression/poType}" }],
    expressionInfos: [{
        name: "poType",
        title: "Post Office Classification",
        expression: `
            When(
                $feature.P30_004 == '18004', 'Simple Post Office (簡易郵便局)',
                $feature.P30_004 == '18006', 'Direct Post Office (直営郵便局)',
                'Post Office'
            )
        `
    }]
};

const schoolPopup = {
    title: "{P29_004}",
    content: [{ type: "text", text: "<b>Address:</b> {P29_005}<br><b>Level:</b> {expression/schoolType}" }],
    expressionInfos: [{
        name: "schoolType",
        title: "School Category",
        expression: `
            When(
                $feature.P29_003 == '16001', 'Elementary School (小学校)',
                $feature.P29_003 == '16002', 'Junior High School (中学校)',
                $feature.P29_003 == '16004', 'High School (高等学校)',
                $feature.P29_003 == '16005', 'College of Technology (高専)',
                $feature.P29_003 == '16007', 'University (大学)',
                $feature.P29_003 == '16011', 'Kindergarten (幼稚園)',
                $feature.P29_003 == '16012', 'Special Needs School (特別支援学校)',
                'Educational Facility'
            )
        `
    }]
};

const roadsidePopup = {
    title: "Michi-no-Eki: {P35_006}",
    content: [{
        type: "text",
        text: `
            <b>Municipality:</b> {P35_004}<br>
            <b>Website:</b> <a href="{P35_007}" target="_blank">Visit Official Page</a><br><br>
            <b>Available Amenities:</b><br>
            • 🏪 Shops: {expression/hasShop}<br>
            • 🍱 Restaurant/Café: {expression/hasFood}<br>
            • ♨️ Hot Springs: {expression/hasOnsen}<br>
            • 🛜 Public Wi-Fi: {expression/hasWifi}<br>
            • ⚡ EV Charging: {expression/hasEV}<br>
            • 🏧 ATM: {expression/hasATM}
        `
    }],
    expressionInfos: [
        { name: "hasShop", expression: "IIF($feature.P35_028 == 1, 'Yes', 'No')" },
        { name: "hasFood", expression: "IIF($feature.P35_013 == 1 || $feature.P35_014 == 1, 'Yes', 'No')" },
        { name: "hasOnsen", expression: "IIF($feature.P35_016 == 1, 'Yes', 'No')" },
        { name: "hasWifi", expression: "IIF($feature.P35_023 == 1, 'Yes', 'No')" },
        { name: "hasEV", expression: "IIF($feature.P35_022 == 1, 'Yes', 'No')" },
        { name: "hasATM", expression: "IIF($feature.P35_011 == 1, 'Yes', 'No')" }
    ]
};

export const shelterPopupEN = {
    title: "🛡️ {P20_002}",
    content: [{
        type: "text",
        text: `
            <div style="font-family: system-ui, sans-serif; line-height: 1.5; font-size: 13px;">
                <b>Facility Type:</b> {P20_004}<br>
                <b>Address:</b> {P20_003}<br>
                <b>Designated Capacity:</b> {expression/fmtCapacityEN}<br>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 8px 0 6px 0;">
                <b>Designated Hazard Suitability:</b><br>
                • 🏚️ Earthquake: {expression/eqEN}<br>
                • 🌊 Tsunami: {expression/tsuEN}<br>
                • 🌧️ Flood / Storm Surge: {expression/fldEN}<br>
                • 🌋 Volcanic Activity: {expression/volEN}<br>
                • ⛰️ Landslide / Mudflow: {expression/lsEN}
            </div>
        `
    }],
    expressionInfos: [
        { name: "fmtCapacityEN", expression: "var c = $feature.P20_005; if (IsEmpty(c) || Number(c) <= 0) return 'Unspecified'; return Text(c, '#,###') + ' persons';" },
        { name: "eqEN", expression: "IIF($feature.P20_007 == 1 || Text($feature.P20_007) == 'true', '✅ Designated Safe', '❌ Not Designated')" },
        { name: "tsuEN", expression: "IIF($feature.P20_008 == 1 || Text($feature.P20_008) == 'true', '✅ Designated Safe', '❌ Not Designated')" },
        { name: "fldEN", expression: "IIF($feature.P20_009 == 1 || Text($feature.P20_009) == 'true', '✅ Designated Safe', '❌ Not Designated')" },
        { name: "volEN", expression: "IIF($feature.P20_010 == 1 || Text($feature.P20_010) == 'true', '✅ Designated Safe', '❌ Not Designated')" },
        { name: "lsEN", expression: "IIF($feature.P20_011 == 1 || Text($feature.P20_011) == 'true', '✅ Designated Safe', '❌ Not Designated')" }
    ]
};

export const shelterPopupJA = {
    title: "🛡️ {P20_002}",
    content: [{
        type: "text",
        text: `
            <div style="font-family: sans-serif; line-height: 1.5; font-size: 13px;">
                <b>施設種別:</b> {P20_004}<br>
                <b>所在地:</b> {P20_003}<br>
                <b>想定収容人数:</b> {expression/fmtCapacityJA}<br>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 8px 0 6px 0;">
                <b>指定災害種別:</b><br>
                • 🏚️ 地震: {expression/eqJA}<br>
                • 🌊 津波: {expression/tsuJA}<br>
                • 🌧️ 洪水・高潮: {expression/fldJA}<br>
                • 🌋 火山現象: {expression/volJA}<br>
                • ⛰️ 土砂災害: {expression/lsJA}
            </div>
        `
    }],
    expressionInfos: [
        { name: "fmtCapacityJA", expression: "var c = $feature.P20_005; if (IsEmpty(c) || Number(c) <= 0) return '未定・記載なし'; return Text(c, '#,###') + ' 人';" },
        { name: "eqJA", expression: "IIF($feature.P20_007 == 1 || Text($feature.P20_007) == 'true', '✅ 対応', '❌ 非対応')" },
        { name: "tsuJA", expression: "IIF($feature.P20_008 == 1 || Text($feature.P20_008) == 'true', '✅ 対応', '❌ 非対応')" },
        { name: "fldJA", expression: "IIF($feature.P20_009 == 1 || Text($feature.P20_009) == 'true', '✅ 対応', '❌ 非対応')" },
        { name: "volJA", expression: "IIF($feature.P20_010 == 1 || Text($feature.P20_010) == 'true', '✅ 対応', '❌ 非対応')" },
        { name: "lsJA", expression: "IIF($feature.P20_011 == 1 || Text($feature.P20_011) == 'true', '✅ 対応', '❌ 非対応')" }
    ]
};

const trashPopupTemplate = {
    title: "{市町村} Garbage & Recycling Guide",
    content: [{
        type: "text",
        text: `
            <div style="font-family: system-ui, sans-serif; line-height: 1.5; font-size: 13px;">
                <div style="background-color: #f4f4f5; padding: 6px 8px; border-radius: 4px; margin-bottom: 8px;">
                    <b>⚠️ Schedule Note:</b> Collection days vary by district (地区). Check your neighborhood calendar PDF via the link below.
                </div>
                <b>🔥 Burnable Waste (燃やせるごみ)</b><br>
                🗓️ <b>Days:</b> {burnable_schedule}<br>
                ℹ️ <i>{burnable_rules}</i><br><br>
                <b>♻️ Plastic Containers (プラ)</b><br>
                🗓️ <b>Days:</b> {plastic_schedule}<br>
                ℹ️ <i>{plastic_rules}</i><br><br>
                <b>🍾 Recyclables (Cans/Bottles/PET)</b><br>
                🗓️ <b>Days:</b> {recyclable_schedule}<br>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 8px 0;">
                <b>🔗 Official District Calendars:</b> <a href="{trash_url}" target="_blank">Town Website / PDF Guide</a>
            </div>
        `
    }]
};

export const snowHazardPopupEN = {
    title: "{A22_100004}",
    content: [{
        type: "text",
        text: `
            <b>Municipality:</b> {A22_100004}<br>
            <b>Snow Hazard Designation:</b> {expression/hazardTextEN}<br>
            <i style="font-size: 11px; color: #555;">({expression/hazardDescEN})</i>
            <hr>
            <b>Historical Climate Averages:</b><br>
            <ul>
                <li><b>Avg Min Temperature:</b> {expression/fmtTempEN}</li>
                <li><b>Avg Total Snowfall:</b> {expression/fmtSnowEN}</li>
                <li><b>Avg Max Snow Depth:</b> {expression/fmtDepthEN}</li>
            </ul>
        `
    }],
    expressionInfos: [
        { name: "fmtTempEN", expression: "var v = $feature.AvgMinTemp; if (IsEmpty(v) || Trim(Text(v)) == '' || Text(v) == 'null' || Number(v) == 99999999) return 'No Historical Statistics Available'; return Text(Round(Number(v), 1)) + ' °C';" },
        { name: "fmtSnowEN", expression: "var v = $feature.AvgTotSnow; if (IsEmpty(v) || Trim(Text(v)) == '' || Text(v) == 'null' || Number(v) == 99999999) return 'No Historical Statistics Available'; return Text(Round(Number(v), 1)) + ' cm';" },
        { name: "fmtDepthEN", expression: "var v = $feature.AvgMaxDept; if (IsEmpty(v) || Trim(Text(v)) == '' || Text(v) == 'null' || Number(v) == 99999999) return 'No Historical Statistics Available'; return Text(Round(Number(v), 1)) + ' cm';" },
        { name: "hazardTextEN", expression: "var code = $feature.A22_100005; if (code == '1' || code == 1) return 'Special Heavy Snow Zone (Class 1)'; if (code == '2' || code == 2) return 'Heavy Snow Zone (Class 2)'; if (code == '9' || code == 9) return 'Registered Snow Area (Class 9)'; return 'Standard Regional Zone (Unclassified)';" },
        { name: "hazardDescEN", expression: "var code = $feature.A22_100005; if (code == '1' || code == 1) return 'Severe winter risks; eligible for statutory national snow removal funding.'; return 'High snow accumulation zone requiring active local road clearing.';" }
    ]
};

export const snowHazardPopupJA = {
    title: "{A22_100004}",
    content: [{
        type: "text",
        text: `
            <b>自治体名:</b> {A22_100004}<br>
            <b>雪害指定区分:</b> {expression/hazardTextJA}<br>
            <i style="font-size: 11px; color: #555;">({expression/hazardDescJA})</i>
            <hr>
            <b>気候平均値:</b><br>
            <ul>
                <li><b>平均最低気温:</b> {expression/fmtTempJA}</li>
                <li><b>平均年間降雪量:</b> {expression/fmtSnowJA}</li>
                <li><b>平均最大積雪深:</b> {expression/fmtDepthJA}</li>
            </ul>
        `
    }],
    expressionInfos: [
        { name: "fmtTempJA", expression: "var v = $feature.AvgMinTemp; if (IsEmpty(v) || Text(v) == '' || v == 99999999) return '過去の統計データなし'; return Text(Round(Number(v), 1)) + ' °C';" },
        { name: "fmtSnowJA", expression: "var v = $feature.AvgTotSnow; if (IsEmpty(v) || Text(v) == '' || v == 99999999) return '過去の統計データなし'; return Text(Round(Number(v), 1)) + ' cm';" },
        { name: "fmtDepthJA", expression: "var v = $feature.AvgMaxDept; if (IsEmpty(v) || Text(v) == '' || v == 99999999) return '過去の統計データなし'; return Text(Round(Number(v), 1)) + ' cm';" },
        { name: "hazardTextJA", expression: "var code = $feature.A22_100005; if (code == '1' || code == 1) return '特別豪雪地帯（第1類）'; if (code == '2' || code == 2) return '豪雪地帯（第2類）'; return '一般豪雪地域';" },
        { name: "hazardDescJA", expression: "var code = $feature.A22_100005; if (code == '1' || code == 1) return '特別防除・除雪補助が手厚く指定される最極甚地域。'; return '積雪が多く、定期的な除雪・交通対策が法律上義務付けられている地域。';" }
    ]
};

export const stationPopupEN = {
    title: "{N02_005} Station",
    content: [{
        type: "text",
        text: `
            <div style="font-family: system-ui, sans-serif; line-height: 1.5; font-size: 14px;">
                <p style="margin: 0 0 8px 0;"><strong>Station Name:</strong> {N02_005} ({N02_005}駅)</p>
                <p style="margin: 0 0 8px 0;"><strong>Railway Line:</strong> {expression/line_en} ({N02_003})</p>
                <p style="margin: 0 0 8px 0;"><strong>Operator:</strong> {expression/operator_en} ({N02_004})</p>
                <p style="margin: 0;"><strong>Service Category:</strong> {expression/service_type}</p>
            </div>
        `
    }],
    expressionInfos: [
        { name: "line_en", expression: "var line = $feature.N02_003; return Decode(line, '北海道新幹線', 'Hokkaido Shinkansen', '道南いさりび鉄道線', 'South Hokkaido Railway Line', '函館本線', 'Hakodate Main Line', line);" },
        { name: "operator_en", expression: "var op = $feature.N02_004; return Decode(op, '北海道旅客鉄道', 'JR Hokkaido', '道南いさりび鉄道', 'South Hokkaido Railway Co., Ltd.', '函館市企業局交通部', 'Hakodate City Tram', op);" },
        { name: "service_type", expression: "var line = $feature.N02_003; if (line == '北海道新幹線') return '🚅 High-Speed Bullet Train'; if (line == '函館市企業局交通部') return '🚃 City Tram'; return '🚆 Local / Regional Passenger Train';" }
    ]
};

export const stationPopupJA = {
    title: "{N02_005}駅",
    content: [{
        type: "text",
        text: `
            <div style="font-family: sans-serif; line-height: 1.5;">
                <p style="margin: 0 0 8px 0;"><strong>駅名：</strong> {N02_005}駅</p>
                <p style="margin: 0 0 8px 0;"><strong>路線名：</strong> {N02_003}</p>
                <p style="margin: 0 0 8px 0;"><strong>運行会社：</strong> {N02_004}</p>
                <p style="margin: 0;"><strong>種別：</strong> {expression/service_type_ja}</p>
            </div>
        `
    }],
    expressionInfos: [{
        name: "service_type_ja",
        expression: "var line = $feature.N02_003; if (line == '北海道新幹線') return '🚅 新幹線'; if (line == '函館市企業局交通部') return '🚃 市電'; return '🚆 在来線・ローカル線';"
    }]
};

export const medicalPopupEN = {
    title: "{expression/popupTitleEN}",
    content: [{
        type: "text",
        text: `
            <div style="font-family: system-ui, sans-serif; line-height: 1.5; font-size: 13px;">
                <b>Facility Type:</b> {facility_type}<br>
                <b>Address:</b> {所在地} ({郵便番号})<br>
                <i style="color: #666; font-size: 11px; display: block; margin-bottom: 4px;"><b>Romaji Address:</b> {address_romaji}</i>
                <b>Phone:</b> <a href="tel:{電話番号}">{電話番号}</a><br>
                <b>Departments:</b> {expression/translatedDepts}
                <hr style="border: none; border-top: 1px solid #ddd; margin: 8px 0 6px 0;">
                <b>Support Status:</b> {expression/multiBadge}<br>
                {expression/hoursBlock}
                {expression/langsBlock}
                {expression/websiteBlock}
            </div>
        `
    }],
    expressionInfos: [
        { name: "popupTitleEN", expression: "var en = $feature.name_en; var romaji = $feature.name_romaji; var jp = $feature.名称; if (!IsEmpty(en) && en != 'null' && en != '') return en; if (!IsEmpty(romaji) && romaji != 'null' && romaji != '') return romaji; return jp;" },
        { name: "multiBadge", expression: "var isMulti = $feature.is_multilingual; if (!IsEmpty(isMulti) && (isMulti == true || Text(isMulti) == 'true' || isMulti == 1)) return '🌟 Multilingual Verified (English support available)'; return 'Standard Local Facility — Japanese language primary.';" },
        {
            name: "translatedDepts",
            expression: `
                var depts = Text($feature.診療科目);
                if (IsEmpty(depts) || depts == 'null' || depts == '') return 'General Practice / Unspecified';
                depts = Replace(depts, '内科', 'Internal Medicine');
                depts = Replace(depts, '外科', 'Surgery');
                depts = Replace(depts, '小児科', 'Pediatrics');
                depts = Replace(depts, '整形外科', 'Orthopedic Surgery');
                depts = Replace(depts, '皮膚科', 'Dermatology');
                depts = Replace(depts, '眼科', 'Ophthalmology');
                depts = Replace(depts, '歯科', 'Dentistry');
                depts = Replace(depts, '精神科', 'Psychiatry');
                return depts;
            `
        },
        { name: "hoursBlock", expression: "var h = $feature.reception_hours; if (IsEmpty(h) || h == 'null' || h == '') return ''; return '<b>Reception Hours:</b> ' + h + '<br>';" },
        { name: "langsBlock", expression: "var l = $feature.departments_languages; if (IsEmpty(l) || l == 'null' || l == '') return ''; return '<b>Supported Languages:</b> ' + l + '<br>';" },
        { name: "websiteBlock", expression: "var w = $feature.website; if (IsEmpty(w) || w == 'null' || w == '') return ''; return '<b>Website:</b> <a href=\"' + w + '\" target=\"_blank\">Official Website</a><br>';" }
    ]
};

export const medicalPopupJA = {
    title: "{名称}",
    content: [{
        type: "text",
        text: `
            <div style="font-family: sans-serif; line-height: 1.5; font-size: 13px;">
                <b>施設種別:</b> {expression/jpFacilityType}<br>
                <b>所在地:</b> 〒{郵便番号} {所在地}<br>
                <b>電話番号:</b> <a href="tel:{電話番号}">{電話番号}</a><br>
                <b>診療科目:</b> {診療科目}<br>
                <b>病床数:</b> {病床数} 床<br>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 6px 0;">
                <b>対応状況:</b> {expression/multiBadgeJA}<br>
                {expression/hoursBlockJA}
                {expression/langsBlockJA}
                {expression/websiteBlockJA}
            </div>
        `
    }],
    expressionInfos: [
        { name: "jpFacilityType", expression: "Decode($feature.facility_type, 'Hospital', '病院', 'Clinic', '診療所', 'Dental', '歯科', 'Pharmacy', '薬局', $feature.facility_type)" },
        { name: "multiBadgeJA", expression: "var isMulti = $feature.is_multilingual; if (isMulti == true || Text(isMulti) == 'true' || isMulti == 1) return '🌟 多言語対応・外国語サポートあり'; return '一般地域医療機関（日本語対応メイン）。';" },
        { name: "hoursBlockJA", expression: "var h = $feature.reception_hours; if (IsEmpty(h) || h == 'null' || h == '') return ''; return '<b>受付時間:</b> ' + h + '<br>';" },
        { name: "langsBlockJA", expression: "var l = $feature.departments_languages; if (IsEmpty(l) || l == 'null' || l == '') return ''; return '<b>対応言語:</b> ' + l + '<br>';" },
        { name: "websiteBlockJA", expression: "var w = $feature.website; if (IsEmpty(w) || w == 'null' || w == '') return ''; return '<b>公式サイト:</b> <a href=\"' + w + '\" target=\"_blank\">リンクを開く</a><br>';" }
    ]
};

export const avalanchePopupEN = {
    title: "{hazard_type_en}",
    content: [{
        type: "text",
        text: `
            <div style="font-family: system-ui, sans-serif; font-size: 13px; line-height: 1.5;">
                <b>📍 Location:</b> {expression/muniEN} {字} ({地区名} District)<br>
                <b>🆔 Site ID:</b> {箇所番号}<br>
                <hr style="border: none; border-top: 1px solid #ccc; margin: 8px 0;">
                <b>❄️ Winter Safety Notice:</b> Exercise increased awareness along steep roadways and mountain passes during heavy winter snowfall and rapid spring thaws.<br>
                <small style="color: gray; display: block; margin-top: 6px;">Source: {source_attr}</small>
            </div>
        `
    }],
    expressionInfos: [{
        name: "muniEN",
        expression: "var m = $feature.市町村; return Decode(m, '函館市', 'Hakodate City', '北斗市', 'Hokuto City', '松前町', 'Matsumae Town', '福島町', 'Fukushima Town', '知内町', 'Shiriuchi Town', '木古内町', 'Kikonai Town', '七飯町', 'Nanae Town', '鹿部町', 'Shikabe Town', '森町', 'Mori Town', '八雲町', 'Yakumo Town', '長万部町', 'Oshamambe Town', '江差町', 'Esashi Town', '上ノ国町', 'Kaminokuni Town', '厚沢部町', 'Assabu Town', '乙部町', 'Otobe Town', '奥尻町', 'Okushiri Town', '今金町', 'Imakane Town', 'せたな町', 'Setana Town', m);"
    }]
};

export const avalanchePopupJA = {
    title: "{hazard_type_jp} ({hazard_type_en})",
    content: [{
        type: "text",
        text: `
            <div style="font-family: sans-serif; font-size: 13px; line-height: 1.5;">
                <b>📍 場所:</b> {市町村} {字} ({地区名} 地区)<br>
                <b>🆔 箇所番号:</b> {箇所番号}<br>
                <hr style="border: none; border-top: 1px solid #ccc; margin: 8px 0;">
                <b>❄️ 冬季安全注意:</b> 冬季の降雪、吹雪、急速な雪解けの時期には、急傾斜地や山間道路での雪崩に十分ご注意ください。<br>
                <small style="color: gray; display: block; margin-top: 6px;">出典: {source_attr}</small>
            </div>
        `
    }]
};

export const landslidePopupEN = {
    title: "{hazard_type_en}",
    content: [{
        type: "text",
        text: `
            <div style="font-family: system-ui, sans-serif; font-size: 13px; line-height: 1.5;">
                <b>📍 Location:</b> {expression/muniEN} {字} ({地区名} District)<br>
                <b>🆔 Site ID:</b> {箇所番号}<br>
                <hr style="border: none; border-top: 1px solid #ccc; margin: 8px 0;">
                <b>🌧️ Landslide Safety Notice:</b> Exercise caution and monitor weather alerts during heavy rainfall, typhoon seasons, and spring snowmelt.<br>
                <small style="color: gray; display: block; margin-top: 6px;">Source: {source_attr}</small>
            </div>
        `
    }],
    expressionInfos: [{
        name: "muniEN",
        expression: "var m = $feature.市町村; return Decode(m, '函館市', 'Hakodate City', '北斗市', 'Hokuto City', '松前町', 'Matsumae Town', '福島町', 'Fukushima Town', '知内町', 'Shiriuchi Town', '木古内町', 'Kikonai Town', '七飯町', 'Nanae Town', '鹿部町', 'Shikabe Town', '森町', 'Mori Town', '八雲町', 'Yakumo Town', '長万部町', 'Oshamambe Town', '江差町', 'Esashi Town', '上ノ国町', 'Kaminokuni Town', '厚沢部町', 'Assabu Town', '乙部町', 'Otobe Town', '奥尻町', 'Okushiri Town', '今金町', 'Imakane Town', 'せたな町', 'Setana Town', m);"
    }]
};

export const landslidePopupJA = {
    title: "{hazard_type_jp} ({hazard_type_en})",
    content: [{
        type: "text",
        text: `
            <div style="font-family: sans-serif; font-size: 13px; line-height: 1.5;">
                <b>📍 場所:</b> {市町村} {字} ({地区名} 地区)<br>
                <b>🆔 箇所番号:</b> {箇所番号}<br>
                <hr style="border: none; border-top: 1px solid #ccc; margin: 8px 0;">
                <b>🌧️ 警戒注意:</b> 集中豪雨、台風シーズン、および春先の雪解けの時期には、地すべりや土砂崩れへの警戒が必要です。<br>
                <small style="color: gray; display: block; margin-top: 6px;">出典: {source_attr}</small>
            </div>
        `
    }]
};

export const skiPopupEN = {
    title: "⛷️ {name_en}",
    content: `
        <b>Subprefecture:</b> {subprefecture}<br>
        <b>Municipality:</b> {municipality}<br>
        <b>Key Features:</b> {key_features}<br>
        <b>Lifts & Facilities:</b> {lifts}
    `
};

export const skiPopupJA = {
    title: "⛷️ {name_ja}",
    content: `
        <b>振興局:</b> {subprefecture_ja}<br>
        <b>自治体:</b> {municipality_ja}<br>
        <b>特徴:</b> {key_features_ja}<br>
        <b>リフト・設備:</b> {lifts_ja}
    `
};

// ==========================================
// INIT MAP FUNCTION
// ==========================================

export function initMap(viewContainerId, apiKey) {
    return new Promise((resolve, reject) => {
        require([
            "esri/config", 
            "esri/Map", 
            "esri/views/MapView",  
            "esri/layers/FeatureLayer",
            "esri/layers/GeoJSONLayer",
            "esri/geometry/geometryEngine",
            "esri/widgets/Legend",
            "esri/widgets/Expand",
            "esri/widgets/Zoom",
        ], (
            esriConfig, 
            Map, 
            MapView, 
            FeatureLayer, 
            GeoJSONLayer,
            geometryEngine, 
            Legend, 
            Expand, 
            Zoom
        ) => {
            
            try {
                if (apiKey) esriConfig.apiKey = apiKey;

                // Renderers
                const medicalRenderer = {
                    type: "unique-value",
                    field: "facility_type",
                    defaultSymbol: { type: "simple-marker", color: [120, 120, 120, 0.8], size: "8px", outline: { color: [255, 255, 255, 1], width: 1 } },
                    uniqueValueInfos: [
                        { value: "Hospital", symbol: { type: "simple-marker", color: [215, 48, 39, 0.9], size: "12px", outline: { color: [255, 255, 255, 1], width: 1.5 } }, label: "Hospital (病院)" },
                        { value: "Clinic", symbol: { type: "simple-marker", color: [65, 171, 93, 0.9], size: "10px", outline: { color: [255, 255, 255, 1], width: 1 } }, label: "Clinic (診療所)" },
                        { value: "Dental", symbol: { type: "simple-marker", color: [43, 131, 186, 0.9], size: "9px", outline: { color: [255, 255, 255, 1], width: 1 } }, label: "Dental Clinic (歯科)" },
                        { value: "Pharmacy", symbol: { type: "simple-marker", color: [253, 174, 97, 0.9], size: "9px", outline: { color: [255, 255, 255, 1], width: 1 } }, label: "Pharmacy (薬局)" }
                    ]
                };

                const snowHazardRenderer = {
                    type: "unique-value",
                    field: "A22_100005",
                    defaultSymbol: { type: "simple-fill", color: [200, 220, 240, 0.3], outline: { color: [100, 100, 100, 0.5], width: 1 } },
                    uniqueValueInfos: [
                        { value: "1", symbol: { type: "simple-fill", color: [25, 60, 120, 0.55], outline: { color: [10, 30, 80, 0.9], width: 1.8 } }, label: "Special Heavy Snow Zone (特別豪雪地帯)" },
                        { value: "2", symbol: { type: "simple-fill", color: [65, 125, 190, 0.45], outline: { color: [30, 80, 140, 0.8], width: 1.4 } }, label: "Heavy Snow Zone (豪雪地帯)" },
                        { value: "9", symbol: { type: "simple-fill", color: [140, 190, 230, 0.4], outline: { color: [70, 130, 180, 0.8], width: 1.2 } }, label: "Designated Snow Area (指定豪雪地域)" }
                    ]
                };

                // Colorblind-safe Subprefecture Boundary Renderer (Slate Blue outline)
                const subpreBoundaryRenderer = {
                    type: "simple",
                    symbol: { 
                        type: "simple-fill", 
                        color: [30, 58, 138, 0], 
                        outline: { color: [30, 58, 138, 0.9], width: 1.5, style: "solid" } 
                    }
                };

                // Colorblind-safe Municipal Boundary Renderer (Vibrant Amber/Gold with dashed pattern for high contrast)
                const muniBoundaryRenderer = {
                    type: "simple",
                    symbol: { 
                        type: "simple-fill", 
                        color: [217, 119, 6, 0.15], 
                        outline: { color: [180, 83, 9, 0.95], width: 1.2, style: "dash" } 
                    }
                };

                // Colorblind-safe Ski Area Renderer (Bright Blue Diamond Marker)
                const skiRenderer = {
                    type: "simple",
                    symbol: {
                        type: "simple-marker",
                        style: "diamond",     // Valid ArcGIS marker style
                        color: "#3b82f6",     // Blue fill
                        size: "12px",
                        outline: {
                            color: "#ffffff", // Crisp white outline
                            width: 1.5
                        }
                    }
                };

                // Instantiate Layers into Module-Scoped Variables
                avalancheLayer = new GeoJSONLayer({
                    url: "datasets/oshima_hiyama_avalanches.geojson",
                    title: "Avalanche & Mountain Collapse Zones",
                    definitionExpression: "hazard_code = 'AVALANCHE'",
                    renderer: { type: "simple", symbol: { type: "simple-fill", color: [255, 69, 0, 0.35], outline: { color: [255, 0, 0, 0.8], width: 1.2 } } },
                    popupTemplate: avalanchePopupEN,
                    visible: false
                });

                landslideLayer = new GeoJSONLayer({
                    url: "datasets/oshima_hiyama_landslides.geojson",
                    title: "Landslide Hazard Zones",
                    definitionExpression: "hazard_code = 'LANDSLIDE'",
                    renderer: { type: "simple", symbol: { type: "simple-fill", color: [138, 43, 226, 0.35], outline: { color: [75, 0, 130, 0.8], width: 1.2 } } },
                    popupTemplate: landslidePopupEN,
                    visible: false
                });

                // const allsubBoundariesLayer = new FeatureLayer({
                //     url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/ForeignHokkaido_AdminBoundaries/FeatureServer/0",
                //     title: "Other Hokkaido Boundaries",
                //     popupTemplate: adminPopup,
                //     renderer: subpreBoundaryRenderer,
                //     visible: false
                // });

                oshHiMuniBoundariesLayer = new FeatureLayer({
                    url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/ForeignHokkaido_AdminBoundaries/FeatureServer/1",
                    title: "Oshima & Hiyama Municipal Boundaries",
                    popupTemplate: municipalBoundaryPopupEN,
                    renderer: muniBoundaryRenderer,
                    visible: false
                });

                oshHiBoundariesLayer = new FeatureLayer({
                    url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/ForeignHokkaido_AdminBoundaries/FeatureServer/2",
                    title: "Oshima & Hiyama Boundaries",
                    popupTemplate: subprefecturePopupEN,
                    renderer: subpreBoundaryRenderer,
                    visible: false
                });

                oshHiTrashLayer = new FeatureLayer({
                    url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/ForeignHokkaido_OshimaHiyama_TrashRegs_Polygons/FeatureServer",
                    title: "Garbage & Recycling Regulations",
                    popupTemplate: trashPopupTemplate,
                    visible: false
                });

                municipalOfficesLayer = new FeatureLayer({
                    url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/ForeignHokkaido_Municipal_Offices_etc_and_Public_Meeting_Facilities/FeatureServer",
                    title: "Municipal Offices & Community Centers",
                    // Use strictly string quotes since P05_002 is esriFieldTypeString
                    definitionExpression: "P05_002 IN ('1', '2', '4')",
                    outFields: ["*"],
                    popupTemplate: municipalOfficePopupEN,
                    visible: false
                });

                policeStationsLayer = new FeatureLayer({
                    url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/ForeignHokkaido_OshimaHiyama_Police/FeatureServer/1",
                    title: "Police Stations & Koban",
                    popupTemplate: policePopupEN,
                    visible: false
                });

                postOfficesLayer = new FeatureLayer({
                    url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/ForeignHokkaido_OshimaHiyama_PostOffices/FeatureServer/",
                    title: "Post Offices",
                    popupTemplate: postOfficePopup,
                    visible: false
                });

                schoolsLayer = new FeatureLayer({
                    url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/ForeignHokkaido_OshimaHiyama_Schools/FeatureServer/0",
                    title: "Schools & Educational Facilities",
                    popupTemplate: schoolPopup,
                    visible: false
                });

                roadsideStationsLayer = new FeatureLayer({
                    url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/ForeignHokkaido_OshimaHiyama_RoadsideStations/FeatureServer/0",
                    title: "Michi-no-Eki (Roadside Stations)",
                    popupTemplate: roadsidePopup,
                    visible: false
                });

                busStopsLayer = new FeatureLayer({
                    url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/ForeignHokkaido_OshimaHiyama_RoadsideStations/FeatureServer/1",
                    title: "Bus Stops",
                    visible: false
                });

                gasStationsLayer = new FeatureLayer({
                    url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/ForeignHokkaido_OshimaHiyama_RoadsideStations/FeatureServer/2",
                    title: "Gas Stations",
                    visible: false
                });

                evacuationSheltersLayer = new FeatureLayer({
                    url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/ForeignHokkaido_DisasterPrevention/FeatureServer/1",
                    title: "Disaster Evacuation Shelters",
                    popupTemplate: shelterPopupEN,
                    visible: false
                });

                wildlifeReservesLayer = new FeatureLayer({
                    url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/ForeignHokkaido_OshimaHiyama_WildlifeReserves/FeatureServer/0",
                    title: "Wildlife Reserves & Natural Areas",
                    visible: false
                });

                snowHazardLayer = new FeatureLayer({
                    url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/ForeignHokkaido_OshimaHiyama_SnowStats/FeatureServer",
                    title: "Snow Statistics & Hazard Classification",
                    popupTemplate: snowHazardPopupEN,
                    renderer: snowHazardRenderer,
                    visible: false
                });

                railwayStationsLayer = new FeatureLayer({
                    url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/ForeignHokkaido_OshimaHiyama_Railroad/FeatureServer/0",
                    title: "Railway Stations",
                    popupTemplate: stationPopupEN,
                    visible: false
                });

                railwayLinesLayer = new FeatureLayer({
                    url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/ForeignHokkaido_OshimaHiyama_Railroad/FeatureServer/1",
                    title: "Railway Lines",
                    visible: false
                });

                medicalLayer = new GeoJSONLayer({
                    url: "datasets/oshima_hiyama_medical_master.geojson",
                    title: "Medical Facilities",
                    renderer: medicalRenderer,
                    popupTemplate: medicalPopupEN,
                    visible: false 
                });

                skiResortsLayer = new GeoJSONLayer({
                    url: "datasets/hokkaido_ski_resorts.geojson",
                    title: "Ski Resorts & Winter Recreation",
                    popupTemplate: skiPopupEN,
                    renderer: skiRenderer,
                    visible: false
                });


                // Categorized schema for control panel
                const categorizedLayers = [
                    {
                        defaultTitle: "🏛️ Administrative Boundaries",
                        layers: [
                            { layer: oshHiBoundariesLayer, id: "toggle-oshhi-boundaries", key: "layerOshHiBoundaries" },
                            { layer: oshHiMuniBoundariesLayer, id: "toggle-muni-boundaries", key: "layerMuniBoundaries" }
                        ]
                    },
                    {
                        defaultTitle: "🏢 Local Logistics",
                        layers: [
                            { layer: municipalOfficesLayer, id: "toggle-municipal", key: "layerMunicipal" },
                            { layer: schoolsLayer, id: "toggle-schools", key: "layerSchools" },
                            { layer: postOfficesLayer, id: "toggle-post", key: "layerPost" },
                            { layer: oshHiTrashLayer, id: "toggle-trash", key: "layerTrash" }
                        ]
                    },
                    {
                        defaultTitle: "🚨 Health & Public Safety",
                        layers: [
                            { layer: evacuationSheltersLayer, id: "toggle-shelters", key: "layerShelters" },
                            { layer: policeStationsLayer, id: "toggle-police", key: "layerPolice" },
                            { layer: medicalLayer, id: "toggle-medical", key: "layerMedical" },
                        ]
                    },
                    {
                        defaultTitle: "🚌 Transit",
                        layers: [
                            { layer: railwayStationsLayer, id: "toggle-rail-stations", key: "layerRailStations" },
                            { layer: railwayLinesLayer, id: "toggle-rail-lines", key: "layerRailLines" },
                            { layer: busStopsLayer, id: "toggle-bus", key: "layerBus" },
                            { layer: roadsideStationsLayer, id: "toggle-roadside", key: "layerRoadside" },
                            { layer: gasStationsLayer, id: "toggle-gas", key: "layerGas" }
                        ]
                    },
                    {
                        defaultTitle: "⚠️ Natural Hazard Zones",
                        layers: [
                            { layer: snowHazardLayer, id: "toggle-snow", key: "layerSnow" },
                            { layer: avalancheLayer, id: "toggle-avalanche", key: "layerAvalanche" },
                            { layer: landslideLayer, id: "toggle-landslide", key: "layerLandslide" }
                        ]
                    },
                    {
                        defaultTitle: "🏔️ Nature & Recreation",
                        layers: [
                            { layer: skiResortsLayer, id: "toggle-ski", key: "layerSki" },
                            { layer: wildlifeReservesLayer, id: "toggle-wildlife", key: "layerWildlife" },
                            // { layer: communityEventsLayer, id: "toggle-community-events", key: "layerCommunityEvents" },
                            // { layer: localInterestsLayer, id: "toggle-local-interests", key: "layerLocalInterests" }
                        ]
                    },
                    // {
                    //     defaultTitle: "👥 Community Network",
                    //     layers: [
                    //         // { layer: communityEventsLayer, id: "toggle-community-events", key: "layerCommunityEvents" },
                    //         // { layer: localInterestsLayer, id: "toggle-local-interests", key: "layerLocalInterests" }
                    //     ]
                    // }
                ];

                const layerRegistry = categorizedLayers.flatMap(cat => cat.layers);

                const map = new Map({
                    basemap: (currentSeason === "winter") ? "arcgis-light-gray" : "arcgis-topographic",
                    layers: layerRegistry.map(item => item.layer).reverse()
                });

                mapInstance = map;

                const view = new MapView({
                    container: viewContainerId,
                    map: map,
                    center: [140.3, 42.09],
                    zoom: 7,
                    ui: { components: ["attribution"] }
                });

                viewInstance = view;

                // Control panel UI creation
                const controlPanelDiv = document.createElement("div");
                controlPanelDiv.className = "esri-widget";
                controlPanelDiv.style.cssText = "padding: 12px 14px; background: white; width: 290px; font-family: sans-serif;";

                controlPanelDiv.innerHTML = `
                    <h3 id="lbl-panel-title" style="margin: 0 0 10px 0; font-size: 13px; font-weight: bold; border-bottom: 1px solid #ddd; padding-bottom: 4px;">
                        Interactive Control Panel
                    </h3>
                    
                    <div style="margin-bottom: 12px;">
                        <label id="lbl-muni-filter" for="muni-filter-select" style="font-size: 11px; font-weight: bold; display: block; margin-bottom: 4px; color: #333;">
                            ${t('muniFilterLabel', currentLang)}
                        </label>
                        <select id="muni-filter-select" style="padding: 5px; font-size: 12px; border: 1px solid #ccc; border-radius: 3px; width: 100%;">
                            <!-- Dynamically populated via updateDropdownLanguage -->
                        </select>
                    </div>

                    <div id="lbl-layers-header" style="font-size: 11px; font-weight: bold; margin-bottom: 6px; color: #333;">
                        ${t('layersLabel', currentLang)}
                    </div>
                    
                    <div id="layer-toggles-container" style="display: flex; flex-direction: column; gap: 8px; max-height: 240px; overflow-y: auto; padding-right: 4px; margin-bottom: 12px;">
                        ${categorizedLayers.map(category => `
                            <div style="border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; margin-bottom: 2px;">
                                <div style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">
                                    ${category.defaultTitle}
                                </div>
                                <div style="display: flex; flex-direction: column; gap: 4px;">
                                    ${category.layers.map(item => `
                                        <label style="font-size: 11.5px; display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                            <input type="checkbox" id="${item.id}" ${item.layer.visible ? "checked" : ""}>
                                            <span id="${item.id}-lbl">${t(item.key, currentLang)}</span>
                                        </label>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>

                    <div style="border-top: 1px solid #ddd; padding-top: 8px;">
                        <div id="lbl-crowdsource-header" style="font-size: 11px; font-weight: bold; margin-bottom: 6px; color: #333;">
                            ${t('crowdsourceHeader', currentLang)}
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <a href="https://arcg.is/0y4meL0" target="_blank" style="text-decoration: none;">
                                <button style="width: 100%; background: #007ac2; color: white; border: none; padding: 6px; font-size: 11px; border-radius: 3px; cursor: pointer; font-weight: bold; text-align: left;">
                                    ${t('surveyBtn', currentLang)}
                                </button>
                            </a>
                            <a href="https://arcg.is/0SWLXv" target="_blank" style="text-decoration: none;">
                                <button style="width: 100%; background: #4682b4; color: white; border: none; padding: 6px; font-size: 11px; border-radius: 3px; cursor: pointer; font-weight: bold; text-align: left;">
                                    ${t('reportBtn', currentLang)}
                                </button>
                            </a>
                        </div>
                    </div>
                `;

                const customToggleBtn = document.createElement("button");
                customToggleBtn.id = "controlPanelCustomBtn";
                customToggleBtn.className = "esri-widget esri-widget--button";
                customToggleBtn.innerHTML = "▶ Map Controls";

                let isPanelOpen = false;
                controlPanelDiv.style.display = "none";
                controlPanelDiv.style.position = "absolute";
                controlPanelDiv.style.top = "48px";
                controlPanelDiv.style.left = "36px";
                controlPanelDiv.style.zIndex = "100";
                controlPanelDiv.style.boxShadow = "var(--shadow-md)";
                controlPanelDiv.style.borderRadius = "8px";

                const containerDiv = document.createElement("div");
                containerDiv.style.position = "relative";
                containerDiv.appendChild(customToggleBtn);
                containerDiv.appendChild(controlPanelDiv);

                customToggleBtn.addEventListener("click", () => {
                    isPanelOpen = !isPanelOpen;
                    controlPanelDiv.style.display = isPanelOpen ? "block" : "none";
                    customToggleBtn.style.background = isPanelOpen ? "#1b365d" : "#ffffff";
                    customToggleBtn.style.color = isPanelOpen ? "#ffffff" : "#1b365d";
                });
                
                // Updated document click listener in map.js
                document.addEventListener("click", (e) => {
                    const appHeader = document.querySelector("#appHeader");
                    const viewDiv = document.querySelector("#viewDiv");
                    
                    // Do not close if clicking inside the panel, header, or the map canvas itself
                    if (isPanelOpen && 
                        !containerDiv.contains(e.target) && 
                        (!appHeader || !appHeader.contains(e.target)) &&
                        (!viewDiv || !viewDiv.contains(e.target))) {
                        isPanelOpen = false;
                        controlPanelDiv.style.display = "none";
                        customToggleBtn.style.background = "#ffffff";
                        customToggleBtn.style.color = "#1b365d";
                    }
                });

                view.ui.add(containerDiv, "top-left");

                // Spatial Query & Filtering Logic
                const muniSelect = controlPanelDiv.querySelector("#muni-filter-select");
                updateDropdownLanguage(currentLang, muniSelect);

                // Automatically set to ALL on initial load
                muniSelect.value = "ALL";
                muniSelect.dispatchEvent(new Event("change"));

                async function applySpatialFilter(targetPolygon) {
                    if (!targetPolygon || !targetPolygon.extent) return;
                    view.goTo(targetPolygon.extent.expand(1.15), {
                        duration: 1500,
                        easing: "in-out-cubic"
                    });

                    layerRegistry.forEach(async (item) => {
                        try {
                            if (!item.layerView) item.layerView = await view.whenLayerView(item.layer);
                            item.layerView.filter = { geometry: targetPolygon, spatialRelationship: "intersects" };
                        } catch (err) {
                            console.warn("Spatial filter failed:", err);
                        }
                    });
                }

                muniSelect.addEventListener("change", async (e) => {
                    const selectedTown = e.target.value;
                    if (selectedTown === "ALL") {
                        layerRegistry.forEach(async (item) => {
                            if (!item.layerView) item.layerView = await view.whenLayerView(item.layer);
                            item.layerView.filter = null;
                        });
                        view.goTo({ center: [140.3, 42.09], zoom: 7 });
                        return;
                    }

                    const muniQuery = oshHiMuniBoundariesLayer.createQuery();
                    muniQuery.where = `N03_004 LIKE '%${selectedTown}%'`;
                    muniQuery.returnGeometry = true;
                    muniQuery.outSpatialReference = view.spatialReference;

                    const muniResult = await oshHiMuniBoundariesLayer.queryFeatures(muniQuery);
                    if (muniResult.features.length > 0) {
                        const geoms = muniResult.features.map(f => f.geometry).filter(g => g && g.type === "polygon");
                        const unionGeom = geoms.length === 1 ? geoms[0] : geometryEngine.union(geoms);
                        await applySpatialFilter(unionGeom);
                    }
                });

                view.on("click", async (event) => {
                    const response = await view.hitTest(event, { include: oshHiMuniBoundariesLayer });
                    if (response.results.length > 0) {
                        const graphic = response.results[0].graphic;
                        const townName = graphic.attributes["N03_004"];
                        if (townName) {
                            const opt = Array.from(muniSelect.options).find(o => o.value !== "ALL" && townName.includes(o.value));
                            if (opt) muniSelect.value = opt.value;
                        }
                        await applySpatialFilter(graphic.geometry);
                    }
                });

                layerRegistry.forEach(item => {
                    const cb = controlPanelDiv.querySelector(`#${item.id}`);
                    if (cb) cb.addEventListener("change", (e) => { item.layer.visible = e.target.checked; });
                });

                const seasonBtn = document.querySelector("#btn-season-toggle");
                if (seasonBtn) {
                    seasonBtn.addEventListener("click", () => {
                        currentSeason = (currentSeason === "summer") ? "winter" : "summer";
                        setSeason(currentSeason);

                        const isWinter = (currentSeason === "winter");
                        snowHazardLayer.visible = isWinter;
                        avalancheLayer.visible = isWinter;
                        skiResortsLayer.visible = isWinter;

                        const avalancheCb = controlPanelDiv.querySelector("#toggle-avalanche");
                        if (avalancheCb) avalancheCb.checked = isWinter;

                        // ⛷️ Automatically update the ski layer checkbox in the control panel
                        const skiCb = controlPanelDiv.querySelector("#toggle-ski");
                        if (skiCb) skiCb.checked = isWinter;

                        if (oshHiMuniBoundariesLayer) oshHiMuniBoundariesLayer.visible = !isWinter;
                        if (oshHiBoundariesLayer) oshHiBoundariesLayer.visible = !isWinter;

                        const snowCb = controlPanelDiv.querySelector("#toggle-snow");
                        if (snowCb) snowCb.checked = isWinter;

                        const municipalCb = controlPanelDiv.querySelector("#toggle-muni-boundaries");
                        if (municipalCb) municipalCb.checked = !isWinter;

                        const subprefCb = controlPanelDiv.querySelector("#toggle-oshhi-boundaries");
                        if (subprefCb) subprefCb.checked = !isWinter;

                        const dict = translations[currentLang];
                        document.querySelector("#btn-season-toggle").textContent = isWinter ? dict.seasonBtnSummer : dict.seasonBtnWinter;
                    });
                }

                const resetBtn = document.querySelector("#btn-reset-view");
                if (resetBtn) {
                    resetBtn.addEventListener("click", () => {
                        view.goTo({ center: [140.3, 42.09], zoom: 7 }, { duration: 1500, easing: "in-out-cubic" });
                        muniSelect.value = "ALL";
                        muniSelect.dispatchEvent(new Event("change"));
                    });
                }

                view.ui.add(new Zoom({ view: view }), "top-left");
                view.ui.add(new Expand({ view: view, content: new Legend({ view: view }), expandIcon: "legend", group: "top-left" }), "top-left");

                view.when(() => { resolve({ map, view }); }, (err) => { reject(err); });

            } catch (err) { reject(err); }
        });
    });
}

// Seasonal Basemap Switcher
export function setSeason(season) {
    if (!mapInstance) return;
    mapInstance.basemap = (season === "winter") ? "arcgis-light-gray" : "arcgis-topographic";
}

// Bilingual Municipality Options Data
const municipalityOptions = [
    { value: "函館市", en: "Hakodate City", ja: "函館市", group: "oshima" },
    { value: "北斗市", en: "Hokuto City", ja: "北斗市", group: "oshima" },
    { value: "知内町", en: "Shiriuchi Town", ja: "知内町", group: "oshima" },
    { value: "木古内町", en: "Kikonai Town", ja: "木古内町", group: "oshima" },
    { value: "松前町", en: "Matsumae Town", ja: "松前町", group: "oshima" },
    { value: "福島町", en: "Fukushima Town", ja: "福島町", group: "oshima" },
    { value: "七飯町", en: "Nanae Town", ja: "七飯町", group: "oshima" },
    { value: "鹿部町", en: "Shikabe Town", ja: "鹿部町", group: "oshima" },
    { value: "森町", en: "Mori Town", ja: "森町", group: "oshima" },
    { value: "八雲町", en: "Yakumo Town", ja: "八雲町", group: "oshima" },
    { value: "長万部町", en: "Oshamambe Town", ja: "長万部町", group: "oshima" },
    { value: "江差町", en: "Esashi Town", ja: "江差町", group: "hiyama" },
    { value: "上ノ国町", en: "Kaminokuni Town", ja: "上ノ国町", group: "hiyama" },
    { value: "厚沢部町", en: "Assabu Town", ja: "厚沢部町", group: "hiyama" },
    { value: "乙部町", en: "Otobe Town", ja: "乙部町", group: "hiyama" },
    { value: "奥尻町", en: "Okushiri Town", ja: "奥尻町", group: "hiyama" },
    { value: "今金町", en: "Imakane Town", ja: "今金町", group: "hiyama" },
    { value: "せたな町", en: "Setana Town", ja: "せたな町", group: "hiyama" }
];

function updateDropdownLanguage(lang, selectElement) {
    if (!selectElement) selectElement = document.querySelector("#muni-filter-select");
    if (!selectElement) return;

    const currentVal = selectElement.value;
    const allText = (lang === "EN") ? "— All Municipalities —" : "— すべての自治体 —";
    const oshimaGroupLabel = (lang === "EN") ? "Oshima Subprefecture" : "渡島総合振興局";
    const hiyamaGroupLabel = (lang === "EN") ? "Hiyama Subprefecture" : "檜山振興局";

    let html = `<option value="ALL">${allText}</option>`;
    
    html += `<optgroup label="${oshimaGroupLabel}">`;
    municipalityOptions.filter(m => m.group === "oshima").forEach(m => {
        html += `<option value="${m.value}">${lang === "EN" ? m.en : m.ja}</option>`;
    });
    html += `</optgroup>`;

    html += `<optgroup label="${hiyamaGroupLabel}">`;
    municipalityOptions.filter(m => m.group === "hiyama").forEach(m => {
        html += `<option value="${m.value}">${lang === "EN" ? m.en : m.ja}</option>`;
    });
    html += `</optgroup>`;

    selectElement.innerHTML = html;
    selectElement.value = currentVal;
}

// Dynamic Layer Popup & Dropdown Language Swapper
export function updateLayerPopups(lang) {
    if (!mapInstance) return;

    // Update Feature & GeoJSON Layer Popup Templates safely
    if (snowHazardLayer) snowHazardLayer.popupTemplate = (lang === "EN") ? snowHazardPopupEN : snowHazardPopupJA;
    if (oshHiBoundariesLayer) oshHiBoundariesLayer.popupTemplate = (lang === "EN") ? subprefecturePopupEN : subprefecturePopupJA;
    if (oshHiMuniBoundariesLayer) oshHiMuniBoundariesLayer.popupTemplate = (lang === "EN") ? municipalBoundaryPopupEN : municipalBoundaryPopupJA;
    if (railwayStationsLayer) railwayStationsLayer.popupTemplate = (lang === "EN") ? stationPopupEN : stationPopupJA;
    if (medicalLayer) medicalLayer.popupTemplate = (lang === "EN") ? medicalPopupEN : medicalPopupJA;
    if (avalancheLayer) avalancheLayer.popupTemplate = (lang === "EN") ? avalanchePopupEN : avalanchePopupJA;
    if (landslideLayer) landslideLayer.popupTemplate = (lang === "EN") ? landslidePopupEN : landslidePopupJA;
    // if (evacuationSheltersLayer) evacuationSheltersLayer.popupTemplate = (lang === "EN") ? disasterPopup : disasterPopupJA;
    if (municipalOfficesLayer) municipalOfficesLayer.popupTemplate = (lang === "EN") ? municipalOfficePopupEN : municipalOfficePopupJA;
    if (policeStationsLayer) policeStationsLayer.popupTemplate = (lang === "EN") ? policePopupEN : policePopupJA;
    // if (postOfficesLayer) postOfficesLayer.popupTemplate = (lang === "EN") ? postOfficePopup : postOfficePopupJA;
    // if (schoolsLayer) schoolsLayer.popupTemplate = (lang === "EN") ? schoolPopup : schoolPopupJA;
    // if (roadsideStationsLayer) roadsideStationsLayer.popupTemplate = (lang === "EN") ? roadsidePopup : roadsidePopupJA;
    // if (wildlifeReservesLayer) wildlifeReservesLayer.popupTemplate = (lang === "EN") ? wildlifePopup : wildlifePopupJA;
    // if (gasStationsLayer) gasStationsLayer.popupTemplate = (lang === "EN") ? gasPopup : gasPopupJA;
    // if (busStopsLayer) busStopsLayer.popupTemplate = (lang === "EN") ? busPopup : busPopupJA;
    // if (oshHiTrashLayer) oshHiTrashLayer.popupTemplate = (lang === "EN") ? trashPopupTemplate : trashPopupTemplateJA;
    if (skiResortsLayer) skiResortsLayer.popupTemplate = (lang === "EN") ? skiPopupEN : skiPopupJA;

    // Update Dropdown Filter Labels
    updateDropdownLanguage(lang);
}