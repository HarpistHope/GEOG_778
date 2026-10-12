// location.js: Exports function to add locate widget to the map

export function setupLocationServices(view) {
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

        // Error handler for location failures
        locateBtn.on("locate-error", (event) => {
            console.error("Locate Widget Error:", event.error);
            
            const errorMsg = event.error?.message || "";
            if (errorMsg.includes("denied")) {
                alert("Location access was denied. Please enable location permissions in your browser settings to find your position.");
            } else if (errorMsg.includes("timeout")) {
                alert("Location request timed out. Please try again or check your GPS connection.");
            } else {
                alert("Unable to acquire your current location. Please check your device settings.");
            }
        });

        // Add to top-left corner below zoom and control panel controls
        view.ui.add(locateBtn, {
            position: "top-left",
            index: 2
        });
    });
}