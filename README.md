# Boltzzmann MVP

Boltzzmann is a working hackathon MVP for an AI-assisted coastal safety and drone operations command center in Aktau, Kazakhstan.

This is an operational web application, not a landing page.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, React Router, lucide-react, Recharts
- Backend: Node.js, TypeScript, Express, Socket.IO
- Database: PostgreSQL on Neon, Prisma ORM
- Maps: Leaflet with OpenStreetMap tiles

## Data Model

PostgreSQL is the source of truth for the application. Dashboards and pages read operational entities from the REST API backed by Prisma:

- drones, drone connections, telemetry
- incidents, incident events, rescue assignments
- rescuers and patrols
- search missions, sightings, candidates, drift predictions
- recordings, playback events, evidence packages
- users and controller-managed operational records

The frontend refreshes PostgreSQL-backed overview data periodically, so API-created records appear in the command center and pages even when WebSocket delivery is unavailable.

## Neon setup used

The project was linked to Neon project `mute-hat-82341837` on branch `production`.

Commands run:

```bash
npm i -g neon@latest && neon login
neon skills -y
neon mcp -y
neon link --project-id mute-hat-82341837 --branch production -y
neon config init
```

`neon.ts` is intentionally minimal:

```ts
import { defineConfig } from "@neon/config/v1";

export default defineConfig({});
```

Then:

```bash
neon deploy
```

Neon writes real connection strings to `.env.local`. That file is ignored by git.

## Install and run

```bash
npm install
```

Generate Prisma Client:

```bash
set -a; source .env.local; set +a; npm run db:generate
```

Apply migrations:

```bash
set -a; source .env.local; set +a; DATABASE_URL="$DATABASE_URL_UNPOOLED" npx prisma migrate deploy
```

Seed/update required system accounts without wiping existing rows:

```bash
set -a; source .env.local; set +a; npm run db:seed
```

Run API and web:

```bash
npm run dev:api
npm run dev:web
```

Open:

- Command center: http://localhost:5173/overview
- Live operations: http://localhost:5173/live
- Mobile rescuer view: http://localhost:5173/rescue

API runs at:

- http://localhost:4100/api/health

## Implemented routes

- Connection gateway - shown before the command center when no active `DroneConnection` exists
- `/overview` - main command center with KPIs, Leaflet map, zones, drones, rescuers, search areas, drift areas, last-seen points, sea summary, timeline
- `/live` - live operations view using the latest database recording, detections, telemetry, and active incidents
- `/incidents` - incident table, database-backed creation form, detail panel, timeline, confirm/dispatch/evidence/resolve/false-alarm actions
- `/search` - search mission form with map point selection, radius, last-seen time, tags, visual reference field, candidates, last-seen network, drift
- `/playback` - recording metadata, timeline events, synchronized map, overlay marker, change detection
- `/evidence` - evidence package list and printable official report view with QR payload
- `/patrols` - patrol creation and patrol status cards
- `/analytics` - Recharts dashboard from database data
- `/drones` - fleet page and telemetry chart
- `/rescue` - phone/watch-sized rescuer workflow for accept/arrived/rescued

## Database tables

Prisma models:

- `User`
- `Drone`
- `DroneTelemetry`
- `Incident`
- `IncidentEvent`
- `Patrol`
- `SearchMission`
- `SearchCandidate`
- `Detection`
- `Zone`
- `Rescuer`
- `RescueAssignment`
- `DroneConnection`
- `TargetSighting`
- `Recording`
- `RecordingEvent`
- `ChangeDetection`
- `Evidence`
- `EvidenceAsset`
- `PrintJob`
- `ResponseService`
- `EnvironmentalSnapshot`
- `DriftPrediction`
- `OfflineSyncEvent`

Migrations are in `prisma/migrations`.

## Login Accounts

Seeded accounts:

- `nadzor@boltzzmann.kz` / `nadzor2026`
- `controller@boltzzmann.kz` / `controller2026`

The controller role can create and manage users, drones, rescuers, locations, fleet records, recordings, and operational data.

## Verification performed

- Prisma migration `20260924054156_qutqar_phase2_ops` was created and applied to Neon branch `production`.
- Prisma Client generation completed.
- Non-destructive `npm run db:seed` completed against Neon.
- `npm run build` passed for API and web.
- API health returned `database: connected`.
- `/api/overview`, `/api/playback`, and `/api/evidence` returned PostgreSQL-backed data.
- Browser smoke test rendered `/overview`, `/live`, `/incidents`, `/search`, `/playback`, `/evidence`, and `/rescue` from `http://localhost:5174` with no client console errors.

Note: `npm install` reported three high-severity audit findings in the dependency tree. I did not run `npm audit fix --force` because it may introduce breaking dependency changes during the MVP build.
