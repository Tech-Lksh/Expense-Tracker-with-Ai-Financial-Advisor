# Advanced Expense Tracker — Backend

A production-grade, **3-tier architecture** Node.js/Express backend for a personal finance tracker, with **Google Maps** location intelligence (place autocomplete, geocoding, "expenses near me", and map-view data).

Built as a portfolio project demonstrating backend + full-stack engineering competence: layered architecture, JWT auth with refresh-token rotation, MongoDB geospatial queries, Redis caching, BullMQ background jobs, Docker, automated tests, and CI.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Tech Stack](#tech-stack)
3. [Google Maps Integration](#google-maps-integration)
4. [Project Structure](#project-structure)
5. [Getting Started](#getting-started)
6. [Environment Variables](#environment-variables)
7. [Running with Docker](#running-with-docker)
8. [API Documentation](#api-documentation)
9. [Testing](#testing)
10. [Background Jobs](#background-jobs)
11. [Security Notes](#security-notes)

---

## Architecture

This backend follows a strict **3-tier (layered) architecture**. Each layer only talks to the layer directly below it — controllers never touch Mongoose models, and services never touch `req`/`res`.

```
┌─────────────────────────────────────────────────────────┐
│  PRESENTATION LAYER   (src/presentation/)                │
│  Routes → Validators (Joi) → Middlewares → Controllers   │
│  Responsibility: HTTP concerns only (parsing, status      │
│  codes, auth headers). No business logic, no DB queries.  │
└───────────────────────────┬─────────────────────────────┘
                             │ calls
┌───────────────────────────▼─────────────────────────────┐
│  BUSINESS LOGIC LAYER  (src/business/)                   │
│  Services + background Jobs                               │
│  Responsibility: business rules (budget thresholds,        │
│  token rotation, location resolution, recurring rules).    │
│  Orchestrates repositories + integrations. Framework-      │
│  agnostic — could be reused behind a CLI or GraphQL API.   │
└───────────────────────────┬─────────────────────────────┘
                             │ calls
┌───────────────────────────▼─────────────────────────────┐
│  DATA ACCESS LAYER     (src/data/)                        │
│  Repositories → Mongoose Models                            │
│  Responsibility: all persistence. Swapping MongoDB for     │
│  another store later only touches this layer.              │
└─────────────────────────────────────────────────────────┘

  src/integrations/googleMaps/  → external API clients (Geocoding,
                                    Places), called only from the
                                    business layer's location.service.js
```

**Why this separation matters in practice:** a controller method is ~3 lines (validate happened already → call service → send response). All the actual logic — "does this email already exist", "has this budget crossed its alert threshold", "resolve this Google `placeId` into coordinates" — lives in services, where it's unit-testable without spinning up Express or MongoDB at all (see [Testing](#testing)).

---

## Tech Stack

| Concern                | Choice                                      |
| ----------------------- | -------------------------------------------- |
| Runtime / Framework     | Node.js 18+, Express 4                      |
| Database                | MongoDB + Mongoose (geospatial 2dsphere indexes) |
| Caching / Job queues    | Redis + BullMQ                              |
| Auth                    | JWT (access + refresh, refresh-token rotation) |
| Validation              | Joi                                          |
| Location intelligence   | Google Maps Platform (Geocoding + Places API) |
| Logging                 | Winston + Morgan                            |
| Security middleware     | Helmet, CORS, express-rate-limit, mongo-sanitize, HPP |
| API docs                | OpenAPI 3.0 + Swagger UI (`/api-docs`)      |
| Testing                 | Jest + Supertest                            |
| Containerization        | Docker (multi-stage) + docker-compose       |
| CI                      | GitHub Actions (lint → test → docker build) |

---

## Google Maps Integration

This is the headline feature on top of the core expense tracker: every expense can be **tagged with a real-world location**, and that data powers map-based views.

| Feature | Endpoint | Google API used |
| --- | --- | --- |
| Search-as-you-type place picker | `GET /locations/autocomplete` | Places Autocomplete |
| Resolve a picked suggestion to coordinates | `GET /locations/place-details` | Place Details |
| Address → coordinates | `POST /locations/geocode` | Geocoding |
| Coordinates → address | `POST /locations/reverse-geocode` | Geocoding (reverse) |
| Tag an expense with a location | `location: { placeId }` or `location: { lat, lng }` on `POST /expenses` | Places / Geocoding (resolved server-side) |
| "Expenses near me" | `GET /expenses/nearby?lat=&lng=&radiusKm=` | MongoDB `$geoNear` (no Google call — pure DB geo query) |
| Map / heatmap data | `GET /expenses/map-data` | MongoDB query, lean projection |

**Design choices worth calling out in an interview:**

- `Expense.location` is stored as a proper **GeoJSON Point** (`{ type: "Point", coordinates: [lng, lat] }`) with a `2dsphere` index, so "nearby expenses" is a single MongoDB aggregation (`$geoNear`) — no need to fetch everything and filter in application code.
- Google Maps API calls are **billed per request**, so `location.service.js` wraps every call in a **Redis cache** (1-week TTL) keyed by the normalized query. A cache failure never breaks the feature — it just falls through to a live call and logs a warning.
- A `RecurringRule` (e.g. a monthly gym membership) can also carry a saved location, so every auto-generated expense keeps the same map pin without re-resolving it each time.

---

## Project Structure

```
src/
├── config/                  # env validation, DB/Redis/Google Maps client setup, logger
├── presentation/
│   ├── routes/               # Express routers (HTTP paths only)
│   ├── controllers/          # thin request/response glue
│   ├── validators/           # Joi schemas
│   └── middlewares/          # auth, validation, rate limiting, error handling
├── business/
│   ├── services/              # business rules (auth, expense, budget, location, analytics...)
│   ├── jobs/                  # BullMQ workers (recurring expenses, budget alert sweep)
│   └── queues/                # BullMQ queue definitions
├── data/
│   ├── models/                 # Mongoose schemas
│   └── repositories/           # data-access layer wrapping Mongoose
├── integrations/googleMaps/   # Geocoding + Places API clients
├── utils/                     # ApiError, ApiResponse, asyncHandler, pagination
├── app.js                     # Express app config (no listen/DB connect — testable in isolation)
└── server.js                  # process entrypoint: connects DB/Redis, starts server + jobs, graceful shutdown

tests/
├── unit/services/              # service-layer tests with repositories mocked
└── integration/                 # supertest against the Express app

docs/openapi.yaml               # full OpenAPI 3.0 spec, served at /api-docs
```

---

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Copy the env template and fill in real values
cp .env.example .env
# at minimum set: MONGO_URI, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, GOOGLE_MAPS_API_KEY

# 3. Start MongoDB + Redis locally (or use docker-compose, see below)

# 4. Run in dev mode (nodemon, auto-restart)
npm run dev

# Server starts on http://localhost:5000
# Swagger UI:  http://localhost:5000/api-docs
# Health check: http://localhost:5000/health
```

### Getting a Google Maps API key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) → create a project.
2. Enable **Geocoding API** and **Places API**.
3. Create an API key under *Credentials*, and restrict it to those two APIs.
4. Paste it into `GOOGLE_MAPS_API_KEY` in your `.env`.

The free tier covers generous usage for a portfolio/demo project; the Redis cache in `location.service.js` further reduces billed calls.

---

## Environment Variables

See [`.env.example`](./.env.example) for the full list with comments. Required keys:

| Variable | Purpose |
| --- | --- |
| `MONGO_URI` | MongoDB connection string |
| `REDIS_HOST` / `REDIS_PORT` | Redis connection (caching + BullMQ) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Must be long, random, and different from each other |
| `GOOGLE_MAPS_API_KEY` | From Google Cloud Console |
| `CLIENT_URL` | Frontend origin, used for CORS |

The app **fails fast on boot** (`src/config/env.js`) if a required variable is missing — no silently broken deployments.

---

## Running with Docker

```bash
# Builds the backend image and starts backend + MongoDB + Redis together
docker compose up --build
```

The `Dockerfile` is a multi-stage build: dependencies are installed in a cached layer, the final image runs as a **non-root user**, and a `HEALTHCHECK` hits `/health` so orchestrators (Docker Swarm, Kubernetes, Render, ECS) know when the container is actually ready — not just "process started."

---

## API Documentation

Full OpenAPI 3.0 spec lives at [`docs/openapi.yaml`](./docs/openapi.yaml) and is served interactively at:

```
GET /api-docs
```

once the server is running. All 21 endpoints (auth, categories, expenses, budgets, recurring rules, analytics, locations) are documented there with request/response schemas.

---

## Testing

```bash
npm test
```

32 tests across 7 suites, all passing, **no real database or Redis instance required** — the test strategy keeps `app.js` free of any DB-connection side effects (that lives only in `server.js`), so:

- **Unit tests** (`tests/unit/services/`) mock the repository layer and test business rules in isolation: budget threshold math, refresh-token rotation security, Google Maps location resolution, Redis cache hit/miss behavior.
- **Integration tests** (`tests/integration/`) use Supertest against the real Express app for things that don't need a live DB: health check, 404 handling, request validation, auth-guard enforcement.

```bash
npm run lint     # ESLint
npm run format   # Prettier
```

---

## Background Jobs

Two BullMQ workers run alongside the HTTP server (started from `server.js`):

| Job | Schedule | Purpose |
| --- | --- | --- |
| `recurring-expense` | every hour | Materializes any `RecurringRule` whose `nextRunDate` has passed into a real `Expense`, then rolls the date forward |
| `budget-alert` | daily | Safety-net sweep over all budgets for the current month — catches the edge case where a budget is created *after* spending already crossed the threshold |

The **primary** budget-alert path is actually real-time: `budget.service.checkAndAlertIfNeeded()` runs inline right after every expense is created, so users get notified within the same request cycle in the common case. The daily sweep is a backstop, not the main mechanism.

---

## Security Notes

- Passwords hashed with bcrypt (cost factor 12).
- Refresh tokens are never stored in plaintext — only a SHA-256 hash — and are **rotated** on every refresh; reuse of an already-rotated token invalidates the whole session.
- Refresh token delivered as an `httpOnly`, `sameSite=strict` cookie (inaccessible to client-side JS); access token returned in the JSON body for the SPA to hold in memory.
- `helmet`, `express-mongo-sanitize` (NoSQL injection), `hpp` (parameter pollution), and tiered rate limiting (tighter on `/auth/*` and Google Maps endpoints) are all applied at the app level.
- Centralized error handler never leaks stack traces in production.

---

Built by **Lokesh** as a portfolio project.
