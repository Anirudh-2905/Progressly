# Learning Tracker

An end-to-end learning project for tracking goals, projects, and tasks.

## Current milestone

The current vertical slice provides an authenticated React + TypeScript dashboard backed by a FastAPI REST API and SQLite. It supports private accounts, complete project/task workflows, search, notifications, filters, schedules, and real progress summaries.

## Run locally

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### Frontend

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 (or http://127.0.0.1:5173). Do not double-click `frontend/index.html`; React modules must be served by Vite.

The first account created against an upgraded legacy database claims the existing unowned projects. Later accounts receive separate private workspaces.

No `.env` file is required for local SQLite development. If you need custom
backend settings, export them in the terminal before starting Uvicorn. Use
`.env.example` only as a reference and never commit a file containing real
credentials. Production values are entered directly in Render.

## Architecture

```text
React + TypeScript -> authenticated FastAPI /api/v1 -> SQLAlchemy
                                                   -> SQLite (local)
                                                   -> Neon PostgreSQL (deployed)
```

Set `VITE_API_URL` when the frontend and API are deployed on different origins. Locally it automatically uses port 8000 on the current hostname.

## Verification

```bash
cd backend && .venv/bin/pytest -q
cd ../frontend && npm run build && npm test
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

Playwright starts isolated API/frontend servers and uses a separate SQLite database, so browser tests do not modify development data.

## Database migrations

The local first-run convenience path creates tables automatically. The deployment image runs Alembic migrations before starting FastAPI:

```bash
cd backend
.venv/bin/alembic upgrade head
```

## Deployment

`render.yaml` describes one Docker-based Render web service that serves the
compiled frontend and API from the same origin. Production refuses to start
without a persistent `DATABASE_URL`. Follow the complete
[deployment guide](docs/deployment.md) to provision Neon, deploy with Render,
verify the release, back up data, and roll back.

## Learning checkpoints

1. Understand the request flow from a React form to an authenticated database row.
2. Trace account isolation through API dependencies and database ownership.
3. Extend the automated tests and CI safely.
4. Deploy the containers and managed PostgreSQL database.
