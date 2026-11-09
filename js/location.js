// location.js — adds the Locate widget and reports failures with a localized toast
import { t } from "./localization.js";
import { onChange } from "./map.js";

function showToast(message) {
    let toast = document.getElementById("fh-toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "fh-toast";
        toast.className = "fh-toast";
        toast.setAttribute("role", "status");
        toast.setAttribute("aria-live", "polite");
        document.body.append(toast);
    }
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 6000);
}

// GeolocationPositionError codes: 1 = denied, 2 = unavailable, 3 = timeout
function errorKey(error) {
    const code = error?.code;
    if (code === 1) return "locDenied";
    if (code === 3) return "locTimeout";
    if (code === 2) return "locUnavailable";
    const msg = String(error?.message || "").toLowerCase();
    if (msg.includes("denied") || msg.includes("permission")) return "locDenied";
    if (msg.includes("timeout") || msg.includes("timed out")) return "locTimeout";
    return "locUnavailable";
}

export function setupLocationServices(view, getLang) {
    const lang = () => (typeof getLang === "function" ? getLang() : "EN");
    const labels = { EN: "Find my location", JA: "現在地を表示" };

    return new Promise((resolve, reject) => {
        if (typeof window.require !== "function") return reject(new Error("ArcGIS SDK is not loaded."));
        window.require(["esri/widgets/Locate"], (Locate) => {
            try {
                // Not high-accuracy: laptops without GPS would otherwise time out constantly.
                const locate = new Locate({
                    view,
                    geolocationOptions: { enableHighAccuracy: false, timeout: 15000, maximumAge: 30000 }
                });

                const applyLabel = () => {
                    locate.label = labels[lang()];
                    const btn = locate.container?.querySelector?.("[role='button'], button");
                    if (btn) { btn.title = labels[lang()]; btn.setAttribute("aria-label", labels[lang()]); }
                };

                locate.on("locate-error", (event) => {
                    console.warn("Locate error:", event.error);
                    showToast(t(errorKey(event.error), lang()));
                });

                // index 2 sits between Zoom (1) and Legend (3), which map.js adds
                view.ui.add(locate, { position: "top-left", index: 2 });
                applyLabel();
                onChange(applyLabel);
                resolve(locate);
            } catch (err) {
                reject(err);
            }
        });
    });
}