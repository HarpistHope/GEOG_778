// map.js - ForeignHokkaido Core Map Application Engine -- initial structure adapated from PugetSoundWatch (Geog576 project) using Google Gemini
let mapInstance = null;
let viewInstance = null;
let currentLang = "EN"; // Active language state ('EN' | 'JA')
let currentSeason = "summer"; // Active seasonal basemap state ('summer' | 'winter')


// Localization Dictionary for English and Japanese labels, buttons, and layer names

const i18n = {
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
        layerRailLines: "Railway Lines"
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
        layerRailLines: "鉄道路線"
    }
};

export function initMap(viewContainerId, apiKey) {
    return new Promise((resolve, reject) => {
        require([
            "esri/config", 
            "esri/Map", 
            "esri/views/MapView",  
            "esri/layers/FeatureLayer",
            "esri/geometry/geometryEngine",
            "esri/widgets/Legend",
            "esri/widgets/Expand",
            "esri/widgets/Zoom",
            "esri/widgets/Search"
        ], (
            esriConfig, 
            Map, 
            MapView, 
            FeatureLayer, 
            geometryEngine, 
            Legend, 
            Expand, 
            Zoom, 
            Search
        ) => {
            
            try {
                if (apiKey) esriConfig.apiKey = apiKey;

                
                // 1. Popup templates with Arcade expressions
                

                const adminPopup = {
                    title: "{N03_004}",
                    content: [
                        {
                            type: "fields",
                            fieldInfos: [
                                { fieldName: "N03_001", label: "Prefecture (都道府県)" },
                                { fieldName: "N03_002", label: "Subprefecture (振興局)" },
                                { fieldName: "N03_003", label: "District / County (郡)" },
                                { fieldName: "N03_004", label: "Municipality Name (市区町村)" },
                                { fieldName: "N03_007", label: "JIS Code" }
                            ]
                        }
                    ]
                };

                // English Subprefecture Popup
                const subprefecturePopupEN = {
                    title: "{expression/subNameEN}",
                    content: [{
                        type: "text",
                        text: `
                            <div style="font-size: 13px; line-height: 1.5;">
                                <b>Subprefecture:</b> {expression/subNameEN} ({N03_002})<br>
                                <b>Prefecture:</b> Hokkaido (北海道)<br>
                                <b>Regional Hub:</b> {expression/subHubEN}<br>
                                <hr style="border: none; border-top: 1px solid #ddd; margin: 8px 0;">
                                <i style="font-size: 11px; color: #555;">{expression/subDescEN}</i>
                            </div>
                        `
                    }],
                    expressionInfos: [
                        {
                            name: "subNameEN",
                            expression: "var s = $feature.N03_002; if (Find('渡島', s) != -1) return 'Oshima Subprefecture'; if (Find('檜山', s) != -1) return 'Hiyama Subprefecture'; return s;"
                        },
                        {
                            name: "subHubEN",
                            expression: "var s = $feature.N03_002; if (Find('渡島', s) != -1) return 'Hakodate City (函館市)'; if (Find('檜山', s) != -1) return 'Esashi Town (江差町)'; return 'Sapporo City';"
                        },
                        {
                            name: "subDescEN",
                            expression: "var s = $feature.N03_002; if (Find('渡島', s) != -1) return 'Oshima Subprefecture encompasses 11 municipalities centered around Hakodate.'; if (Find('檜山', s) != -1) return 'Hiyama Subprefecture encompasses 7 municipalities along the southwestern coast and Okushiri Island.'; return '';"
                        }
                    ]
                };

                // Japanese Subprefecture Popup
                const subprefecturePopupJA = {
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
                        {
                            name: "subHubJA",
                            expression: "var s = $feature.N03_002; if (Find('渡島', s) != -1) return '函館市'; if (Find('檜山', s) != -1) return '江差町'; return '札幌市';"
                        },
                        {
                            name: "subDescJA",
                            expression: "var s = $feature.N03_002; if (Find('渡島', s) != -1) return '渡島総合振興局は函館市を中心に11市町で構成されています。'; if (Find('檜山', s) != -1) return '檜山振興局は日本海沿岸部および奥尻島を含む7町で構成されています。'; return '';"
                        }
                    ]
                };

                // English Municipal Boundary Popup
                const municipalBoundaryPopupEN = {
                    title: "{expression/muniNameEN}",
                    content: [{
                        type: "text",
                        text: `
                            <div style="font-size: 13px; line-height: 1.6;">
                                <b>Municipality:</b> {expression/muniNameEN} ({N03_004})<br>
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
                        {
                            name: "subNameEN",
                            expression: "var s = $feature.N03_002; if (Find('渡島', s) != -1) return 'Oshima Subprefecture'; if (Find('檜山', s) != -1) return 'Hiyama Subprefecture'; return s;"
                        },
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

                // Japanese Municipal Boundary Popup
                const municipalBoundaryPopupJA = {
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
                    expressionInfos: [
                        {
                            name: "districtJA",
                            expression: "var d = $feature.N03_003; if (IsEmpty(d) || Trim(Text(d)) == '' || Text(d) == 'null') return '市部 (指定なし)'; return d;"
                        }
                    ]
                };

                const municipalPopup = {
                    title: "{P05_003}",
                    content: [
                        {
                            type: "text",
                            text: "<b>Address:</b> {P05_004}<br><b>Facility Type:</b> {expression/facilityType}"
                        }
                    ],
                    expressionInfos: [{
                        name: "facilityType",
                        title: "Facility Classification",
                        expression: `
                            When(
                                $feature.P05_002 == '1', 'Town Hall / City Hall (本庁)',
                                $feature.P05_002 == '2', 'Branch / Liaison Office (支所・出張所)',
                                $feature.P05_002 == '3', 'Administrative Service Window (行政サービス)',
                                $feature.P05_002 == '4', 'Public Community Center (公民館)',
                                $feature.P05_002 == '5', 'Public Assembly Facility (集会施設)',
                                'Other Municipal Facility'
                            )
                        `
                    }]
                };

                const policePopup = {
                    title: "{P18_001}",
                    content: [
                        {
                            type: "text",
                            text: "<b>Address:</b> {P18_004}<br><b>Type:</b> {expression/policeType}"
                        }
                    ],
                    expressionInfos: [{
                        name: "policeType",
                        title: "Police Facility Type",
                        expression: `
                            When(
                                $feature.P18_003 == '1', 'Prefectural Police HQ (道警本部)',
                                $feature.P18_003 == '2', 'Main Police Station (警察署)',
                                $feature.P18_003 == '3', 'Branch Office (分庁舎)',
                                $feature.P18_003 == '4', 'Police Box (交番 - Koban)',
                                $feature.P18_003 == '5', 'Residential Police Box (駐在所 - Chuzaisho)',
                                'Police Facility'
                            )
                        `
                    }]
                };

                const postOfficePopup = {
                    title: "{P30_005}",
                    content: [
                        {
                            type: "text",
                            text: "<b>Address:</b> {P30_006}<br><b>Type:</b> {expression/poType}"
                        }
                    ],
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
                    content: [
                        {
                            type: "text",
                            text: "<b>Address:</b> {P29_005}<br><b>Level:</b> {expression/schoolType}"
                        }
                    ],
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
                    content: [
                        {
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
                        }
                    ],
                    expressionInfos: [
                        { name: "hasShop", expression: "IIF($feature.P35_028 == 1, 'Yes', 'No')" },
                        { name: "hasFood", expression: "IIF($feature.P35_013 == 1 \vert{}\vert{}$feature.P35_014 == 1, 'Yes', 'No')" },
                        { name: "hasOnsen", expression: "IIF($feature.P35_016 == 1, 'Yes', 'No')" },
                        { name: "hasWifi", expression: "IIF($feature.P35_023 == 1, 'Yes', 'No')" },
                        { name: "hasEV", expression: "IIF($feature.P35_022 == 1, 'Yes', 'No')" },
                        { name: "hasATM", expression: "IIF($feature.P35_011 == 1, 'Yes', 'No')" }
                    ]
                };

                const disasterPopup = {
                    title: "Shelter: {P20_002}",
                    content: [
                        {
                            type: "text",
                            text: `
                                <b>Address:</b> {P20_003}<br>
                                <b>Facility Type:</b> {P20_004}<br>
                                <b>Capacity:</b> {P20_005} persons<br><br>
                                <b>Designated Hazards:</b><br>
                                • 🌊 Tsunami: {expression/tsunami}<br>
                                • 🌋 Volcanic Activity: {expression/volcano}<br>
                                • 🏚️ Earthquake: {expression/earthquake}<br>
                                • 🌧️ Flood/Water Hazard: {expression/flood}
                            `
                        }
                    ],
                    expressionInfos: [
                        { name: "tsunami", expression: "IIF($feature.P20_008 == 1 \vert{}\vert{}$feature.P20_008 == 'true', 'Designated', 'Not Designated')" },
                        { name: "volcano", expression: "IIF($feature.P20_010 == 1 \vert{}\vert{}$feature.P20_010 == 'true', 'Designated', 'Not Designated')" },
                        { name: "earthquake", expression: "IIF($feature.P20_007 == 1 \vert{}\vert{}$feature.P20_007 == 'true', 'Designated', 'Not Designated')" },
                        { name: "flood", expression: "IIF($feature.P20_009 == 1 \vert{}\vert{}$feature.P20_009 == 'true', 'Designated', 'Not Designated')" }
                    ]
                };

                // English Arcade Expressions
                const snowHazardPopupEN = {
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
                        {
                            name: "fmtTempEN",
                            expression: `
                                var v = $feature.AvgMinTemp;
                                if (IsEmpty(v) || Trim(Text(v)) == '' || Text(v) == 'null' || Number(v) == 99999999) return 'No Historical Statistics Available';
                                return Text(Round(Number(v), 1)) + ' °C';
                            `
                        },
                        {
                            name: "fmtSnowEN",
                            expression: `
                                var v = $feature.AvgTotSnow;
                                if (IsEmpty(v) || Trim(Text(v)) == '' || Text(v) == 'null' || Number(v) == 99999999) return 'No Historical Statistics Available';
                                return Text(Round(Number(v), 1)) + ' cm';
                            `
                        },
                        {
                            name: "fmtDepthEN",
                            expression: `
                                var v = $feature.AvgMaxDept; // Updated field name (Dept)
                                if (IsEmpty(v) || Trim(Text(v)) == '' || Text(v) == 'null' || Number(v) == 99999999) return 'No Historical Statistics Available';
                                return Text(Round(Number(v), 1)) + ' cm';
                            `
                        },
                        {
                            name: "hazardTextEN",
                           expression: `
                                var code = $feature.A22_100005;
                                if (code == '1' || code == 1) return 'Special Heavy Snow Zone (Class 1)';
                                if (code == '2' || code == 2) return 'Heavy Snow Zone (Class 2)';
                                if (code == '9' || code == 9) return 'Registered Snow Area (Class 9)';
                                if (code == '0' || code == 0 || IsEmpty(code)) return 'Standard Regional Zone (Unclassified)';
                                return 'Standard Snow Zone (Class ' + Text(code) + ')';
                            `
                        },
                        {
                            name: "hazardDescEN",
                            expression: `
                                var code = $feature.A22_100005;
                                if (code == '1' || code == 1) return 'Severe winter risks; eligible for statutory national snow removal funding & infrastructure protection.';
                                if (code == '2' || code == 2) return 'High snow accumulation zone requiring active local road clearing and winter safety precautions.';
                                return 'Standard regional snow classification under MLIT safety standards.';
                            `
                        }
                    ]
                };

                // Japanese Arcade Expressions
                const snowHazardPopupJA = {
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
                        {
                            name: "fmtTempJA",
                            expression: `
                                var v = $feature.AvgMinTemp;
                                if (IsEmpty(v) || Text(v) == '' || v == 99999999) return '過去の統計データなし';
                                return Text(Round(Number(v), 1)) + ' °C';
                            `
                        },
                        {
                            name: "fmtSnowJA",
                            expression: `
                                var v = $feature.AvgTotSnow;
                                if (IsEmpty(v) || Text(v) == '' || v == 99999999) return '過去の統計データなし';
                                return Text(Round(Number(v), 1)) + ' cm';
                            `
                        },
                        {
                            name: "fmtDepthJA",
                            expression: `
                                var v = $feature.AvgMaxDept; // Updated field name (Dept)
                                if (IsEmpty(v) || Trim(Text(v)) == '' || Text(v) == 'null' || Number(v) == 99999999) return '過去の統計データなし';
                                return Text(Round(Number(v), 1)) + ' cm';
                            `
                        },
                        {
                            name: "hazardTextJA",
                            expression: `
                                var code = $feature.A22_100005;
                                if (code == '1' || code == 1) return '特別豪雪地帯（第1類）';
                                if (code == '2' || code == 2) return '豪雪地帯（第2類）';
                                if (code == '9' || code == 9) return '指定豪雪地域（第9類）';
                                return '一般豪雪地域（第' + Text(code) + '類）';
                            `
                        },
                        {
                            name: "hazardDescJA",
                            expression: `
                                var code = $feature.A22_100005;
                                if (code == '1' || code == 1) return '豪雪地帯対策特別措置法に基づき、特別防除・除雪補助が手厚く指定される最極甚地域。';
                                if (code == '2' || code == 2) return '積雪が多く、定期的な除雪・交通対策が法律上義務付けられている地域。';
                                return '国土交通省の基準に基づく一般的な雪害対策指定地域。';
                            `
                        }
                    ]
                };

                const stationPopupEN = {
                    title: "{N02_005} Station",
                    content: [
                        {
                            type: "text",
                            text: `
                                <div style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; font-size: 14px;">
                                    <p style="margin: 0 0 8px 0;"><strong>Station Name:</strong> {N02_005} ({N02_005}駅)</p>
                                    <p style="margin: 0 0 8px 0;"><strong>Railway Line:</strong> {expression/line_en} ({N02_003})</p>
                                    <p style="margin: 0 0 8px 0;"><strong>Operator:</strong> {expression/operator_en} ({N02_004})</p>
                                    <p style="margin: 0;"><strong>Service Category:</strong> {expression/service_type}</p>
                                </div>
                            `
                        }
                    ],
                    expressionInfos: [
                        {
                            name: "line_en",
                            title: "Translated Line Name",
                            expression: `
                                var line = $feature.N02_003;
                                return Decode(line,
                                    '北海道新幹線', 'Hokkaido Shinkansen',
                                    '道南いさりび鉄道線', 'South Hokkaido Railway Line',
                                    '海峡線', 'Kaikyo Line (Seikan Tunnel Link)',
                                    '函館本線', 'Hakodate Main Line',
                                    '江差線', 'Esashi Line (Defunct)',
                                    line // Fallback if unmatched
                                );
                            `
                        },
                        {
                            name: "operator_en",
                            title: "Translated Operator Name",
                            expression: `
                                var op = $feature.N02_004;
                                return Decode(op,
                                    '北海道旅客鉄道', 'JR Hokkaido',
                                    '道南いさりび鉄道', 'South Hokkaido Railway Co., Ltd.',
                                    '函館市企業局交通部', 'Hakodate City Tram',
                                    op
                                );
                            `
                        },
                        {
                            name: "service_type",
                            title: "Service Type Badge",
                            expression: `
                                var line = $feature.N02_003;
                                if (line == '北海道新幹線') {
                                    return '🚅 High-Speed Bullet Train';
                                } else if (line == '海峡線') {
                                    return '📦 Freight & Seikan Rail Corridor';
                                } else if (line == '函館市企業局交通部') {
                                    return '🚃 City Tram';
                                } else {
                                    return '🚆 Local / Regional Passenger Train';
                                }
                            `
                        }
                    ]
                };

                const stationPopupJA = {
                    title: "{N02_005}駅",
                    content: [
                        {
                            type: "text",
                            text: `
                                <div style="font-family: sans-serif; line-height: 1.5;">
                                    <p style="margin: 0 0 8px 0;"><strong>駅名：</strong> {N02_005}駅</p>
                                    <p style="margin: 0 0 8px 0;"><strong>路線名：</strong> {N02_003}</p>
                                    <p style="margin: 0 0 8px 0;"><strong>運行会社：</strong> {N02_004}</p>
                                    <p style="margin: 0;"><strong>種別：</strong> {expression/service_type_ja}</p>
                                </div>
                            `
                        }
                    ],
                    expressionInfos: [
                        {
                            name: "service_type_ja",
                            title: "サービス種別",
                            expression: `
                                var line = $feature.N02_003;
                                if (line == '北海道新幹線') {
                                    return '🚅 新幹線';
                                } else if (line == '函館市企業局交通部') {
                                    return '🚃 市電';
                                } else {
                                    return '🚆 在来線・ローカル線';
                                }
                            `
                        }
                    ]
                };

                
                // 2. FEATURE LAYERS & Custom Renderers
                

                const snowHazardRenderer = {
                    type: "unique-value",
                    field: "A22_100005", // MLIT Hazard Category Code
                    defaultSymbol: {
                        type: "simple-fill",
                        color: [200, 220, 240, 0.3],
                        outline: { color: [100, 100, 100, 0.5], width: 1 }
                    },
                    uniqueValueInfos: [
                        {
                            value: "1", // Special Heavy Snow Zone (Most Severe)
                            symbol: {
                                type: "simple-fill",
                                color: [25, 60, 120, 0.55], // Deep Cobalt Blue
                                outline: { color: [10, 30, 80, 0.9], width: 1.8 }
                            },
                            label: "Special Heavy Snow Zone (特別豪雪地帯)"
                        },
                        {
                            value: "2", // Heavy Snow Zone (High)
                            symbol: {
                                type: "simple-fill",
                                color: [65, 125, 190, 0.45], // Medium Blue
                                outline: { color: [30, 80, 140, 0.8], width: 1.4 }
                            },
                            label: "Heavy Snow Zone (豪雪地帯)"
                        },
                        {
                            value: "9", // Designated Local Snow Zone (Moderate)
                            symbol: {
                                type: "simple-fill",
                                color: [140, 190, 230, 0.4], // Light Ice Blue
                                outline: { color: [70, 130, 180, 0.8], width: 1.2 }
                            },
                            label: "Designated Snow Area (指定豪雪地域)"
                        }
                    ]
                };

                const subpreBoundaryRenderer = {
                    type: "simple",
                    symbol: {
                        type: "simple-fill",
                        color: [255, 140, 0, 0], // Very light orange tint fill 
                        outline: {
                            color: [0, 100, 0, 0.85], // Dark green border
                            width: 1,
                            style: "solid" 
                        }
                    }
                };

                const muniBoundaryRenderer = {
                    type: "simple",
                    symbol: {
                        type: "simple-fill",
                        color: [255, 140, 0, 0.2], // Very light orange tint fill 
                        outline: {
                            color: [230, 100, 0, 0.85], // Vibrant orange border
                            width: 1,
                            style: "solid" 
                        }
                    }
                };


                const allsubBoundariesLayer = new FeatureLayer({
                    url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/ForeignHokkaido_AdminBoundaries/FeatureServer/0",
                    title: "Other Hokkaido Boundaries",
                    popupTemplate: adminPopup,
                    renderer: subpreBoundaryRenderer,
                    visible: false
                });


                const oshHiMuniBoundariesLayer = new FeatureLayer({
                    url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/ForeignHokkaido_AdminBoundaries/FeatureServer/1",
                    title: "Oshima & Hiyama Municipal Boundaries",
                    popupTemplate: municipalBoundaryPopupEN, // Default to English; can be switched to JA dynamically
                    renderer: muniBoundaryRenderer,
                    visible: true
                });

                const oshHiBoundariesLayer = new FeatureLayer({
                    url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/ForeignHokkaido_AdminBoundaries/FeatureServer/2",
                    title: "Oshima & Hiyama Boundaries",
                    popupTemplate: subprefecturePopupEN, // Default to English; can be switched to JA dynamically
                    renderer: subpreBoundaryRenderer,
                    visible: true
                });

                const municipalOfficesLayer = new FeatureLayer({
                    url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/ForeignHokkaido_Municipal_Offices_etc_and_Public_Meeting_Facilities/FeatureServer",
                    title: "Municipal Offices & Community Centers",
                    popupTemplate: municipalPopup,
                    visible: false
                });

                const policeStationsLayer = new FeatureLayer({
                    url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/ForeignHokkaido_OshimaHiyama_Police/FeatureServer/1",
                    title: "Police Stations & Koban",
                    popupTemplate: policePopup,
                    visible: false
                });

                const postOfficesLayer = new FeatureLayer({
                    url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/ForeignHokkaido_OshimaHiyama_PostOffices/FeatureServer/",
                    title: "Post Offices",
                    popupTemplate: postOfficePopup,
                    visible: false
                });

                const schoolsLayer = new FeatureLayer({
                    url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/ForeignHokkaido_OshimaHiyama_Schools/FeatureServer/0",
                    title: "Schools & Educational Facilities",
                    popupTemplate: schoolPopup,
                    visible: false
                });

                const roadsideStationsLayer = new FeatureLayer({
                    url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/ForeignHokkaido_OshimaHiyama_RoadsideStations/FeatureServer/0",
                    title: "Michi-no-Eki (Roadside Stations)",
                    popupTemplate: roadsidePopup,
                    visible: false
                });

                const busStopsLayer = new FeatureLayer({
                    url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/ForeignHokkaido_OshimaHiyama_RoadsideStations/FeatureServer/1",
                    title: "Bus Stops",
                    visible: false
                });

                const gasStationsLayer = new FeatureLayer({
                    url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/ForeignHokkaido_OshimaHiyama_RoadsideStations/FeatureServer/2",
                    title: "Gas Stations",
                    visible: false
                });

                const evacuationSheltersLayer = new FeatureLayer({
                    url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/ForeignHokkaido_DisasterPrevention/FeatureServer/1",
                    title: "Disaster Evacuation Shelters",
                    popupTemplate: disasterPopup,
                    visible: false
                });

                const wildlifeReservesLayer = new FeatureLayer({
                    url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/ForeignHokkaido_OshimaHiyama_WildlifeReserves/FeatureServer/0",
                    title: "Wildlife Reserves & Natural Areas",
                    visible: false
                });

                const snowHazardLayer = new FeatureLayer({
                    url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/ForeignHokkaido_OshimaHiyama_SnowStats/FeatureServer",
                    title: "Snow Statistics & Hazard Classification",
                    popupTemplate: snowHazardPopupEN, // Default to English; can be switched to JA dynamically
                    renderer: snowHazardRenderer,
                    visible: false
                });

                const railwayStationsLayer = new FeatureLayer({
                    url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/ForeignHokkaido_OshimaHiyama_Railroad/FeatureServer/0",
                    title: "Railway Stations",
                    popupTemplate: stationPopupEN, // Default to English; can be switched to JA dynamically
                    visible: false
                });

                const railwayLinesLayer = new FeatureLayer({
                    url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/ForeignHokkaido_OshimaHiyama_Railroad/FeatureServer/1",
                    title: "Railway Lines",
                    visible: false
                });

                const layerRegistry = [
                    {layer: oshHiBoundariesLayer, id: "toggle-oshhi-boundaries", key: "layerOshHiBoundaries", layerView: null },
                    {layer: oshHiMuniBoundariesLayer, id: "toggle-muni-boundaries", key: "layerMuniBoundaries", layerView: null },
                    { layer: municipalOfficesLayer, id: "toggle-municipal", key: "layerMunicipal", layerView: null },
                    { layer: policeStationsLayer, id: "toggle-police", key: "layerPolice", layerView: null },
                    { layer: postOfficesLayer, id: "toggle-post", key: "layerPost", layerView: null },
                    { layer: schoolsLayer, id: "toggle-schools", key: "layerSchools", layerView: null },                    
                    {layer: railwayLinesLayer, id: "toggle-railway-lines", key: "layerRailLines", layerView: null },
                    {layer: railwayStationsLayer, id: "toggle-railway-stations", key: "layerRailStations", layerView: null },
                    { layer: roadsideStationsLayer, id: "toggle-roadside", key: "layerRoadside", layerView: null },
                    { layer: busStopsLayer, id: "toggle-bus", key: "layerBus", layerView: null },
                    { layer: gasStationsLayer, id: "toggle-gas", key: "layerGas", layerView: null },
                    { layer: evacuationSheltersLayer, id: "toggle-shelters", key: "layerShelters", layerView: null },
                    { layer: wildlifeReservesLayer, id: "toggle-wildlife", key: "layerWildlife", layerView: null },
                    { layer: snowHazardLayer, id: "toggle-snow", key: "layerSnow", layerView: null },
                ];

                
                // 3. Map and view initialization
                
                const map = new Map({
                    basemap: "arcgis-community",
                    layers: [
                        oshHiMuniBoundariesLayer,
                        snowHazardLayer,
                        oshHiBoundariesLayer,
                        allsubBoundariesLayer,
                        wildlifeReservesLayer,
                        railwayLinesLayer,
                        railwayStationsLayer,
                        municipalOfficesLayer,
                        policeStationsLayer,
                        postOfficesLayer,
                        schoolsLayer,
                        roadsideStationsLayer,
                        busStopsLayer,
                        gasStationsLayer,
                        evacuationSheltersLayer, 
                    ]
                });

                const view = new MapView({
                    container: viewContainerId,
                    map: map,
                    center: [140.3, 42.09],
                    zoom: 7,
                    ui: { components: ["attribution"] } // Remove default zoom and compass controls so I can manually add them in specific groups/positions
                });

                mapInstance = map;
                viewInstance = view;

                
                // 4. Control Panel UI Creation and Layer Toggle Logic
                
                const controlPanelDiv = document.createElement("div");
                controlPanelDiv.className = "esri-widget";
                controlPanelDiv.style.cssText = "padding: 12px 14px; background: white; width: 280px; font-family: sans-serif;";

                controlPanelDiv.innerHTML = `
                    <h3 id="lbl-panel-title" style="margin: 0 0 10px 0; font-size: 13px; font-weight: bold; border-bottom: 1px solid #ddd; padding-bottom: 4px;">
                        Interactive Control Panel
                    </h3>
                    
                    <!-- Spatial Filter Container -->
                    <div style="margin-bottom: 12px;">
                        <label id="lbl-muni-filter" for="muni-filter-select" style="font-size: 11px; font-weight: bold; display: block; margin-bottom: 4px; color: #333;">
                            ${i18n.EN.muniFilterLabel}
                        </label>
                        <select id="muni-filter-select" style="padding: 5px; font-size: 12px; border: 1px solid #ccc; border-radius: 3px;">
                            <option value="ALL">${i18n.EN.muniAll}</option>
                            <optgroup label="渡島総合振興局 (Oshima)">
                                <option value="函館市">Hakodate (函館市)</option>
                                <option value="北斗市">Hokuto (北斗市)</option>
                                <option value="知内町">Shiriuchi (知内町)</option>
                                <option value="木古内町">Kikonai (木古内町)</option>
                                <option value="松前町">Matsumae (松前町)</option>
                                <option value="福島町">Fukushima (福島町)</option>
                                <option value="七飯町">Nanae (七飯町)</option>
                                <option value="鹿部町">Shikabe (鹿部町)</option>
                                <option value="森町">Mori (森町)</option>
                                <option value="八雲町">Yakumo (八雲町)</option>
                                <option value="長万部町">Oshamambe (長万部町)</option>
                            </optgroup>
                            <optgroup label="檜山振興局 (Hiyama)">
                                <option value="江差町">Esashi (江差町)</option>
                                <option value="上ノ国町">Kaminokuni (上ノ国町)</option>
                                <option value="厚沢部町">Assabu (厚沢部町)</option>
                                <option value="乙部町">Otobe (乙部町)</option>
                                <option value="奥尻町">Okushiri (奥尻町)</option>
                                <option value="今金町">Imakane (今金町)</option>
                                <option value="せたな町">Setana (せたな町)</option>
                            </optgroup>
                        </select>
                    </div>

                    <!-- Layer Toggles Container -->
                    <div id="lbl-layers-header" style="font-size: 11px; font-weight: bold; margin-bottom: 6px; color: #333;">
                        ${i18n.EN.layersLabel}
                    </div>
                    <div id="layer-toggles-container" style="display: flex; flex-direction: column; gap: 5px; max-height: 160px; overflow-y: auto; padding-right: 4px; margin-bottom: 12px;">
                        ${layerRegistry.map(item => `
                            <label style="font-size: 12px; display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="checkbox" id="${item.id}" ${item.layer.visible ? "checked" : ""}>
                                <span id="${item.id}-lbl">${i18n.EN[item.key]}</span>
                            </label>
                        `).join('')}
                    </div>

                    <!-- Crowdsource External Link Buttons Container -->
                    <div style="border-top: 1px solid #ddd; padding-top: 8px;">
                        <div id="lbl-crowdsource-header" style="font-size: 11px; font-weight: bold; margin-bottom: 6px; color: #333;">
                            ${i18n.EN.crowdsourceHeader}
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <a id="btn-survey123" href="https://arcg.is/0y4meL0" target="_blank" style="text-decoration: none;">
                                <button style="width: 100%; background: #007ac2; color: white; border: none; padding: 6px; font-size: 11px; border-radius: 3px; cursor: pointer; font-weight: bold; text-align: left; display: flex; align-items: center; gap: 6px;">
                                    ${i18n.EN.surveyBtn}
                                </button>
                            </a>
                            <a id="btn-report-issue" href="https://arcg.is/0SWLXv" target="_blank" style="text-decoration: none;">
                                <button style="width: 100%; background: #4682b4; color: white; border: none; padding: 6px; font-size: 11px; border-radius: 3px; cursor: pointer; font-weight: bold; text-align: left; display: flex; align-items: center; gap: 6px;">
                                    ${i18n.EN.reportBtn}
                                </button>
                            </a>
                        </div>
                    </div>
                `;

                // const controlExpand = new Expand({
                //     view: view,
                //     content: controlPanelDiv,
                //     expandIconClass: "custom-control-panel-icon",
                //     expandTooltip: "Open Map Control Panel",
                //     id: "controlPanelExpand",
                //     group: "top-left",
                //     expanded: false
                // });

                // view.ui.add(controlExpand, "top-left");

                // standalone custom button
                const customToggleBtn = document.createElement("button");
                customToggleBtn.id = "controlPanelCustomBtn";
                customToggleBtn.className = "esri-widget esri-widget--button";
                customToggleBtn.innerHTML = "▶ Map Controls";

                //track open/closed state and toggle the control panel visibility
                let isPanelOpen = false;
                controlPanelDiv.style.display = "none"; // start closed
                controlPanelDiv.style.position = "absolute";
                controlPanelDiv.style.top = "40px";
                controlPanelDiv.style.left = "0px";
                controlPanelDiv.style.zIndex = "100";
                controlPanelDiv.style.boxShadow = "var(--shadow-md)";
                controlPanelDiv.style.borderRadius = "8px";

                // Append panel directly into the view UI container 
                const containerDiv = document.createElement("div");
                containerDiv.style.position = "relative";
                containerDiv.appendChild(customToggleBtn);
                containerDiv.appendChild(controlPanelDiv);

                customToggleBtn.addEventListener("click", () => {
                    isPanelOpen = !isPanelOpen;
                    controlPanelDiv.style.display = isPanelOpen ? "block" : "none";
                    customToggleBtn.style.background = isPanelOpen ? "var(--primary-blue)" : "#ffffff";
                    customToggleBtn.style.color = isPanelOpen ? "#ffffff" : "var(--primary-blue)";
                });
                
                // Close panel when clicking/tapping outside of the container
                document.addEventListener("click", (e) => {
                    if (isPanelOpen && !containerDiv.contains(e.target)) {
                        isPanelOpen = false;
                        controlPanelDiv.style.display = "none";
                        customToggleBtn.style.background = "#ffffff";
                        customToggleBtn.style.color = "var(--primary-blue)";
                    }
                });
                // Add custom control group to the top-left UI stack
                view.ui.add(containerDiv, "top-left");

              
                // 5. Spatial Query Engine and Filtering Logic
                
                const muniSelect = controlPanelDiv.querySelector("#muni-filter-select");

                async function applySpatialFilter(targetPolygon) {
                    if (!targetPolygon || !targetPolygon.extent) return;
                    view.goTo(targetPolygon.extent.expand(1.15));

                    layerRegistry.forEach(async (item) => {
                        try {
                            if (!item.layerView) item.layerView = await view.whenLayerView(item.layer);
                            item.layerView.filter = { geometry: targetPolygon, spatialRelationship: "intersects" };
                        } catch (err) {
                            console.warn("Spatial filter failed:", err);
                        }
                    });
                }

                // Dropdown Filter Listener
                muniSelect.addEventListener("change", async (e) => {
                    const selectedTown = e.target.value;
                    if (selectedTown === "ALL") {
                        layerRegistry.forEach(async (item) => {
                            if (!item.layerView) item.layerView = await view.whenLayerView(item.layer);
                            item.layerView.filter = null;
                        });
                        view.goTo({    center: [140.3, 42.09], zoom: 7, });
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

                // Map Click Listener
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

                // Layer Visibility Checkbox Listeners
                layerRegistry.forEach(item => {
                    const cb = controlPanelDiv.querySelector(`#${item.id}`);
                    if (cb) cb.addEventListener("change", (e) => { item.layer.visible = e.target.checked; });
                });

                // --- HTML HEADER EVENT LISTENERS ---
                
                // Language Switcher Button Listener
                const langBtn = document.querySelector("#btn-lang-toggle");
                if (langBtn) {
                    langBtn.addEventListener("click", () => {
                        currentLang = (currentLang === "EN") ? "JA" : "EN";
                        const dict = i18n[currentLang];

                        // Dynamically swap popup templates based on language ---
                        snowHazardLayer.popupTemplate = (currentLang === "EN") ? snowHazardPopupEN : snowHazardPopupJA;
                        oshHiBoundariesLayer.popupTemplate = (currentLang === "EN") ? subprefecturePopupEN : subprefecturePopupJA;
                        oshHiMuniBoundariesLayer.popupTemplate = (currentLang === "EN") ? municipalBoundaryPopupEN : municipalBoundaryPopupJA;
                        railwayStationsLayer.popupTemplate = (currentLang === "EN") ? stationPopupEN : stationPopupJA;

                        // Update HTML Overlay Header Text
                        document.querySelector("#lbl-title").textContent = dict.appTitle;
                        document.querySelector("#lbl-subtitle").textContent = dict.appSubtitle;
                        document.querySelector("#btn-lang-toggle").textContent = (currentLang === "EN") ? "🇯🇵 日本語" : "🇺🇸 English";
                        document.querySelector("#btn-season-toggle").textContent = (currentSeason === "winter") ? dict.seasonBtnSummer : dict.seasonBtnWinter;
                        document.querySelector("#btn-reset-view").textContent = dict.resetBtn;

                        // Update Control Panel Text
                        controlPanelDiv.querySelector("#lbl-muni-filter").textContent = dict.muniFilterLabel;
                        controlPanelDiv.querySelector("#muni-filter-select").options[0].textContent = dict.muniAll;
                        controlPanelDiv.querySelector("#lbl-layers-header").textContent = dict.layersLabel;
                        controlPanelDiv.querySelector("#lbl-crowdsource-header").textContent = dict.crowdsourceHeader;

                        // Update Checkbox Labels
                        layerRegistry.forEach(item => {
                            const lblSpan = controlPanelDiv.querySelector(`#${item.id}-lbl`);
                            if (lblSpan) lblSpan.textContent = dict[item.key];
                        });
                    });
                }

                // Seasonal Switcher Button Listener
                const seasonBtn = document.querySelector("#btn-season-toggle");
                if (seasonBtn) {
                    seasonBtn.addEventListener("click", () => {
                        // Toggle seasonal state
                        currentSeason = (currentSeason === "summer") ? "winter" : "summer";
                        
                        // 1. Switch the Basemap
                        setSeason(currentSeason);

                        // 2. Automatically toggle Snow Layer visibility
                        const isWinter = (currentSeason === "winter");
                        snowHazardLayer.visible = isWinter;

                        // 3. Sync the Control Panel Checkbox UI state
                        const snowCb = controlPanelDiv.querySelector("#toggle-snow");
                        if (snowCb) {
                            snowCb.checked = isWinter;
                        }

                        // 4. Update Button Label Text
                        const dict = i18n[currentLang];
                        document.querySelector("#btn-season-toggle").textContent = isWinter 
                            ? dict.seasonBtnSummer 
                            : dict.seasonBtnWinter;
                    });
                }

                // Reset Extent Button Listener
                const resetBtn = document.querySelector("#btn-reset-view");
                if (resetBtn) {
                    resetBtn.addEventListener("click", () => {
                        view.goTo({    center: [140.3, 42.09], zoom: 7, });
                        muniSelect.value = "ALL";
                        muniSelect.dispatchEvent(new Event("change"));
                    });
                }

                
                // 6.  Standard map widgets
                
                view.ui.add(new Zoom({ view: view }), "top-left");
                //view.ui.add(new Expand({ view: view, content: new Search({ view: view }), expandIcon: "search", group: "top-right" }), "top-right");
                view.ui.add(new Expand({ view: view, content: new Legend({ view: view }), expandIcon: "legend", group: "top-left" }), "top-left");

                view.when(() => { resolve({ map, view }); }, (err) => { reject(err); });

            } catch (err) { reject(err); }
        });
    });
}

// Seasonal Basemap Switcher
export function setSeason(season) {
    if (!mapInstance) return;
    mapInstance.basemap = (season === "winter") ? "arcgis-human-geography" : "arcgis-community";
}