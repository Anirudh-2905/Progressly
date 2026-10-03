# Deploying the Learning Tracker

Production uses one Render web service and one Neon PostgreSQL database. The
single service serves both the compiled React application and FastAPI, which
keeps session cookies same-origin and avoids cross-origin authentication setup.

## Prerequisites

- A GitHub repository containing this project
- A Neon account and PostgreSQL project
- A Render account connected to the GitHub repository

Never commit the Neon connection string. It contains a database password.

## 1. Create the production database

1. In Neon, create a project in a region near the Render service.
2. In **Connection Details**, enable the pooled connection and copy its
   connection string. Keep `sslmode=require` in the URL.
3. Save the string temporarily in a password manager. It will become Render's
   `DATABASE_URL` secret.

The backend accepts `postgres://` and `postgresql://` URLs and selects the
installed psycopg 3 driver automatically.

## 2. Deploy from the repository

1. In Render, choose **New > Blueprint** and select the GitHub repository.
2. Render reads `render.yaml` and creates the `learning-tracker` web service.
3. When Render prompts for `DATABASE_URL`, paste the Neon pooled connection
   string.
4. Create the Blueprint and wait for the health check to pass.

The image build compiles the frontend with `/api/v1` as its API URL. On startup,
the container runs `alembic upgrade head` before starting the web server. Render
checks `/health`, which also verifies a database query.

## 3. Verify the release

Open the assigned `https://...onrender.com` URL and verify:

1. Registration opens the dashboard.
2. A project and task can be created.
3. Refreshing the page keeps the session and data.
4. `https://YOUR-SERVICE.onrender.com/health` returns
   `{"status":"ok","database":"ok"}`.
5. The Render logs contain no migration or database errors.

## Configuration

| Variable | Production value | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Neon pooled connection string | Persistent PostgreSQL storage |
| `REQUIRE_DATABASE_URL` | `true` | Refuses to start with accidental ephemeral SQLite |
| `COOKIE_SECURE` | `true` | Sends sessions over HTTPS only |
| `COOKIE_SAMESITE` | `lax` | Safe default because UI and API share one origin |

## Rollback

Use Render's deploy history to redeploy the last known-good commit. Database
migrations are forward-only during normal deployment: if a release includes a
destructive schema change, take a backup first and document a tested downgrade
or compensating migration before merging it.

## Database backup and restore

With PostgreSQL client tools installed, export a custom-format backup:

```bash
pg_dump "$DATABASE_URL" --format=custom --file learning-tracker.backup
```

Test restores against a separate Neon branch or database, never production:

```bash
pg_restore --no-owner --dbname "$RESTORE_DATABASE_URL" learning-tracker.backup
```

Do not use a destructive restore against production without a reviewed recovery
plan and a current backup.
