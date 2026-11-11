// main.js — header wiring, onboarding tour, app bootstrap
import { initMap, setSeason, setLanguage, resetView, onChange, currentLang, currentSeason, setPanelOpen } from "./map.js";
import { setupLocationServices } from "./location.js";
import { t, tourSteps } from "./localization.js";

const $ = (id) => document.getElementById(id);
const storage = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } }
};

/* ==========================================================================
   HEADER
   ========================================================================== */

function updateHeader() {
    const L = currentLang;
    $("lbl-title").textContent = t("appTitle", L);
    $("lbl-subtitle").textContent = t("appSubtitle", L);
    $("btn-lang-toggle").textContent = t("langBtn", L);
    $("btn-season-toggle").textContent = currentSeason === "summer" ? t("seasonBtnWinter", L) : t("seasonBtnSummer", L);
    $("btn-reset-view").textContent = t("resetBtn", L);
    $("btn-tour").textContent = t("tourBtn", L);
    if (tour) renderTour();
}

$("btn-lang-toggle").addEventListener("click", () => setLanguage(currentLang === "EN" ? "JA" : "EN"));
$("btn-season-toggle").addEventListener("click", () => setSeason(currentSeason === "summer" ? "winter" : "summer"));
$("btn-reset-view").addEventListener("click", resetView);
$("btn-tour").addEventListener("click", openTour);

/* ==========================================================================
   TOUR — a spotlight div is positioned over the target, so nothing is
   re-parented and Esri's stacking contexts don't matter.
   ========================================================================== */

let tour = null; // { root, spot, modal, step }

function openTour() {
    if (tour) return;
    const root = document.createElement("div");
    root.id = "customTourOverlay";
    root.className = "tour-overlay";
    root.innerHTML = `
        <div class="tour-spot tour-spot--none"></div>
        <div class="tour-modal" role="dialog" aria-modal="true" aria-labelledby="tourTitle">
            <div class="tour-header"><span id="tourTitle"></span><span class="tour-step-count"></span></div>
            <div class="tour-body"></div>
            <div class="tour-footer">
                <button type="button" class="tour-btn tour-btn-secondary" data-act="back"></button>
                <div class="tour-actions">
                    <button type="button" class="tour-btn tour-btn-secondary" data-act="skip"></button>
                    <button type="button" class="tour-btn tour-btn-primary" data-act="next"></button>
                </div>
            </div>
        </div>`;
    document.body.append(root);
    tour = { root, spot: root.querySelector(".tour-spot"), modal: root.querySelector(".tour-modal"), step: 0 };

    root.addEventListener("click", (e) => {
        const act = e.target.closest("[data-act]")?.dataset.act;
        if (act === "back") go(-1);
        else if (act === "next") go(1);
        else if (act === "skip") closeTour();
    });
    document.addEventListener("keydown", onTourKey);
    window.addEventListener("resize", placeSpot);
    renderTour();
    requestAnimationFrame(() => root.classList.add("active"));
}

function go(delta) {
    const last = tourSteps[currentLang].length - 1;
    const next = tour.step + delta;
    if (next > last) return closeTour();
    tour.step = Math.max(0, next);
    renderTour();
}

function renderTour() {
    const steps = tourSteps[currentLang];
    const step = steps[tour.step];
    const L = currentLang;
    const q = (sel) => tour.modal.querySelector(sel);
    setPanelOpen(!!step.panel);
    tour.root.classList.remove("tour-top");
    q("#tourTitle").textContent = step.title;
    q(".tour-step-count").textContent = t("tourStep", L).replace("{n}", tour.step + 1).replace("{total}", steps.length);
    q(".tour-body").textContent = step.text;
    const back = q('[data-act="back"]');
    back.textContent = t("tourBack", L);
    back.style.visibility = tour.step === 0 ? "hidden" : "visible";
    q('[data-act="skip"]').textContent = t("tourSkip", L);
    const next = q('[data-act="next"]');
    next.textContent = tour.step === steps.length - 1 ? t("tourFinish", L) : t("tourNext", L);
    next.focus();
    placeSpot();
}

function placeSpot() {
    if (!tour) return;
    const target = tourSteps[currentLang][tour.step].target;
    const node = target ? document.querySelector(target) : null;
    const onPanel = !!tourSteps[currentLang][tour.step].panel;
    node?.scrollIntoView?.({ block: onPanel ? "center" : "nearest" }); // panel items may be scrolled out of view
    const rect = node ? node.getBoundingClientRect() : null;
    const spot = tour.spot;
    // Phones: the card sits next to the highlighted item (below it, or above it when it is in the lower half);
    // with no item it is centered. Desktop: CSS keeps the card at the bottom center.
    const mobile = window.matchMedia("(max-width: 768px)").matches;
    const modal = tour.modal;
    if (!mobile) modal.style.marginTop = "";
    const place = (top) => { if (mobile) modal.style.marginTop = `${Math.round(Math.max(8, Math.min(top, window.innerHeight - modal.offsetHeight - 8)))}px`; };
    if (!rect || rect.width === 0) {
        place((window.innerHeight - modal.offsetHeight) / 2);
        spot.className = "tour-spot tour-spot--none";
        spot.removeAttribute("style");
        return;
    }
    const gap = 18;
    place(rect.top + rect.height / 2 < window.innerHeight / 2 ? rect.bottom + gap : rect.top - gap - modal.offsetHeight);
    const pad = 6;
    spot.className = "tour-spot";
    Object.assign(spot.style, {
        left: `${rect.left - pad}px`, top: `${rect.top - pad}px`,
        width: `${rect.width + pad * 2}px`, height: `${rect.height + pad * 2}px`
    });
}

function onTourKey(e) {
    if (e.key === "Escape") closeTour();
    else if (e.key === "ArrowRight") go(1);
    else if (e.key === "ArrowLeft") go(-1);
}

function closeTour() {
    if (!tour) return;
    storage.set("hasSeenTour", "true");
    document.removeEventListener("keydown", onTourKey);
    window.removeEventListener("resize", placeSpot);
    const { root } = tour;
    tour = null;
    setPanelOpen(false);
    root.classList.remove("active");
    setTimeout(() => root.remove(), 300);
}

/* ==========================================================================
   BOOT
   ========================================================================== */

onChange(updateHeader);
updateHeader();

(async function boot() {
    try {
        // config.js is optional at load time so a missing key file doesn't take the whole app down.
        const config = await import("./config.js").catch(() => null);
        const apiKey = config?.AGOL_APIkey?.API_KEY;
        if (!apiKey) console.warn("No API key found in js/config.js — Esri basemap styles will not load.");

        const { view } = await initMap("viewDiv", apiKey);
        setupLocationServices(view, () => currentLang).catch((e) => console.warn("Locate widget failed:", e));

        if (!storage.get("hasSeenTour")) setTimeout(openTour, 1500);
    } catch (err) {
        console.error("Map failed to initialize:", err);
        const host = $("viewDiv");
        host.textContent = "";
        const msg = document.createElement("p");
        msg.className = "fh-error";
        msg.textContent = t("mapLoadError", currentLang);
        host.append(msg);
    }
})();