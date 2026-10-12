// main.js: Import setup functions and configuration

import { initMap, setSeason } from './map.js';
import { setupLocationServices } from './location.js';
import { AGOL_APIkey } from './config.js'; // API key stored in separate config file

// Initialize spatial interface
initMap("viewDiv", AGOL_APIkey.API_KEY)
    .then(({ map, view }) => {
        console.log("Map View initialized successfully.");

        // Keep popups active and expandable
        view.popup.collapseEnabled = true;

        // Load modules for expand widgets and mobile/desktop responsive behavior
        require([
            "esri/widgets/Expand",
            "esri/core/reactiveUtils"
        ], (Expand, reactiveUtils) => {

            // Reactive breakpoint watcher for mobile vs. desktop responsiveness
            reactiveUtils.watch(
                () => view.widthBreakpoint,
                (breakpoint) => {
                    const isMobile = breakpoint === "xsmall" || breakpoint === "small";
                    const controlPanelExpand = view.ui.find("controlPanelExpand");

                    if (isMobile) {
                        // Allow popups to float cleanly over features on mobile screens
                        view.popup.dockOptions = {
                            buttonEnabled: false,
                            breakpoint: false
                        };
                    } else {
                        // Initialize with control panel expanded on desktop screens
                        if (controlPanelExpand) {
                            controlPanelExpand.expanded = true;
                        }

                        // Dock popups on desktop screens to the lower right corner
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

            // Initialize geolocation tracking
            setupLocationServices(view);

            // ==========================================
            // SEASONAL CONTROL EVENT LISTENERS
            // ==========================================
            const summerBtn = document.getElementById("btn-summer");
            const winterBtn = document.getElementById("btn-winter");

            if (summerBtn) {
                summerBtn.addEventListener("click", () => setSeason("summer"));
            }
            if (winterBtn) {
                winterBtn.addEventListener("click", () => setSeason("winter"));
            }

            // ==========================================
            // FEATURE CLICK HIT-TEST PRIORITY
            // ==========================================
            view.on("click", (event) => {
                view.hitTest(event).then((response) => {
                    const graphics = response.results.filter(res => res.type === "graphic");
                    if (graphics.length === 0) return;

                    // Point features (Disaster facilities, municipal offices, transit) prioritized over polygon boundaries
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

                    // Select highest priority feature hit by click
                    const selectedResult = graphics.find(res => {
                        const layerId = res.graphic.layer?.id || res.graphic.layer?.title;
                        return layerOrder.some(id => layerId && layerId.includes(id));
                    });

                    if (!selectedResult) return;

                    const targetGraphic = selectedResult.graphic;

                    // Open popup for selected priority feature
                    view.popup.open({
                        features: [targetGraphic],
                        location: event.mapPoint
                    });

                    // Smooth zoom/centering transition based on geometry type
                    if (targetGraphic.geometry.type === "point") {
                        view.goTo({
                            target: targetGraphic.geometry
                        }, {
                            duration: 800,
                            easing: "ease-in-out"
                        });
                    } else {
                        view.goTo({
                            target: targetGraphic.geometry
                        }, {
                            duration: 1000,
                            easing: "ease-in-out"
                        });
                    }
                });
            });
        });
    })
    .catch((err) => {
        console.error("Critical Failure: App bootstrapping aborted.", err);
    });