// // location.js: Exports function to add locate widget to the map

// export function setupLocationServices(view) {
//     require(["esri/widgets/Locate"], (Locate) => {
        
//         // Create locate widget with high accuracy enabled and a 10-second timeout
//         const locateBtn = new Locate({
//             view: view,
//             geolocationOptions: {
//                 enableHighAccuracy: true,
//                 timeout: 10000,
//                 maximumAge: 0
//             }
//         });

//         // Error handler for location failures
//         locateBtn.on("locate-error", (event) => {
//             console.error("Locate Widget Error:", event.error);
            
//             const errorMsg = event.error?.message || "";
//             if (errorMsg.includes("denied")) {
//                 alert("Location access was denied. Please enable location permissions in your browser settings to find your position.");
//             } else if (errorMsg.includes("timeout")) {
//                 alert("Location request timed out. Please try again or check your GPS connection.");
//             } else {
//                 alert("Unable to acquire your current location. Please check your device settings.");
//             }
//         });

//         // Add to top-left corner below zoom and control panel controls
//         view.ui.add(locateBtn, {
//             position: "top-left",
//             index: 2
//         });
//     });
// }

// location.js: Exports function to add locate widget to the map with bilingual support

export function setupLocationServices(view, getCurrentLang) {
    require(["esri/widgets/Locate"], (Locate) => {
        
        // Create locate widget with high accuracy enabled and a 10-second timeout
        const locateBtn = new Locate({
            view: view,
            geolocationOptions: {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        });

        // Error handler for location failures with bilingual alerts
        locateBtn.on("locate-error", (event) => {
            console.error("Locate Widget Error:", event.error);
            
            const lang = typeof getCurrentLang === "function" ? getCurrentLang() : "EN";
            const errorMsg = event.error?.message || "";

            if (lang === "JA") {
                // Japanese Alert Messages
                if (errorMsg.includes("denied")) {
                    alert("位置情報のアクセスが拒否されました。現在地を表示するには、ブラウザの設定で位置情報の権限を有効にしてください。");
                } else if (errorMsg.includes("timeout")) {
                    alert("位置情報の取得がタイムアウトしました。もう一度お試しいただくか、GPS接続をご確認ください。");
                } else {
                    alert("現在地を取得できませんでした。端末の設定をご確認ください。");
                }
            } else {
                // English Alert Messages
                if (errorMsg.includes("denied")) {
                    alert("Location access was denied. Please enable location permissions in your browser settings to find your position.");
                } else if (errorMsg.includes("timeout")) {
                    alert("Location request timed out. Please try again or check your GPS connection.");
                } else {
                    alert("Unable to acquire your current location. Please check your device settings.");
                }
            }
        });

        // Add to top-left corner below zoom and control panel controls
        view.ui.add(locateBtn, {
            position: "top-left",
            index: 2
        });
    });
}