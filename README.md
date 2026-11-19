# ForeignHokkaido

**A free, bilingual (English/日本語), mobile-first web map for Assistant Language Teachers (ALTs) in the Oshima and Hiyama subprefectures of southwestern Hokkaido, Japan.**

**Live app:** https://harpisthope.github.io/GEOG_778/

ForeignHokkaido puts the practical information a new ALT needs (hospitals, emergency shelters, transit, garbage rules, winter hazards, and community events) on one map in English and Japanese, covering all 18 municipalities from Hakodate to Okushiri. It was built by Hope McBride as the capstone project for GEOG 778 (M.S. in Cartography and GIS, University of Wisconsin–Madison, Fall 2026).

---

## Features

- **English/Japanese switch** for every label, popup, legend entry, tour step, and the basemap labels.
- **Season toggle.** Summer mode (default) shows boundaries and everyday services. Winter mode switches the basemap and brings forward snow classifications, avalanche and landslide areas, and winter recreation areas.
- **Find the Nearest.** Pick a type of place (hospital, pharmacy, shelter, train station, bus stop, and others) and a starting point (your location or a tapped point). The three closest results by straight-line distance appear with links to Google Maps directions.
- **Municipality filter and summary.** Selecting a town filters the layers, outlines the town, and opens a popup with counts of the services inside it.
- **Garbage rules lookup** for all 18 towns, with a verification status, check date, and link to each town's official page.
- **About 20 toggleable layers**, including medical facilities that can be limited to those with foreign-language support.
- **Automatic pan and zoom** that keeps a selected feature clear of its popup, which matters most on phones. Reset Extent returns to the opening view.
- **Community layers.** Two Survey123 forms let users add community events and local interests. The map re-queries them every minute, so entries appear without a reload. Past events are hidden by default.
- **Guided app tour** and an **About & Data Sources** card with data years and credits.
- **Report Issue with App** form for reporting wrong data or translation errors.

## Built with

- [ArcGIS Maps SDK for JavaScript 4.30](https://developers.arcgis.com/javascript/) (AMD build, loaded from Esri's CDN)
- ArcGIS Online hosted feature layers and [Survey123](https://survey123.arcgis.com/)
- GeoJSON files stored in this repository
- Plain HTML, CSS, and JavaScript (ES modules), with no build step
- GitHub Pages for hosting
- Python (ArcGIS Pro / `arcpy`, and the `arcgis` package) for data preparation and updates

## Architecture

Source datasets are cleaned in ArcGIS Pro and Python. Most are published as ArcGIS Online hosted feature layers, and a few smaller ones are kept as GeoJSON in this repository. The app has no server of its own. The browser loads the SDK, draws the layers, and queries them directly (SQL attribute filters and spatial queries for filters, municipality summaries, and Find the Nearest). Survey123 submissions go straight to hosted layers, which the map refreshes every minute.

## Data

Full layer names, years, and credits are in the app under **About & Data Sources**.

| Data | Source |
|---|---|
| Boundaries, public facilities, schools, shelters, bus stops, railways, snow data, wildlife areas | Ministry of Land, Infrastructure, Transport and Tourism (MLIT), [National Land Numerical Information](https://nlftp.mlit.go.jp/ksj/) (2010–2025) |
| Medical facilities | Hokkaido Open Data, [HARP dataset 1243](https://www.harp.lg.jp/opendata/dataset/1243.html), joined to the Hokkaido list of facilities with foreign-language support (February 2026) |
| Avalanche and landslide areas | Hokkaido Forestry Bureau, Mountain Disaster Hazard Areas (CC BY 4.0) |
| Garbage rules | Official town websites and the Kita-Hiyama Sanitation Center Union (checked November 2026) |
| Ski and winter recreation areas | Compiled from resort information with AI assistance, then corrected by hand; partly verified |
| Community events and local interests | Survey123 submissions |

Several MLIT datasets date from 2010 to 2015, so a facility may have closed or moved. Each popup shows its data year.

## Known limitations

- Straight-line distance is used for Find the Nearest, not travel time.
- Garbage collection days are left to each district's calendar and are not in the popups.
- Crowdsourced entries are not moderated or verified.
- All Japanese translations have been AI-assisted and manually reviewed, but not yet confirmed by a native speaker.
- Testing so far covers a small group of ALTs.

## Ideas for future work

- Datasets that lacked usable current data (ATMs, snowplow routes, winter parking rules)
- District-level garbage boundaries and automated update reminders
- Travel-time routing with bus and train timetables
- Date, type, and keyword filtering for community entries
- A named maintainer, such as a regional ALT association
- Expanded coverage beyond Oshima and Hiyama

## Credits and licenses

- Contains data from MLIT National Land Numerical Information. Processed layers are marked as edited, as the terms of use require.
- HARP data (CC BY) from the Hokkaido Open Data Portal. Hazard areas from the Hokkaido Forestry Bureau (CC BY 4.0).
- Favicon adapted from "Hokkaido" by Snow, from the [Noun Project](https://thenounproject.com/icon/2676113/) (CC BY 3.0).
- **AI assistance.** Claude and Google Gemini assisted with code, translation, and data compilation. All output was manually reviewed.
- Thank you to the ALTs who took the survey, tested the app, and sent local corrections.

## Author

Hope McBride · M.S. in Cartography and GIS, University of Wisconsin–Madison
GEOG 778 Practicum, Fall 2026