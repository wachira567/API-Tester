# Nexus API Explorer

A local-first API testing workspace for loading Postman collections, validating environment variables, attaching JSON validation schemas, and running Newman-backed test executions with clear pass/fail diagnostics.

## What this app does

- Starts from a Postman collection.
- Validates the collection against the selected environment variables.
- Lets you attach a validation schema before running.
- Runs the collection and compares expected status and schema validation results.
- Stores collections, environments, schemas, credential profiles, and run history in Postgres when configured.
- Supports per-user isolation through Clerk identity headers so one account does not affect another.

## Running the app

You need two terminals: one for the backend and one for the frontend.

### 1. Start the backend

```bash
cd api-tester-dashboard/backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Default backend URL:

```text
http://127.0.0.1:3101/api
```

python app.py
```

### 2. Start the frontend

```bash
cd api-tester-dashboard/frontend
npm install
npm run dev
```

Default frontend URL:

```text
http://127.0.0.1:5173
```

## Environment variables

### Frontend

Create or update `api-tester-dashboard/frontend/.env`:

```env
VITE_API_BASE=/api
# Optional (Vite dev proxy target)
# VITE_API_PROXY_TARGET=http://127.0.0.1:3101
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
```

### Backend

Create or update `api-tester-dashboard/backend/.env`:

```env
PORT=3101
COLLECTION_PATH=../collections
ENVIRONMENT_PATH=../environments
POSTMAN_PATH=../../postman
POSTMAN_PATH=../../postman

API_TESTER_DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
API_TESTER_DB_SSL=true
API_TESTER_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
API_TESTER_MAX_SCHEMA_JSON_BYTES=262144
API_TESTER_MAX_REQUEST_BYTES=5242880
API_TESTER_RATE_LIMIT_ENABLED=true
API_TESTER_RATE_LIMIT_STORAGE_URI=memory://
API_TESTER_RATE_LIMIT_DEFAULT=300 per hour
API_TESTER_RATE_LIMIT_IMPORT=30 per minute
API_TESTER_RATE_LIMIT_SCHEMA_WRITE=30 per minute
API_TESTER_RATE_LIMIT_CREDENTIAL_WRITE=30 per minute
API_TESTER_RATE_LIMIT_ANALYZE=60 per minute
API_TESTER_RATE_LIMIT_RUN_TEST=20 per minute
API_TESTER_ALLOW_GUEST_USER=false
CLERK_SECRET_KEY=your_clerk_secret_key
```

If you are using the provided Neon connection string, set `API_TESTER_DATABASE_URL` to that value.

## Database-backed persistence

When `API_TESTER_DATABASE_URL` is present, the backend stores and queries:

- users
- collection assets
- environment assets
- validation schemas
- credential profiles
- run history
- asset audit events

The backend also supports DB-backed filenames such as:

```text
db-collections/<asset-key>
db-environments/<asset-key>
```

Those assets are queryable and auditable through the API.

### Useful API endpoints

- `GET /api/health`
- `GET /api/collections`
- `GET /api/environments`
- `GET /api/assets?kind=collection`
- `GET /api/assets?kind=environment`
- `GET /api/asset-events?kind=collection`
- `GET /api/schemas`
- `POST /api/import`
- `POST /api/schemas`
- `POST /api/credential-profiles`
- `POST /api/run-test`
- `GET|POST /api/analyze`

## Security defaults

- Collections/environments listed by the app are now user-scoped only (DB assets plus that user’s imported files).
- Shared local folders (`collections/`, `environments/`, `postman/`) are not exposed through user list/read APIs.
- Credential profile passwords are stored as bcrypt hashes and are never returned in API reads.
- Request payload size is capped by `API_TESTER_MAX_REQUEST_BYTES`.
- API routes use rate limits (configurable via `API_TESTER_RATE_LIMIT_*` envs).
- Guest mode is disabled by default; requests must include `x-user-id` unless `API_TESTER_ALLOW_GUEST_USER=true`.

## Validation flow

The current run flow is:

1. Load a collection.
2. Resolve and validate environment variables.
3. Select or create a validation schema.
4. Run the collection.
5. Inspect actual status, schema validation, and audit history.

The dashboard no longer depends on example response bodies for its main validation path.

## UI behavior

- Responsive sidebar for mobile and desktop.
- Graph and list views for execution flow.
- Horizontal node layout with multiple incoming links per node.
- User account gate with Clerk sign-in/sign-up controls.
- Per-user credential profiles and schema selection.

## Frontend build

```bash
cd api-tester-dashboard/frontend
npm run build
```

## Backend syntax check

```bash
cd api-tester-dashboard/backend
python -m py_compile app.py
```

## Backend tests

```bash
cd api-tester-dashboard/backend
source .venv/bin/activate
pytest -q
```



## Notes

- Backend runs on port `3101` by default.
- Frontend runs on port `5173` by default.
- `VITE_CLERK_PUBLISHABLE_KEY` must be set for the frontend to initialize Clerk.
- The backend uses the Clerk identity headers only for account scoping; the app still owns the main workflow logic.
