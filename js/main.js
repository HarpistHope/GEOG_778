// // // main.js: Import setup functions and configuration

// // import { initMap, setSeason } from './map.js';
// // import { setupLocationServices } from './location.js';
// // import { AGOL_APIkey } from './config.js'; // API key stored in separate config file

// // // Initialize spatial interface
// // initMap("viewDiv", AGOL_APIkey.API_KEY)
// //     .then(({ map, view }) => {
// //         console.log("Map View initialized successfully.");

// //         // Keep popups active and expandable
// //         view.popup.collapseEnabled = true;

// //         // Load modules for expand widgets and mobile/desktop responsive behavior
// //         require([
// //             "esri/widgets/Expand",
// //             "esri/core/reactiveUtils"
// //         ], (Expand, reactiveUtils) => {

// //             // Reactive breakpoint watcher for mobile vs. desktop responsiveness
// //             reactiveUtils.watch(
// //                 () => view.widthBreakpoint,
// //                 (breakpoint) => {
// //                     const isMobile = breakpoint === "xsmall" || breakpoint === "small";
// //                     const controlPanelExpand = view.ui.find("controlPanelExpand");

// //                     if (isMobile) {
// //                         // Allow popups to float cleanly over features on mobile screens
// //                         view.popup.dockOptions = {
// //                             buttonEnabled: false,
// //                             breakpoint: false
// //                         };
// //                     } else {
// //                         // Initialize with control panel expanded on desktop screens
// //                         if (controlPanelExpand) {
// //                             controlPanelExpand.expanded = true;
// //                         }

// //                         // Dock popups on desktop screens to the lower right corner
// //                         view.popup.dockEnabled = true;
// //                         view.popup.dockOptions = {
// //                             buttonEnabled: false,
// //                             breakpoint: false,
// //                             position: "bottom-right"
// //                         };
// //                     }
// //                 },
// //                 { initial: true }
// //             );

// //             // Initialize geolocation tracking
// //             setupLocationServices(view);

// //             // ==========================================
// //             // SEASONAL CONTROL EVENT LISTENERS
// //             // ==========================================
// //             const summerBtn = document.getElementById("btn-summer");
// //             const winterBtn = document.getElementById("btn-winter");

// //             if (summerBtn) {
// //                 summerBtn.addEventListener("click", () => setSeason("summer"));
// //             }
// //             if (winterBtn) {
// //                 winterBtn.addEventListener("click", () => setSeason("winter"));
// //             }

// //             // ==========================================
// //             // FEATURE CLICK HIT-TEST PRIORITY
// //             // ==========================================
// //             view.on("click", (event) => {
// //                 view.hitTest(event).then((response) => {
// //                     const graphics = response.results.filter(res => res.type === "graphic");
// //                     if (graphics.length === 0) return;

// //                     // Point features (Disaster facilities, municipal offices, transit) prioritized over polygon boundaries
// //                     const layerOrder = [
// //                         "ForeignHokkaido_DisasterPrevention",
// //                         "ALT_Web_Map_Application_User_Interest_Survey_results",
// //                         "ForeignHokkaido_Municipal_Offices_etc_and_Public_Meeting_Facilities",
// //                         "ForeignHokkaido_OshimaHiyama_Police",
// //                         "ForeignHokkaido_OshimaHiyama_PostOffices",
// //                         "ForeignHokkaido_OshimaHiyama_MichiNoEki_BusStops_GasStations",
// //                         "ForeignHokkaido_OshimaHiyama_Schools",
// //                         "ForeignHokkaido_OshimaHiyama_WildlifeReserves",
// //                         "ForeignHokkaido_AdminBoundaries"
// //                     ];

// //                     // Select highest priority feature hit by click
// //                     const selectedResult = graphics.find(res => {
// //                         const layerId = res.graphic.layer?.id || res.graphic.layer?.title;
// //                         return layerOrder.some(id => layerId && layerId.includes(id));
// //                     });

// //                     if (!selectedResult) return;

// //                     const targetGraphic = selectedResult.graphic;

// //                     // Open popup for selected priority feature
// //                     view.popup.open({
// //                         features: [targetGraphic],
// //                         location: event.mapPoint
// //                     });

// //                     // Smooth zoom/centering transition based on geometry type
// //                     if (targetGraphic.geometry.type === "point") {
// //                         view.goTo({
// //                             target: targetGraphic.geometry
// //                         }, {
// //                             duration: 800,
// //                             easing: "ease-in-out"
// //                         });
// //                     } else {
// //                         view.goTo({
// //                             target: targetGraphic.geometry
// //                         }, {
// //                             duration: 1000,
// //                             easing: "ease-in-out"
// //                         });
// //                     }
// //                 });
// //             });
// //         });
// //     })
// //     .catch((err) => {
// //         console.error("Critical Failure: App bootstrapping aborted.", err);
// //     });




// // main.js: Import setup functions and configuration

// // main.js: Import setup functions and configuration

// import { initMap, setSeason, currentLang } from './map.js';
// import { setupLocationServices } from './location.js';
// import { AGOL_APIkey } from './config.js';

// // Initialize spatial interface
// initMap("viewDiv", AGOL_APIkey.API_KEY)
//     .then(({ map, view }) => {
//         console.log("Map View initialized successfully.");

//         // Keep popups active and expandable
//         view.popup.collapseEnabled = true;

//         // Load modules for expand widgets and mobile/desktop responsive behavior
//         require([
//             "esri/widgets/Expand",
//             "esri/core/reactiveUtils"
//         ], (Expand, reactiveUtils) => {

//             // Reactive breakpoint watcher for mobile vs. desktop responsiveness
//             reactiveUtils.watch(
//                 () => view.widthBreakpoint,
//                 (breakpoint) => {
//                     const isMobile = breakpoint === "xsmall" || breakpoint === "small";
//                     const controlPanelExpand = view.ui.find("controlPanelExpand");

//                     if (isMobile) {
//                         // Allow popups to float cleanly over features on mobile screens
//                         view.popup.dockOptions = {
//                             buttonEnabled: false,
//                             breakpoint: false
//                         };
//                     } else {
//                         // Initialize with control panel expanded on desktop screens
//                         if (controlPanelExpand) {
//                             controlPanelExpand.expanded = true;
//                         }

//                         // Dock popups on desktop screens to the lower right corner
//                         view.popup.dockEnabled = true;
//                         view.popup.dockOptions = {
//                             buttonEnabled: false,
//                             breakpoint: false,
//                             position: "bottom-right"
//                         };
//                     }
//                 },
//                 { initial: true }
//             );

//             // ==========================================
//             // INITIALIZE GEOLOCATION TRACKING (UPDATED)
//             // ==========================================
//             setupLocationServices(view, () => currentLang);

//             // ==========================================
//             // FEATURE CLICK HIT-TEST PRIORITY
//             // ==========================================
//             view.on("click", (event) => {
//                 view.hitTest(event).then((response) => {
//                     const graphics = response.results.filter(res => res.type === "graphic");
//                     if (graphics.length === 0) return;

//                     // Point features prioritized over polygon boundaries
//                     const layerOrder = [
//                         "ForeignHokkaido_DisasterPrevention",
//                         "ALT_Web_Map_Application_User_Interest_Survey_results",
//                         "ForeignHokkaido_Municipal_Offices_etc_and_Public_Meeting_Facilities",
//                         "ForeignHokkaido_OshimaHiyama_Police",
//                         "ForeignHokkaido_OshimaHiyama_PostOffices",
//                         "ForeignHokkaido_OshimaHiyama_MichiNoEki_BusStops_GasStations",
//                         "ForeignHokkaido_OshimaHiyama_Schools",
//                         "ForeignHokkaido_OshimaHiyama_WildlifeReserves",
//                         "ForeignHokkaido_AdminBoundaries"
//                     ];

//                     const selectedResult = graphics.find(res => {
//                         const layerId = res.graphic.layer?.id || res.graphic.layer?.title;
//                         return layerOrder.some(id => layerId && layerId.includes(id));
//                     });

//                     if (!selectedResult) return;

//                     const targetGraphic = selectedResult.graphic;

//                     // Open popup for selected priority feature
//                     view.popup.open({
//                         features: [targetGraphic],
//                         location: event.mapPoint
//                     });

//                     // Smooth zoom/centering transition based on geometry type
//                     const duration = targetGraphic.geometry.type === "point" ? 800 : 1000;
//                     view.goTo({
//                         target: targetGraphic.geometry
//                     }, {
//                         duration,
//                         easing: "ease-in-out"
//                     });
//                 });
//             });
//         });
//     })
//     .catch((err) => {
//         console.error("Critical Failure: App bootstrapping aborted.", err);
//     });

// // main.js: Import setup functions, configuration, and localization
// import { initMap, setSeason, currentLang, setLanguage, currentSeason, updateLayerPopups } from './map.js';
// import { setupLocationServices } from './location.js';
// import { AGOL_APIkey } from './config.js';
// import { t } from './localization.js';

// // Function to refresh all localized UI elements instantly across the entire app
// export function refreshUI() {
//     const lang = currentLang;

//     // 1. Header Titles
//     const titleEl = document.getElementById('lbl-title');
//     const subtitleEl = document.getElementById('lbl-subtitle');
//     if (titleEl) titleEl.textContent = t('appTitle', lang);
//     if (subtitleEl) subtitleEl.textContent = t('appSubtitle', lang);

//     // 2. Header Action Buttons
//     const langBtn = document.getElementById('btn-lang-toggle');
//     if (langBtn) {
//         langBtn.textContent = (lang === "EN") ? "🇯🇵 日本語" : "🇬🇧 English";
//     }

//     const seasonBtn = document.getElementById('btn-season-toggle');
//     if (seasonBtn) {
//         seasonBtn.textContent = (currentSeason === "winter") ? t('seasonBtnWinter', lang) : t('seasonBtnSummer', lang);
//     }

//     const resetBtn = document.getElementById('btn-reset-view');
//     if (resetBtn) {
//         resetBtn.textContent = t('resetBtn', lang);
//     }

//     // 3. Control Panel Text Elements
//     const muniFilterLbl = document.getElementById('lbl-muni-filter');
//     if (muniFilterLbl) muniFilterLbl.textContent = t('muniFilterLabel', lang);

//     const muniSelect = document.getElementById('muni-filter-select');
//     if (muniSelect && muniSelect.options.length > 0) {
//         muniSelect.options[0].textContent = t('muniAll', lang);
//     }

//     const layersHeader = document.getElementById('lbl-layers-header');
//     if (layersHeader) layersHeader.textContent = t('layersLabel', lang);

//     const crowdsourceHeader = document.getElementById('lbl-crowdsource-header');
//     if (crowdsourceHeader) crowdsourceHeader.textContent = t('crowdsourceHeader', lang);

//     // 4. Update Layer Checkbox Labels Dynamically
//     const layerKeys = [
//         { id: "toggle-municipal", key: "layerMunicipal" },
//         { id: "toggle-police", key: "layerPolice" },
//         { id: "toggle-post", key: "layerPost" },
//         { id: "toggle-schools", key: "layerSchools" },
//         { id: "toggle-michi-no-eki", key: "layerRoadside" },
//         { id: "toggle-bus", key: "layerBus" },
//         { id: "toggle-gas", key: "layerGas" },
//         { id: "toggle-shelters", key: "layerShelters" },
//         { id: "toggle-wildlife", key: "layerWildlife" },
//         { id: "toggle-snow", key: "layerSnow" },
//         { id: "toggle-muni-boundaries", key: "layerMuniBoundaries" },
//         { id: "toggle-oshhi-boundaries", key: "layerOshHiBoundaries" },
//         { id: "toggle-rail-stations", key: "layerRailStations" },
//         { id: "toggle-rail-lines", key: "layerRailLines" },
//         { id: "toggle-medical", key: "layerMedical" },
//         { id: "toggle-trash", key: "layerTrash" },
//         { id: "toggle-avalanche", key: "layerAvalanche" },
//         { id: "toggle-landslide", key: "layerLandslide" }
//     ];

//     layerKeys.forEach(item => {
//         const span = document.getElementById(`${item.id}-lbl`);
//         if (span) {
//             span.textContent = t(item.key, lang);
//         }
//     });
// }

// // Wire up Event Listeners on DOM load
// document.addEventListener("DOMContentLoaded", () => {
//     // Language Toggle Listener
//     const langBtn = document.getElementById('btn-lang-toggle');
//     if (langBtn) {
//         langBtn.addEventListener('click', () => {
//             const nextLang = (currentLang === "EN") ? "JA" : "EN";
//             setLanguage(nextLang);         // Updates language state
//             updateLayerPopups(nextLang);   // Updates map popup templates (EN/JA)
//             refreshUI();                   // Updates all HTML text & control panel labels instantly
//         });
//     }

//     // Season Toggle Listener
//     const seasonBtn = document.getElementById('btn-season-toggle');
//     if (seasonBtn) {
//         seasonBtn.addEventListener('click', () => {
//             const nextSeason = (currentSeason === "summer") ? "winter" : "summer";
//             setSeason(nextSeason);
//             refreshUI();
//         });
//     }
// });

// // Initialize spatial interface
// initMap("viewDiv", AGOL_APIkey.API_KEY)
//     .then(({ map, view }) => {
//         console.log("Map View initialized successfully.");

//         // Keep popups active and expandable
//         view.popup.collapseEnabled = true;

//         // Initial UI text sync
//         refreshUI();

//         // Load modules for expand widgets and mobile/desktop responsive behavior
//         require([
//             "esri/widgets/Expand",
//             "esri/core/reactiveUtils"
//         ], (Expand, reactiveUtils) => {

//             // Reactive breakpoint watcher for mobile vs. desktop responsiveness
//             reactiveUtils.watch(
//                 () => view.widthBreakpoint,
//                 (breakpoint) => {
//                     const isMobile = breakpoint === "xsmall" || breakpoint === "small";
//                     const controlPanelExpand = view.ui.find("controlPanelExpand");

//                     if (isMobile) {
//                         view.popup.dockOptions = {
//                             buttonEnabled: false,
//                             breakpoint: false
//                         };
//                     } else {
//                         if (controlPanelExpand) {
//                             controlPanelExpand.expanded = true;
//                         }

//                         view.popup.dockEnabled = true;
//                         view.popup.dockOptions = {
//                             buttonEnabled: false,
//                             breakpoint: false,
//                             position: "bottom-right"
//                         };
//                     }
//                 },
//                 { initial: true }
//             );

//             // ==========================================
//             // INITIALIZE GEOLOCATION TRACKING
//             // ==========================================
//             setupLocationServices(view, () => currentLang);

//             // ==========================================
//             // FEATURE CLICK HIT-TEST PRIORITY
//             // ==========================================
//             view.on("click", (event) => {
//                 view.hitTest(event).then((response) => {
//                     const graphics = response.results.filter(res => res.type === "graphic");
//                     if (graphics.length === 0) return;

//                     const layerOrder = [
//                         "ForeignHokkaido_DisasterPrevention",
//                         "ALT_Web_Map_Application_User_Interest_Survey_results",
//                         "ForeignHokkaido_Municipal_Offices_etc_and_Public_Meeting_Facilities",
//                         "ForeignHokkaido_OshimaHiyama_Police",
//                         "ForeignHokkaido_OshimaHiyama_PostOffices",
//                         "ForeignHokkaido_OshimaHiyama_MichiNoEki_BusStops_GasStations",
//                         "ForeignHokkaido_OshimaHiyama_Schools",
//                         "ForeignHokkaido_OshimaHiyama_WildlifeReserves",
//                         "ForeignHokkaido_AdminBoundaries"
//                     ];

//                     const selectedResult = graphics.find(res => {
//                         const layerId = res.graphic.layer?.id || res.graphic.layer?.title;
//                         return layerOrder.some(id => layerId && layerId.includes(id));
//                     });

//                     if (!selectedResult) return;

//                     const targetGraphic = selectedResult.graphic;

//                     view.popup.open({
//                         features: [targetGraphic],
//                         location: event.mapPoint
//                     });

//                     const duration = targetGraphic.geometry.type === "point" ? 800 : 1000;
//                     view.goTo({
//                         target: targetGraphic.geometry
//                     }, {
//                         duration,
//                         easing: "ease-in-out"
//                     });
//                 });
//             });
//         });
//     })
//     .catch((err) => {
//         console.error("Critical Failure: App bootstrapping aborted.", err);
//     });

//     // ==========================================
// // INTRO.JS ONBOARDING TOUR
// // ==========================================

// function startAppTour() {
//     // Check if the dynamic control panel button exists yet
//     const controlBtn = document.querySelector('#controlPanelCustomBtn') || document.querySelector('#appHeader');

//     introJs().setOptions({
//         steps: [
//             {
//                 element: document.querySelector('#appHeader'),
//                 intro: "Welcome to <b>ForeignHokkaido</b>! This interactive mapping resource is designed for Assistant Language Teachers across Oshima and Hiyama.",
//                 position: 'bottom'
//             },
//             {
//                 element: document.querySelector('#btn-lang-toggle'),
//                 intro: "<b>Bilingual Toggle:</b> Instantly switch UI labels, map labels, municipality dropdowns, and popup templates between English and Japanese.",
//                 position: 'bottom'
//             },
//             {
//                 element: controlBtn,
//                 intro: "<b>Interactive Control Panel:</b> Open this to toggle categorized map layers (administrative boundaries, winter hazards, medical facilities, and transit networks) and filter by municipality.",
//                 position: 'right'
//             },
//             {
//                 element: document.querySelector('#btn-season-toggle'),
//                 intro: "<b>Winter Mode:</b> Switch basemaps and automatically load heavy snow statistics, avalanche zones, and mountain collapse safety data.",
//                 position: 'bottom'
//             },
//             {
//                 element: document.querySelector('#btn-reset-view'),
//                 intro: "<b>Reset Extent:</b> Smoothly glide back to the regional overview of southwestern Hokkaido at any time.",
//                 position: 'bottom'
//             }
//         ],
//         showBullets: true,
//         exitOnOverlayClick: false,
//         scrollToElement: true
//     }).start();
// }

// // Bind the Tour button once the DOM and map are initialized
// document.addEventListener("DOMContentLoaded", () => {
//     const tourBtn = document.querySelector("#btn-tour");
//     if (tourBtn) {
//         tourBtn.addEventListener("click", startAppTour);
//     }

//     // Optional: Auto-launch tour on first-ever visit (after a short delay to let the map finish loading)
//     if (!localStorage.getItem('hasSeenTour')) {
//         setTimeout(() => {
//             startAppTour();
//             localStorage.setItem('hasSeenTour', 'true');
//         }, 1500);
//     }
// });

// main.js - Import setup functions, configuration, and localization
import { initMap, setSeason, currentLang, setLanguage, currentSeason, updateLayerPopups, refreshMapViewUI } from './map.js';
import { setupLocationServices } from './location.js';
import { AGOL_APIkey } from './config.js';
import { t } from './localization.js';

// Function to refresh all localized UI elements instantly across the entire app
export function refreshUI() {
    const lang = currentLang;

    // 1. Header Titles
    const titleEl = document.getElementById('lbl-title');
    const subtitleEl = document.getElementById('lbl-subtitle');
    if (titleEl) titleEl.textContent = t('appTitle', lang);
    if (subtitleEl) subtitleEl.textContent = t('appSubtitle', lang);

    // 2. Header Action Buttons
    const langBtn = document.getElementById('btn-lang-toggle');
    if (langBtn) {
        langBtn.textContent = (lang === "EN") ? "🇯🇵 日本語" : "🇬🇧 English";
    }

    const seasonBtn = document.getElementById('btn-season-toggle');
        if (seasonBtn) {
            // If it's currently summer, show Winter Mode. If winter, show Summer Mode.
            seasonBtn.textContent = (currentSeason === "summer") ? t('seasonBtnWinter', lang) : t('seasonBtnSummer', lang);
        }

    const resetBtn = document.getElementById('btn-reset-view');
    if (resetBtn) {
        resetBtn.textContent = t('resetBtn', lang);
    }

    const tourBtn = document.getElementById('btn-tour');
    if (tourBtn) {
        tourBtn.textContent = (lang === "EN") ? "❓ App Tour" : "❓ アプリツアー";
    }

    // 3. Control Panel Text Elements
    const muniFilterLbl = document.getElementById('lbl-muni-filter');
    if (muniFilterLbl) muniFilterLbl.textContent = t('muniFilterLabel', lang);

    const muniSelect = document.getElementById('muni-filter-select');
    if (muniSelect && muniSelect.options.length > 0) {
        muniSelect.options[0].textContent = t('muniAll', lang);
    }

    const layersHeader = document.getElementById('lbl-layers-header');
    if (layersHeader) layersHeader.textContent = t('layersLabel', lang);

    const crowdsourceHeader = document.getElementById('lbl-crowdsource-header');
    if (crowdsourceHeader) crowdsourceHeader.textContent = t('crowdsourceHeader', lang);

    // 4. Update Layer Checkbox Labels Dynamically
    const layerKeys = [
        { id: "toggle-municipal", key: "layerMunicipal" },
        { id: "toggle-police", key: "layerPolice" },
        { id: "toggle-post", key: "layerPost" },
        { id: "toggle-schools", key: "layerSchools" },
        { id: "toggle-michi-no-eki", key: "layerRoadside" },
        { id: "toggle-bus", key: "layerBus" },
        { id: "toggle-gas", key: "layerGas" },
        { id: "toggle-shelters", key: "layerShelters" },
        { id: "toggle-wildlife", key: "layerWildlife" },
        { id: "toggle-snow", key: "layerSnow" },
        { id: "toggle-muni-boundaries", key: "layerMuniBoundaries" },
        { id: "toggle-oshhi-boundaries", key: "layerOshHiBoundaries" },
        { id: "toggle-rail-stations", key: "layerRailStations" },
        { id: "toggle-rail-lines", key: "layerRailLines" },
        { id: "toggle-medical", key: "layerMedical" },
        { id: "toggle-trash", key: "layerTrash" },
        { id: "toggle-avalanche", key: "layerAvalanche" },
        { id: "toggle-landslide", key: "layerLandslide" }
    ];

    layerKeys.forEach(item => {
        const span = document.getElementById(`${item.id}-lbl`);
        if (span) {
            span.textContent = t(item.key, lang);
        }
    });
}

// ==========================================
// CUSTOM ONBOARDING TOUR CONTROLLER WITH SPOTLIGHTS
// ==========================================
const tourSteps = [
    {
        title: "Welcome to ForeignHokkaido",
        text: "This interactive mapping resource is designed specifically for Assistant Language Teachers across the Oshima and Hiyama regions of Hokkaido.",
        target: null 
    },
    {
        title: "Bilingual Language Toggle",
        text: "Instantly switch UI labels, map vector labels, municipality dropdown filters, and popup templates between English and Japanese with a single click.",
        target: "#btn-lang-toggle"
    },
    {
        title: "Interactive Control Panel",
        text: "Click 'Map Controls' to toggle categorized map layers (administrative boundaries, winter hazards, medical facilities, and transit networks) and filter by specific municipalities.",
        target: "#controlPanelCustomBtn"
    },
    {
        title: "Seasonal Winter Mode",
        text: "Switch basemaps and automatically load heavy snow statistics, avalanche zones, and mountain collapse safety data for winter preparedness.",
        target: "#btn-season-toggle"
    },
    {
        title: "Reset Extent",
        text: "Smoothly glide back to the regional overview of southwestern Hokkaido whenever you need to regain your broad spatial context.",
        target: "#btn-reset-view"
    }
];

let currentTourStep = 0;

// function clearTourHighlights() {
//     document.querySelectorAll('.tour-highlight').forEach(el => {
//         el.classList.remove('tour-highlight');
//     });
//     document.querySelectorAll('.tour-dimmed').forEach(el => {
//         el.classList.remove('tour-dimmed');
//     });
//     const header = document.getElementById('appHeader');
//     if (header) header.style.zIndex = "";
// }

// function renderTourModal() {
//     clearTourHighlights();
//     const existing = document.getElementById('customTourOverlay');
//     if (existing) existing.remove();

//     const step = tourSteps[currentTourStep];

//     if (step.target) {
//         const targetEl = document.querySelector(step.target);
//         if (targetEl) {
//             targetEl.classList.add('tour-highlight');
//             targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

//             // Elevate header layer and dim sibling buttons so only the target pops
//             if (step.target.includes('btn-') || step.target === '#appHeader') {
//                 const header = document.getElementById('appHeader');
//                 if (header) {
//                     header.style.zIndex = "10000";
//                     header.querySelectorAll('.header-btn').forEach(btn => {
//                         if (btn !== targetEl) btn.classList.add('tour-dimmed');
//                     });
//                 }
//             }
//         }
//     }

//     const overlay = document.createElement('div');
//     overlay.id = 'customTourOverlay';
//     overlay.className = 'tour-overlay';

//     overlay.innerHTML = `
//         <div class="tour-modal">
//             <div class="tour-header">
//                 <span>${step.title}</span>
//                 <span class="tour-step-count">Step ${currentTourStep + 1} of ${tourSteps.length}</span>
//             </div>
//             <div class="tour-body">
//                 ${step.text}
//             </div>
//             <div class="tour-footer">
//                 <button id="tourPrevBtn" class="tour-btn tour-btn-secondary" ${currentTourStep === 0 ? 'style="visibility:hidden;"' : ''}>Back</button>
//                 <div style="display: flex; gap: 8px;">
//                     <button id="tourSkipBtn" class="tour-btn tour-btn-secondary">Skip Tour</button>
//                     <button id="tourNextBtn" class="tour-btn tour-btn-primary">${currentTourStep === tourSteps.length - 1 ? 'Finish' : 'Next'}</button>
//                 </div>
//             </div>
//         </div>
//     `;

//     document.body.appendChild(overlay);
//     setTimeout(() => overlay.classList.add('active'), 10);

//     document.getElementById('tourSkipBtn').addEventListener('click', closeTour);
//     document.getElementById('tourNextBtn').addEventListener('click', () => {
//         if (currentTourStep < tourSteps.length - 1) {
//             currentTourStep++;
//             renderTourModal();
//         } else {
//             closeTour();
//             localStorage.setItem('hasSeenTour', 'true');
//         }
//     });

//     const prevBtn = document.getElementById('tourPrevBtn');
//     if (prevBtn) {
//         prevBtn.addEventListener('click', () => {
//             if (currentTourStep > 0) {
//                 currentTourStep--;
//                 renderTourModal();
//             }
//         });
//     }
// }

// Keep track of the original parent so we can put the button back when the tour moves/closes
let originalControlPanelParent = null;
let originalControlPanelNextSibling = null;

function clearTourHighlights() {
    document.querySelectorAll('.tour-highlight').forEach(el => {
        el.classList.remove('tour-highlight');
        el.style.zIndex = "";
    });
    document.querySelectorAll('.tour-dimmed').forEach(el => {
        el.classList.remove('tour-dimmed');
    });
    
    // Reset header
    const header = document.getElementById('appHeader');
    if (header) {
        header.style.zIndex = "";
        header.style.position = "";
    }

    // Put the control panel button back to its original Esri home if it was moved
    const controlBtn = document.getElementById('controlPanelCustomBtn');
    if (controlBtn && originalControlPanelParent) {
        controlBtn.style.position = "";
        controlBtn.style.top = "";
        controlBtn.style.left = "";
        controlBtn.style.zIndex = "";
        controlBtn.style.transform = "";
        
        if (originalControlPanelNextSibling) {
            originalControlPanelParent.insertBefore(controlBtn, originalControlPanelNextSibling);
        } else {
            originalControlPanelParent.appendChild(controlBtn);
        }
        originalControlPanelParent = null;
        originalControlPanelNextSibling = null;
    }
}

function renderTourModal() {
    clearTourHighlights();
    const existing = document.getElementById('customTourOverlay');
    if (existing) existing.remove();

    const step = tourSteps[currentTourStep];

    if (step.target) {
        const targetEl = document.querySelector(step.target);
        if (targetEl) {
            targetEl.classList.add('tour-highlight');
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

            // 1. If target is in the header
            if (step.target.includes('btn-') || step.target === '#appHeader') {
                const header = document.getElementById('appHeader');
                if (header) {
                    header.style.zIndex = "10000";
                    header.style.position = "relative";
                    header.querySelectorAll('.header-btn').forEach(btn => {
                        if (btn !== targetEl) btn.classList.add('tour-dimmed');
                    });
                }
            }
            // 2. If target is the map control panel button, temporarily pop it out of Esri's container onto the body!
            else if (step.target === '#controlPanelCustomBtn') {
                originalControlPanelParent = targetEl.parentNode;
                originalControlPanelNextSibling = targetEl.nextSibling;

                // Get exact bounding box before moving
                const rect = targetEl.getBoundingClientRect();

                // Move to body and make fixed so it stays in the exact same visual spot
                document.body.appendChild(targetEl);
                targetEl.style.position = "fixed";
                targetEl.style.top = `${rect.top}px`;
                targetEl.style.left = `${rect.left}px`;
                targetEl.style.zIndex = "10001";

                // Re-apply tour-highlight class after appending to body
                targetEl.classList.add('tour-highlight');
            }
        }
    }

    const overlay = document.createElement('div');
    overlay.id = 'customTourOverlay';
    overlay.className = 'tour-overlay';

    overlay.innerHTML = `
        <div class="tour-modal">
            <div class="tour-header">
                <span>${step.title}</span>
                <span class="tour-step-count">Step ${currentTourStep + 1} of ${tourSteps.length}</span>
            </div>
            <div class="tour-body">
                ${step.text}
            </div>
            <div class="tour-footer">
                <button id="tourPrevBtn" class="tour-btn tour-btn-secondary" ${currentTourStep === 0 ? 'style="visibility:hidden;"' : ''}>Back</button>
                <div style="display: flex; gap: 8px;">
                    <button id="tourSkipBtn" class="tour-btn tour-btn-secondary">Skip Tour</button>
                    <button id="tourNextBtn" class="tour-btn tour-btn-primary">${currentTourStep === tourSteps.length - 1 ? 'Finish' : 'Next'}</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add('active'), 10);

    document.getElementById('tourSkipBtn').addEventListener('click', closeTour);
    document.getElementById('tourNextBtn').addEventListener('click', () => {
        if (currentTourStep < tourSteps.length - 1) {
            currentTourStep++;
            renderTourModal();
        } else {
            closeTour();
            localStorage.setItem('hasSeenTour', 'true');
        }
    });

    const prevBtn = document.getElementById('tourPrevBtn');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentTourStep > 0) {
                currentTourStep--;
                renderTourModal();
            }
        });
    }
}

function startAppTour() {
    currentTourStep = 0;
    renderTourModal();
}

function closeTour() {
    clearTourHighlights();
    const overlay = document.getElementById('customTourOverlay');
    if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 300);
    }
}

// Wire up Event Listeners on DOM Load
document.addEventListener("DOMContentLoaded", () => {
    // Language Toggle Listener
    const langBtn = document.getElementById('btn-lang-toggle');
    if (langBtn) {
        langBtn.addEventListener('click', () => {
            const nextLang = (currentLang === "EN") ? "JA" : "EN";
            setLanguage(nextLang);         
            updateLayerPopups(nextLang);   
            refreshUI();    
            //refreshMapViewUI();
        });
    }

    // Season Toggle Listener
    const seasonBtn = document.getElementById('btn-season-toggle');
    if (seasonBtn) {
        seasonBtn.addEventListener('click', () => {
            const nextSeason = (currentSeason === "summer") ? "winter" : "summer";
            setSeason(nextSeason);
            refreshUI();
        });
    }

    // Tour Button Listener
    const tourBtn = document.getElementById('btn-tour');
    if (tourBtn) {
        tourBtn.addEventListener('click', startAppTour);
    }
});

// Initialize spatial interface
initMap("viewDiv", AGOL_APIkey.API_KEY)
    .then(({ map, view }) => {
        console.log("Map View initialized successfully.");

        // Keep popups active and expandable
        view.popup.collapseEnabled = true;

        // Initial UI text sync
        refreshUI();

        // Auto-launch tour on first-ever visit after map loads
        if (!localStorage.getItem('hasSeenTour')) {
            setTimeout(() => {
                startAppTour();
                localStorage.setItem('hasSeenTour', 'true');
            }, 1500);
        }

        // Load modules for expand widgets and mobile/desktop responsive behavior
        require([
            "esri/widgets/Expand",
            "esri/core/reactiveUtils"
        ], (Expand, reactiveUtils) => {

            reactiveUtils.watch(
                () => view.widthBreakpoint,
                (breakpoint) => {
                    const isMobile = breakpoint === "xsmall" || breakpoint === "small";
                    const controlPanelExpand = view.ui.find("controlPanelExpand");

                    if (isMobile) {
                        view.popup.dockOptions = {
                            buttonEnabled: false,
                            breakpoint: false
                        };
                    } else {
                        if (controlPanelExpand) {
                            controlPanelExpand.expanded = true;
                        }

                        view.popup.dockEnabled = true;
                        view.popup.dockOptions = {
                            buttonEnabled: false,
                            breakpoint: false,
                            position: "bottom-right"
                        };
                    }
                },
                { initial: true }
            );

            // INITIALIZE GEOLOCATION TRACKING
            setupLocationServices(view, () => currentLang);

            // FEATURE CLICK HIT-TEST PRIORITY
            view.on("click", (event) => {
                view.hitTest(event).then((response) => {
                    const graphics = response.results.filter(res => res.type === "graphic");
                    if (graphics.length === 0) return;

                    const layerOrder = [
                        "ForeignHokkaido_DisasterPrevention",
                        "ALT_Web_Map_Application_User_Interest_Survey_results",
                        "ForeignHokkaido_Municipal_Offices_etc_and_Public_Meeting_Facilities",
                        "ForeignHokkaido_OshimaHiyama_Police",
                        "ForeignHokkaido_OshimaHiyama_PostOffices",
                        "ForeignHokkaido_OshimaHiyama_MichiNoEki_BusStops_GasStations",
                        "ForeignHokkaido_OshimaHiyama_Schools",
                        "ForeignHokkaido_OshimaHiyama_WildlifeReserves",
                        "ForeignHokkaido_AdminBoundaries"
                    ];

                    const selectedResult = graphics.find(res => {
                        const layerId = res.graphic.layer?.id || res.graphic.layer?.title;
                        return layerOrder.some(id => layerId && layerId.includes(id));
                    });

                    if (!selectedResult) return;

                    const targetGraphic = selectedResult.graphic;

                    view.popup.open({
                        features: [targetGraphic],
                        location: event.mapPoint
                    });

                    const duration = targetGraphic.geometry.type === "point" ? 800 : 1000;
                    view.goTo({
                        target: targetGraphic.geometry
                    }, {
                        duration,
                        easing: "ease-in-out"
                    });
                });
            });
        });
    })
    .catch((err) => {
        console.error("Critical Failure: App bootstrapping aborted.", err);
    });