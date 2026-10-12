# ForeignHokkaido

**ForeignHokkaido** is a bilingual (English/Japanese) web mapping application built with  ArcGIS Maps SDK for JavaScript and hosted on GitHub Pages. Developed using a Scenario-Based Design (SBD) framework, it provides Assistant Language Teachers (ALTs) across Hokkaido's Oshima and Hiyama subprefectures with centralized access to administrative infrastructure, seasonal information, and community networks.

---

## 1. Problem Statement & Solution
Foreign teachers in rural Japan face barriers due to language gaps and disparate municipal data. ForeignHokkaido solves this by consolidating resources into a responsive map interface featuring:
* **Bilingual UI & Popups:** Instant translation toggles between English and Japanese ($\text{🇯🇵 日本語}$).
* **Custom Map Controls:** Allows users to perform spatial queries and tailor layers to their specific needs.
* **Winter Mode:** Dynamic basemap switching and snowfall hazard zoning for winter preparedness.
* **Crowdsourcing:** Integrated Survey123 web forms for real-time community reports.

---

## 2. Data Table

| Dataset Name | Layer Type | Source & Retrieval | Use in App |
| :--- | :--- | :--- | :--- |
| **Administrative Boundaries** | Polygon Feature Layer | Hokkaido Open Data Portal (HARP) & Esri Japan AGOL | Defines municipal boundaries for spatial indexing and dropdown filtering. |
| **Public Infrastructure & Hazards** | Point / Polygon | Japan National Land Numerical Information (NLNI) Portal | Locates municipal offices, health centers, and disaster/evacuation zones. |
| **Local Regulations & Trash** | Tabular / GeoJSON | Municipal Websites (e.g., Shiriuchi Waste Calendar) | Provides localized waste-sorting rules and winter parking bans. |
| **Crowdsourced Networks** | Hosted Point Layer | Esri Survey123 Forms on AGOL | Collects user-submitted events, language classes, and safety alerts. |
| **Vector Basemaps** | Vector Tile Layer | Esri / ArcGIS Online | Provides high-contrast summer/winter basemaps highlighting seasonal hazards. |

---

## 3. Tech Stack & Architecture
* **Frontend:** HTML5, CSS3, ArcGIS Maps SDK for JavaScript v4.26, hosted on GitHub Pages.
* **Backend & Database:** ArcGIS Online (AGOL) serverless feature services, REST endpoints, and ArcGIS Survey123 web forms.

---

## 4. Credits
* **Developer:** Hope McBride (Accelerated M.S. in Cartography & GIS, UW–Madison)
* **Data Sources:** To be finalized in a future iteration.