# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

E-Telly is a full-stack disaster management and hazard alerting system built for the Philippines. It displays real-time earthquake, flood, typhoon, and landslide data on a map, generates automated alerts from external APIs (USGS, GDACS, Open-Meteo), and lets barangay officials submit emergency reports.

## Development Commands

Run client and server in separate terminals:

```bash
# Frontend (Vite dev server on port 5173)
cd client && npm run dev

# Backend (Nodemon on port 5000)
cd server && npm run dev
```

Other commands:
```bash
cd client && npm run build   # Production build
cd client && npm run lint    # ESLint
cd client && npm run preview # Preview production build
```

There are no automated tests.

## Architecture

```
Frontend (React/Vite :5173)  ←→  Backend (Express :5000)  ←→  MongoDB Atlas (etelly db)
                                        ↓
                               Socket.IO (real-time)
                                        ↓
                               Cron Jobs (alertEngine.js)
```

Vite proxies all `/api/*` requests to `http://localhost:5000`, so the frontend never hardcodes the backend port in API calls.

**Server environment variables** are in `server/.env` (PORT, MONGO_URI, JWT_SECRET). The client reads `import.meta.env.VITE_API_BASE` (defaults to `http://localhost:5000`).

## Backend Structure

- `server/index.js` — Express entry point, MongoDB connection, Socket.IO setup, mounts all routers
- `server/routes/hazard.js` — Fetches Open-Meteo + GDACS data; uses an **in-memory Map cache** (5–10 min TTL) shared with the alert engine to prevent rate limiting
- `server/scripts/alertEngine.js` — Cron-based alert generator (15-min system checks, 30-min agency checks); sources: Open-Meteo (flood/rainfall), USGS (earthquakes), GDACS RSS (typhoon, flood, volcano)
- `server/middleware/auth.js` — `protect` (JWT required) and `requireAdmin` middleware
- Server uses **ES modules** (`"type": "module"` in package.json)

## Frontend Structure

- `client/src/App.jsx` — React Router setup with auth guards; redirects unauthenticated users to `/login`
- `client/src/pages/HazardMapPage.jsx` — Main map page orchestrating all hazard layers
- `client/src/components/map/` — All map components organized by hazard type (earthquake/, flood/, landslide/, typhoon/, reports/)
- `client/src/hooks/useAlerts.js` — Polls `/api/alerts` every 60 seconds, returns alerts grouped by severity
- `client/src/utils/socket.js` — Singleton Socket.IO client connecting to backend

## Key Patterns

**Authentication:** JWT stored in `localStorage`. Token expiry is validated client-side before API calls. The `protect` middleware on the server validates the Bearer token.

**In-memory hazard cache:** `hazard.js` uses a shared `Map` with TTL timestamps. Both the route handlers and `alertEngine.js` import and use the same cache to avoid redundant external API calls.

**Alert lifecycle:** Alerts are never hard-deleted — they are marked `active: false`. The alert engine checks for existing active alerts before creating duplicates. Alerts have an `expiresAt` field and a `source` field (system/pagasa/phivolcs/gdacs).

**Real-time updates:** Socket.IO emits `new_emergency_report` and `report_updated` events when reports are created or updated. The frontend subscribes in `ReportsLayer.jsx`.

**Leaflet icon fix:** `client/src/utils/fixLeafletIcons.js` must be imported before any Leaflet map renders to resolve a Webpack/Vite asset URL issue with default marker icons.

**Role-based access:** User roles are `admin`, `user`, and `barangay_official`. Admin-only routes are guarded by the `requireAdmin` middleware.

## External APIs

| API | Used for |
|-----|----------|
| Open-Meteo | Rainfall, flood, and landslide forecasts |
| USGS Earthquake API | Earthquake data |
| GDACS RSS | Typhoon, flood, volcano events |
| Nominatim | Geocoding in the location picker |

## Database

MongoDB Atlas cluster (`etelly` database). Main collections: `alerts`, `users`, `emergency_reports`. Run `node server/scripts/createAdmin.js` to seed the first admin user.
